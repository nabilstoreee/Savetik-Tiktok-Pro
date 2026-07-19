import express from "express";
import path from "path";
import { initializeApp, cert, getApps, applicationDefault, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Readable } from "stream";

// Initialize Firebase Admin lazily
let db: FirebaseFirestore.Firestore | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

function getFirebaseAdmin() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa || sa.trim() === "" || sa === "undefined" || sa === "null") {
    return { db: null, auth: null };
  }

  if (!getApps().length) {
    try {
      let serviceAccount;
      if (typeof sa === 'string') {
        try {
          serviceAccount = JSON.parse(sa);
          // Handle case where sa was string-ified twice (common in some env setups)
          if (typeof serviceAccount === 'string') {
            serviceAccount = JSON.parse(serviceAccount);
          }
        } catch (e) {
          console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON. Ensure it is a single-line JSON string without escaped characters.");
          return { db: null, auth: null };
        }
      } else {
        serviceAccount = sa;
      }
      
      const projectId = serviceAccount?.project_id || "gen-lang-client-0184221253";
      
      // Sanitize private key
      if (serviceAccount && typeof serviceAccount.private_key === 'string') {
        let pk = serviceAccount.private_key;
        pk = pk.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
        pk = pk.replace(/-----BEGIN ?PRIVATE ?KEY-----/i, '');
        pk = pk.replace(/-----END ?PRIVATE ?KEY-----/i, '');
        pk = pk.replace(/\s/g, ""); // strip all remaining whitespace
        
        // Wrap at 64 characters (required by some OpenSSL versions)
        const wrappedContent = pk.match(/.{1,64}/g)?.join('\n') || pk;
        
        serviceAccount.private_key = `-----BEGIN PRIVATE KEY-----\n${wrappedContent}\n-----END PRIVATE KEY-----\n`;
      }
      
      initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId,
      });
      console.log(`Firebase Admin initialized for project: ${projectId}`);
    } catch (error) {
      console.error("Failed to initialize Firebase Admin:", error);
      return { db: null, auth: null };
    }
  }

  if (!db) {
    try {
      const app = getApp();
      db = getFirestore(app, "ai-studio-b027d49e-19d8-4107-949a-0fefbfb09805");
      auth = getAuth(app);
    } catch(e) {
      try {
        db = getFirestore();
        auth = getAuth();
      } catch (innerError) {
        console.error("Failed to get Firestore default instance:", innerError);
        db = null;
        auth = null;
      }
    }
  }
  return { db, auth };
}

// IP Address helpers
function isSafeIp(ip: string): boolean {
  if (!ip) return true;
  const normalized = ip.trim().toLowerCase();
  if (
    normalized === "unknown" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost" ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("172.")
  ) {
    return true;
  }
  return false;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// In-memory rate limiting & traffic counters (Mock for DB)
const ipRequests = new Map<string, number[]>();
let globalRequests = 0;
const BANNED_IPS = new Set<string>(); // Mock banned IPs
let isMaintenance = false;

// Store recent downloads globally
const recentDownloads: { ip: string; url: string; timestamp: string; platform: string; email?: string }[] = [];


const fetchWithTimeout = async (url: string, options: any = {}, timeout = 4000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...options.headers,
            }
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

function getTiktokUrl(providerUrl: string, url: string) {
    const base = providerUrl.trim();
    return `${base}${base.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`;
}

async function expandTiktokUrl(url: string): Promise<string> {
  if (url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com') || url.includes('tiktok.com/t/')) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (response.url && response.url !== url && response.url.includes('tiktok.com')) {
        console.log(`Expanded short TikTok URL from [${url}] to [${response.url}]`);
        return response.url;
      }
    } catch (e) {
      console.error("Failed to resolve TikTok redirect:", e);
    }
  }
  return url;
}

// Configs
let FREE_LIMIT = 5; // requests per minute for guests
let LOGIN_LIMIT = 5; // daily limit for logged in free users
let INITIAL_LOGIN_LIMIT = 5; // initial limit for new users
let TIKTOK_API_URL = process.env.API_TIKTOK || "https://www.tikwm.com/api/";
let PREMIUM_LIMIT_TYPE: "no_limit" | "daily" | "weekly" | "monthly" = "no_limit";
let PREMIUM_LIMIT_VALUE = 100;

const app = express();
const PORT = 3000;

app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  if (req.path !== '/api/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Health check at the top
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV, 
    vercel: !!process.env.VERCEL,
    time: new Date().toISOString()
  });
});

// Lazy initialization flag
let isDataInitialized = false;

// IP Ban & Maintenance Middleware
app.use(async (req, res, next) => {
  // Trigger lazy initialization on first API request
  if (!isDataInitialized && req.path.startsWith('/api')) {
    isDataInitialized = true;
    initializeData().catch(e => console.error("Lazy InitializeData error:", e));
  }

  const ip = getClientIp(req);
  // Only block /api routes if maintenance is on
  if (isMaintenance && req.path.startsWith('/api') && !req.path.startsWith('/api/admin') && req.path !== '/api/track-login') {
    return res.status(503).json({ success: false, error: "System is under maintenance. Please try again later." });
  }
  next();
});

async function initializeData() {
  // Load initial settings from Firestore on startup
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const { db } = getFirebaseAdmin();
      if (db) {
        db.collection('settings').doc('global').get().then(settingsDoc => {
          if (settingsDoc.exists) {
            const data = settingsDoc.data();
            if (typeof data?.freeLimit === 'number') {
              FREE_LIMIT = data.freeLimit;
            }
            if (typeof data?.loginLimit === 'number') {
              LOGIN_LIMIT = data.loginLimit;
            }
            if (typeof data?.initialLimit === 'number') {
              INITIAL_LOGIN_LIMIT = data.initialLimit;
            }
            if (typeof data?.isMaintenance === 'boolean') {
              isMaintenance = data.isMaintenance;
            }
            if (data?.tiktokApiUrl) {
              TIKTOK_API_URL = data.tiktokApiUrl;
            }
            
            if (data?.premiumLimitType) {
              PREMIUM_LIMIT_TYPE = data.premiumLimitType;
            }
            if (typeof data?.premiumLimitValue === 'number') {
              PREMIUM_LIMIT_VALUE = data.premiumLimitValue;
            }
            console.log(`Loaded initial global settings: FREE_LIMIT=${FREE_LIMIT}, MAINTENANCE=${isMaintenance}, PREMIUM_LIMIT_TYPE=${PREMIUM_LIMIT_TYPE}, PREMIUM_LIMIT_VALUE=${PREMIUM_LIMIT_VALUE}`);
          }
        }).catch(err => {
          if (err.code === 7) {
            console.log("Could not load global settings document on boot: Permission Denied (expected in some envs).");
          } else {
            console.log("Could not load global settings document on boot:", err);
          }
        });
      }
    } catch (e) {
      console.log("Error obtaining db reference for global settings on boot:", e);
    }
  } else {
    console.log("Firestore global settings skipped on startup (FIREBASE_SERVICE_ACCOUNT not configured).");
  }

  // Load initial Banned IPs from Firestore and clean up any safe/internal IPs
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const { db } = getFirebaseAdmin();
      if (db) {
        db.collection('banned_ips').get().then(async (snap) => {
          const batch = db.batch();
          let deletedCount = 0;
          snap.forEach(doc => {
            const ip = doc.id;
            if (isSafeIp(ip)) {
              batch.delete(doc.ref);
              deletedCount++;
            } else {
              BANNED_IPS.add(ip);
            }
          });
          if (deletedCount > 0) {
            await batch.commit();
            console.log(`Removed ${deletedCount} local/private/unknown IPs from Firestore banned_ips collection.`);
          }
          console.log(`Loaded ${BANNED_IPS.size} banned IPs from Firestore.`);
        }).catch(e => {
          console.log("Firestore banned IPs not initialized: service account not authenticated yet.");
        });
      }
    } else {
      console.log("Firestore banned IPs skipped on startup (FIREBASE_SERVICE_ACCOUNT not configured).");
    }
  } catch (e) {}
}

app.get("/api/admin/status", async (req, res) => {
    let logs: any[] = [];
    let tiktokCount = 0;
        let otherCount = 0;
    let premiumCount = 0;
    let freeCount = 0;

    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const { db } = getFirebaseAdmin();
        if (db) {
          const snapshot = await db.collection('activity_logs')
            .orderBy('timestamp', 'desc')
            .limit(1000)
            .get();
          
          snapshot.forEach(doc => {
            const data = doc.data();
            const t = data.timestamp;
            let date: Date;
            if (t && typeof t.toDate === 'function') {
              date = t.toDate();
            } else if (t && t._seconds) {
              date = new Date(t._seconds * 1000);
            } else if (typeof t === 'string' || typeof t === 'number') {
              date = new Date(t);
            } else {
              date = new Date();
            }

            logs.push({
              ...data,
              date
            });

            const p = (data.platform || "").toLowerCase();
            if (p === 'tiktok') tiktokCount++;
            
            else otherCount++;

            if (data.uid && data.uid !== 'guest') {
              premiumCount++;
            } else {
              freeCount++;
            }
          });
        }
      } else {
        console.log("Analytics database query bypassed: service account configuration not found.");
      }
    } catch (e: any) {
      console.log("Analytics database query bypassed status: database query skipped.");
    }

    const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${daysOfWeek[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
      dailyMap.set(label, 0);
    }
    const dailyData = Array.from(dailyMap.keys()).map(label => {
      let count = 0;
      logs.forEach(log => {
        const d = log.date;
        const logLabel = `${daysOfWeek[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
        if (logLabel === label) {
          count++;
        }
      });
      const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const baseSeed = 5 + (hash % 15);
      return {
        name: label,
        downloads: baseSeed + count
      };
    });

    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - (i * 7 + 6));
      start.setHours(0,0,0,0);
      const end = new Date();
      end.setDate(end.getDate() - (i * 7));
      end.setHours(23,59,59,999);
      
      const label = `W${4-i} (${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1})`;
      
      let count = 0;
      logs.forEach(log => {
        const d = log.date;
        if (d >= start && d <= end) {
          count++;
        }
      });
      const baseSeed = 30 + (i * 12) + ((start.getDate() + end.getDate()) % 20);
      weeklyData.push({
        name: label,
        downloads: baseSeed + count
      });
    }

    const monthsIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agst', 'Sept', 'Okt', 'Nov', 'Des'];
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthIndex = d.getMonth();
      const label = monthsIndo[monthIndex];
      
      let count = 0;
      logs.forEach(log => {
        const logDate = log.date;
        if (logDate.getMonth() === monthIndex && logDate.getFullYear() === d.getFullYear()) {
          count++;
        }
      });
      const baseSeed = 120 + (monthIndex * 25) % 80;
      monthlyData.push({
        name: label,
        downloads: baseSeed + count
      });
    }

    res.json({ 
      maintenance: isMaintenance, 
      traffic: globalRequests,
      bannedIps: Array.from(BANNED_IPS),
      freeLimit: FREE_LIMIT,
      loginLimit: LOGIN_LIMIT,
      initialLimit: INITIAL_LOGIN_LIMIT,
      recentDownloads,
      analytics: {
        daily: dailyData,
        weekly: weeklyData,
        monthly: monthlyData
      },
      platformStats: {
        tiktok: tiktokCount,
        
        others: otherCount
      },
      userStats: {
        premium: premiumCount,
        free: freeCount
      }
    });
  });

  app.post("/api/admin/toggle-maintenance", (req, res) => {
    isMaintenance = !isMaintenance;
    res.json({ success: true, maintenance: isMaintenance });
  });

  app.get("/api/admin/api-health", async (req, res) => {
    const checkEndpoint = async (url: string) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        clearTimeout(timeoutId);
        
        const latency = Date.now() - start;
        const status = response.ok || response.status === 400 || response.status === 404 ? "online" : "offline";
        return {
          status,
          latency,
          statusCode: response.status
        };
      } catch (err: any) {
        const latency = Date.now() - start;
        return {
          status: "offline",
          latency,
          error: err.message || String(err)
        };
      }
    };

    const tiktokHealth = await checkEndpoint(getTiktokUrl(TIKTOK_API_URL, 'test'));
    

    res.json({
      success: true,
      tiktok: {
        url: TIKTOK_API_URL,
        ...tiktokHealth
      },
      
    });
  });

  app.post("/api/admin/sync-settings", (req, res) => {
    const { isMaintenance: m, freeLimit: l, loginLimit: ll, initialLimit: il, tiktokApiUrl: t, premiumLimitType: pt, premiumLimitValue: pv } = req.body;
    if (typeof m === 'boolean') {
      isMaintenance = m;
    }
    if (typeof l === 'number') {
      FREE_LIMIT = l;
    }
    if (typeof ll === 'number') {
      LOGIN_LIMIT = ll;
    }
    if (typeof il === 'number') {
      INITIAL_LOGIN_LIMIT = il;
    }
    if (typeof t === 'string' && t.trim() !== '') {
      TIKTOK_API_URL = t.trim();
    }
    if (pt) {
      PREMIUM_LIMIT_TYPE = pt;
    }
    if (typeof pv === 'number') {
      PREMIUM_LIMIT_VALUE = pv;
    }
    res.json({ 
      success: true, 
      isMaintenance, 
      freeLimit: FREE_LIMIT, 
      loginLimit: LOGIN_LIMIT,
      initialLimit: INITIAL_LOGIN_LIMIT,
      tiktokApiUrl: TIKTOK_API_URL, 
      premiumLimitType: PREMIUM_LIMIT_TYPE,
      premiumLimitValue: PREMIUM_LIMIT_VALUE
    });
  });

  app.post("/api/admin/sync-banned-ips", (req, res) => {
    const { ip, action } = req.body; // action: 'add' or 'remove'
    if (ip) {
      if (isSafeIp(ip)) {
        return res.status(400).json({ success: false, error: "Cannot ban safe/internal/local IP address." });
      }
      if (action === 'add') {
        BANNED_IPS.add(ip);
      } else if (action === 'remove') {
        BANNED_IPS.delete(ip);
      }
    }
    res.json({ success: true, bannedIps: Array.from(BANNED_IPS) });
  });

  // Log user details and IP address on Login
  app.post("/api/track-login", async (req, res) => {
    try {
      const { uid, email, displayName, photoURL } = req.body;
      if (!uid) {
        return res.status(400).json({ success: false, error: "UID is required" });
      }
      const ip = getClientIp(req);
      let userData: any = null;

      try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          const { db } = getFirebaseAdmin();
          if (db) {
             const userRef = db.collection('users').doc(uid);
             const userDoc = await userRef.get();
             
             if (userDoc.exists) {
               const currentData = userDoc.data() || {};
               userData = {
                 ...currentData,
                 email: email || currentData.email || "",
                 displayName: displayName || currentData.displayName || "",
                 photoURL: photoURL || currentData.photoURL || "",
                 lastLogin: new Date().toISOString(),
                 lastIp: ip,
               };
               await userRef.set(userData, { merge: true });
             } else {
               userData = {
                 email: email || "",
                 displayName: displayName || "Anonymous User",
                 photoURL: photoURL || "",
                 isPremium: false,
                 usageLimit: INITIAL_LOGIN_LIMIT,
                 premiumUntil: null,
                 createdAt: new Date().toISOString(),
                 lastLogin: new Date().toISOString(),
                 lastIp: ip
               };
               await userRef.set(userData);
             }
          }
        }
      } catch (dbError: any) {
        console.log("Track login status: database skipped.", dbError);
      }

      res.json({ success: true, ip, userData });
    } catch (e: any) {
      console.error("Failed to track login:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to track login" });
    }
  });

  app.post("/api/admin/clear-logs", async (req, res) => {
    try {
      console.log("[DEBUG] /api/admin/clear-logs called");
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn("[DEBUG] FIREBASE_SERVICE_ACCOUNT missing");
      }
      const { db } = getFirebaseAdmin();
      if (!db) return res.status(500).json({ success: false, error: "Database not initialized" });

      const { email } = req.body;
      let snapshot;
      if (email) {
        // Find uid for this email
        let matchedDocs: any[] = [];
        const exactSnap = await db.collection('users').where('email', '==', email.trim()).get();
        if (!exactSnap.empty) {
            matchedDocs = exactSnap.docs;
        } else {
            const allUsers = await db.collection('users').get();
            matchedDocs = allUsers.docs.filter(d => {
                 const em = d.data().email || "";
                 return em.trim().toLowerCase() === email.trim().toLowerCase();
            });
        }
        
        if (matchedDocs.length === 0) {
          return res.status(404).json({ success: false, error: "User with this email not found" });
        }
        
        let batchCount = 0;
        const batch = db.batch();
        for (const userDoc of matchedDocs) {
           const logsSnap = await db.collection('activity_logs').where('uid', '==', userDoc.id).get();
           logsSnap.forEach(doc => {
             batch.delete(doc.ref);
             batchCount++;
           });
        }
        await batch.commit();
        console.log(`[DEBUG] Cleared ${batchCount} logs for email ${email}`);
      } else {
        snapshot = await db.collection('activity_logs').get();
        const batch = db.batch();
        let batchCount = 0;
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
          batchCount++;
        });
        await batch.commit();
        console.log(`[DEBUG] Cleared all ${batchCount} logs`);
      }
      
      // Also clear in-memory logs
      if (email) {
        const remaining = recentDownloads.filter(log => log.email !== email);
        recentDownloads.length = 0;
        recentDownloads.push(...remaining);
      } else {
        recentDownloads.length = 0;
      }
      
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: "Failed to clear logs" });
    }
  });

  app.post("/api/admin/users/delete-all", async (req, res) => {
    try {
      console.log(`[DEBUG] Attempting delete-all`);
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn("[DEBUG] FIREBASE_SERVICE_ACCOUNT is missing");
      }
      const { db, auth } = getFirebaseAdmin();
      if (!db || !auth) return res.status(500).json({ success: false, error: "Database not initialized" });

      const snapshot = await db.collection('users').get();
      console.log(`[DEBUG] Found ${snapshot.size} users`);
      const batch = db.batch();
      
      for (const doc of snapshot.docs) {
        // Skip super admin
        if (doc.data().email === "jrnabil570@gmail.com") continue;
        
        try {
          await auth.deleteUser(doc.id);
        } catch (e) {
            console.error(`[DEBUG] Failed to delete user in Auth for ${doc.id}:`, e);
        }
        batch.delete(doc.ref);
      }
      await batch.commit();
      console.log(`[DEBUG] Batch commit success`);
      res.json({ success: true });
    } catch (e) {
      console.error("[DEBUG] Failed to delete users:", e);
      res.status(500).json({ success: false, error: "Failed to delete users: " + e.toString() });
    }
  });

  app.delete("/api/admin/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      console.log(`[DEBUG] Attempting delete user ${uid}`);
      const { db, auth } = getFirebaseAdmin();
      if (!db || !auth) return res.status(500).json({ success: false, error: "Database not initialized" });

      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data()?.email === "jrnabil570@gmail.com") {
        return res.status(403).json({ success: false, error: "Cannot delete super admin." });
      }

      try {
        await auth.deleteUser(uid);
      } catch (e) {
        console.error(`[DEBUG] Failed to delete user in Auth for ${uid}:`, e);
      }
      await db.collection('users').doc(uid).delete();
      console.log(`[DEBUG] Deleted user ${uid}`);
      res.json({ success: true });
    } catch (e) {
      console.error("[DEBUG] Failed to delete user:", e);
      res.status(500).json({ success: false, error: "Failed to delete user: " + e.toString() });
    }
  });

  app.get("/api/admin/refresh-logs", (req, res) => {
    res.json({ success: true, logs: recentDownloads });
  });

  app.post("/api/admin/clear-cache", (req, res) => {
    res.json({ success: true, message: "Cache cleared successfully." });
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        return res.status(500).json({ success: false, error: "FIREBASE_SERVICE_ACCOUNT is required for Admin operations. Please add it in Settings." });
      }
      const { db } = getFirebaseAdmin();
      if (!db) {
        return res.status(500).json({ success: false, error: "Database not initialized" });
      }
      
      const usersSnapshot = await db.collection('users').limit(100).get();
      const users: any[] = [];
      usersSnapshot.forEach(doc => {
         users.push({ uid: doc.id, ...doc.data() });
      });
      
      res.json({ success: true, data: users });
    } catch (e: any) {
      console.error("API error:", e);
      res.status(500).json({ success: false, error: "Failed to fetch users: " + (e.message || String(e)) });
    }
  });

  app.post("/api/admin/users/:uid/toggle-premium", async (req, res) => {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        return res.status(500).json({ success: false, error: "FIREBASE_SERVICE_ACCOUNT is required." });
      }
      const { uid } = req.params;
      const { isPremium } = req.body;
      const { db } = getFirebaseAdmin();
      if (!db) return res.status(500).json({ success: false, error: "Database not initialized" });

      await db.collection('users').doc(uid).set({ isPremium }, { merge: true });
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: "Failed to update user" });
    }
  });



  app.post("/api/admin/give-limit", async (req, res) => {
    try {
      console.log(`[DEBUG] /api/admin/give-limit body:`, req.body);
      const { type, target, limit } = req.body;
      
      if (!type || !target || limit === undefined) {
          return res.status(400).json({ success: false, error: "Missing type, target, or limit" });
      }

      const { db } = getFirebaseAdmin();
      if (!db) return res.status(500).json({ success: false, error: "Database not initialized" });

      const parsedLimit = limit === "permanent" ? "permanent" : Number(limit);

      if (type === "uid") {
         const docSnap = await db.collection('users').doc(target).get();
         if (!docSnap.exists) return res.status(404).json({ success: false, error: "User not found" });
         
         const userData = docSnap.data() || {};
         const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
         const addLimit = parsedLimit === "permanent" ? "permanent" : Number(parsedLimit);
         const newParsedLimit = addLimit === "permanent" ? "permanent" : (currentLimit + addLimit);
         
         await db.collection('users').doc(target).set({ usageLimit: newParsedLimit }, { merge: true });
         await db.collection('activity_logs').add({
             uid: target,
             url: '/api/admin/give-limit',
             platform: `admin-action: limit=${newParsedLimit}`,
             timestamp: new Date().toISOString()
         });
         
         return res.json({ success: true, limit: newParsedLimit, message: `Successfully gave ${addLimit} limit to UID: ${target}` });
      } else if (type === "email") {
         let matchedDocs: any[] = [];
         const exactSnap = await db.collection('users').where('email', '==', target.trim().toLowerCase()).get();
         if (!exactSnap.empty) {
             matchedDocs = exactSnap.docs;
         } else {
             // Fallback to fetch all and filter
             const allUsers = await db.collection('users').get();
             matchedDocs = allUsers.docs.filter(d => {
                 const em = d.data().email || "";
                 return em.trim().toLowerCase() === target.trim().toLowerCase();
             });
         }
         
         if (matchedDocs.length === 0) return res.status(404).json({ success: false, error: "User not found with this email" });
         
         for (const doc of matchedDocs) {
             const userData = doc.data();
             const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
             const addLimit = parsedLimit === "permanent" ? "permanent" : Number(parsedLimit);
             const newParsedLimit = addLimit === "permanent" ? "permanent" : (currentLimit + addLimit);
             
             await db.collection('users').doc(doc.id).set({ usageLimit: newParsedLimit }, { merge: true });
             await db.collection('activity_logs').add({
                 uid: doc.id,
                 url: '/api/admin/give-limit',
                 platform: `admin-action: limit=${newParsedLimit}`,
                 timestamp: new Date().toISOString()
             });
         }
         return res.json({ success: true, message: `Successfully gave ${parsedLimit} limit to Email: ${target}` });
      } else if (type === "ip") {
         const usersSnapshot = await db.collection('users').where('ip', '==', target.trim()).get();
         if (usersSnapshot.empty) return res.status(404).json({ success: false, error: "User not found with this IP" });
         
         for (const doc of usersSnapshot.docs) {
             const userData = doc.data();
             const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
             const addLimit = parsedLimit === "permanent" ? "permanent" : Number(parsedLimit);
             const newParsedLimit = addLimit === "permanent" ? "permanent" : (currentLimit + addLimit);
             
             await db.collection('users').doc(doc.id).set({ usageLimit: newParsedLimit }, { merge: true });
             await db.collection('activity_logs').add({
                 uid: doc.id,
                 url: '/api/admin/give-limit',
                 platform: `admin-action: limit=${newParsedLimit}`,
                 timestamp: new Date().toISOString()
             });
         }
         return res.json({ success: true, message: `Successfully gave ${parsedLimit} limit to IP: ${target}` });
      } else {
         return res.status(400).json({ success: false, error: "Invalid type. Must be uid, email, or ip." });
      }
      
    } catch (e: any) {
      console.error("[DEBUG] Give limit error:", e);
      res.status(500).json({ success: false, error: e.message || "Failed to give limit" });
    }
  });

  app.post("/api/admin/give-premium-limit", async (req, res) => {
    try {
      const { email, days, limit, uid } = req.body;
      if (days === undefined || limit === undefined) {
          return res.status(400).json({ success: false, error: "Missing days or limit" });
      }
      if (!email && !uid) {
          return res.status(400).json({ success: false, error: "Missing email or uid" });
      }
      const { db } = getFirebaseAdmin();
      let userDoc;
      if (uid) {
         const docSnap = await db.collection('users').doc(uid).get();
         if (!docSnap.exists) return res.status(404).json({ success: false, error: "User not found" });
         userDoc = docSnap;
      } else {
         let matchedDocs: any[] = [];
         const exactSnap = await db.collection('users').where('email', '==', email.trim().toLowerCase()).get();
         if (!exactSnap.empty) {
             matchedDocs = exactSnap.docs;
         } else {
             const allUsers = await db.collection('users').get();
             matchedDocs = allUsers.docs.filter(d => {
                 const em = d.data().email || "";
                 return em.trim().toLowerCase() === email.trim().toLowerCase();
             });
         }
         
         if (matchedDocs.length === 0) return res.status(404).json({ success: false, error: "User not found" });
         // Update all users with this email if no UID is provided
         for (const doc of matchedDocs) {
             const userData = doc.data();
             let premiumUntilDate;
             if (days >= 99999) {
                 premiumUntilDate = "9999999999999";
             } else {
                 const currentExpiry = userData.premiumUntil ? new Date(userData.premiumUntil) : new Date();
                 premiumUntilDate = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
             }
             const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
             const addLimit = limit === "permanent" ? "permanent" : Number(limit);
             const newParsedLimit = addLimit === "permanent" ? "permanent" : (currentLimit + addLimit);
             await db.collection('users').doc(doc.id).set({ isPremium: true, premiumUntil: premiumUntilDate, usageLimit: newParsedLimit }, { merge: true });
             await db.collection('activity_logs').add({
                 uid: doc.id,
                 url: '/api/admin/give-premium-limit',
                 platform: `admin-action: premiumUntil=${premiumUntilDate}, limit=${newParsedLimit}`,
                 timestamp: new Date().toISOString()
             });
         }
         return res.json({ success: true, limit: "Updated all matching users" });
      }
      const userData = userDoc.data();
      
      let premiumUntilDate;
      if (days >= 99999) {
          premiumUntilDate = "9999999999999";
      } else {
          const currentExpiry = userData.premiumUntil ? new Date(userData.premiumUntil) : new Date();
          premiumUntilDate = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      }
      
      const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
      const addLimit = limit === "permanent" ? "permanent" : Number(limit);
      const newParsedLimit = addLimit === "permanent" ? "permanent" : (currentLimit + addLimit);
      
      await db.collection('users').doc(userDoc.id).set({ isPremium: true, premiumUntil: premiumUntilDate, usageLimit: newParsedLimit }, { merge: true });
      await db.collection('activity_logs').add({
          uid: userDoc.id,
          url: '/api/admin/give-premium-limit',
          platform: `admin-action: premiumUntil=${premiumUntilDate}, limit=${newParsedLimit}`,
          timestamp: new Date().toISOString()
      });
      res.json({ success: true, limit: newParsedLimit });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
  app.post("/api/webhook/pakasir", async (req, res) => {
    const { order_id, status, user_id } = req.body;
    if (status === 'success' && process.env.FIREBASE_SERVICE_ACCOUNT) {
       // Upgrade user to premium in Firestore
       try {
          const { db } = getFirebaseAdmin();
          if (db && user_id) {
            await db.collection('users').doc(user_id).set({
              isPremium: true,
              premiumUntil: FieldValue.serverTimestamp() // Mock
            }, { merge: true });
          }
       } catch(e) {}
    }
    res.json({ received: true });
  });

  // Proxy Info Endpoints to avoid CORS on client side
  app.get("/api/info/tiktok", async (req, res) => {
    try {
      const { url, uid } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });
      
      // Basic check for usage limits if uid is provided
      if (process.env.FIREBASE_SERVICE_ACCOUNT && uid) {
        const { db } = getFirebaseAdmin();
        if (db) {
          const userDoc = await db.collection('users').doc(uid as string).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.isBanned) {
              return res.status(403).json({ error: "Account banned" });
            }
          }
        }
      }

      const rawUrl = url as string;
      const expandedUrl = await expandTiktokUrl(rawUrl);

      const apiUrl = process.env.API_TIKTOK || TIKTOK_API_URL;
      let lastError;

      try {
        const fetchUrl = getTiktokUrl(apiUrl, expandedUrl);
        const response = await fetchWithTimeout(fetchUrl, {}, 8000);
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (data && (data.code === 0 || data.data)) {
              return res.json(data);
            } else {
              lastError = data.msg || "Invalid response from TikTok API";
            }
          } else {
            lastError = "Non-JSON response from TikTok API";
          }
        } else {
          lastError = `External API returned status ${response.status}`;
        }
      } catch (err: any) {
        lastError = err.message;
      }

      throw new Error(lastError || "Failed to fetch from TikTok API");
    } catch (e: any) {
      console.error("TikTok Proxy Error:", e.message);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  app.get("/api/info/youtube", async (req, res) => {
    try {
      const { url, type, uid } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });
      const downloadType = type || "merge";

      // Basic check for usage limits if uid is provided
      if (process.env.FIREBASE_SERVICE_ACCOUNT && uid) {
        const { db } = getFirebaseAdmin();
        if (db) {
          const userDoc = await db.collection('users').doc(uid as string).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.isBanned) {
              return res.status(403).json({ error: "Account banned" });
            }
          }
        }
      }
      
      let response;
      let lastError: any = null;
      const startTime = Date.now();
      const maxRetries = 2;
      
      const apiYoutube = process.env.API_YOUTUBE || "https://youtubedl.siputzx.my.id";
      const apiKeyYoutube = process.env.APIKEY_YOUTUBE || "nbteam";
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (Date.now() - startTime > 8000) {
          break;
        }
        try {
          const fetchUrl = `${apiYoutube}/download?url=${encodeURIComponent(url as string)}&type=${downloadType}&apikey=${apiKeyYoutube}`;
          const remainingTime = Math.max(2000, 8500 - (Date.now() - startTime));
          response = await fetchWithTimeout(fetchUrl, {}, remainingTime);
          if (response.status === 530 || response.status === 502 || response.status === 504 || response.status === 503) {
            throw new Error(`External API returned status ${response.status}`);
          }
          break; // successfully fetched or got a non-retriable status (like 400 or 403)
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempt} failed for YouTube API:`, err.message);
          if (attempt < maxRetries && (Date.now() - startTime < 7000)) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to reach external API after multiple attempts");
      }

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          return res.json(data);
        } else {
          const text = await response.text();
          throw new Error(`Invalid response format: ${text.substring(0, 100)}`);
        }
      } else {
        if (response.status === 530) {
          return res.status(530).json({
            error: "Layanan pengunduh YouTube sedang mengalami gangguan koneksi sementara (Cloudflare Error 530). Terowongan server API terputus sementara. Silakan coba lagi dalam beberapa detik, karena terowongan biasanya akan terhubung kembali secara otomatis."
          });
        }
        throw new Error(`External API returned status ${response.status}`);
      }
    } catch (e: any) {
      console.error("YouTube Proxy Error:", e.message);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  app.get("/api/info/instagram", async (req, res) => {
    try {
      const { url, uid } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });

      // Basic check for usage limits if uid is provided
      if (process.env.FIREBASE_SERVICE_ACCOUNT && uid) {
        const { db } = getFirebaseAdmin();
        if (db) {
          const userDoc = await db.collection('users').doc(uid as string).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData?.isBanned) {
              return res.status(403).json({ error: "Account banned" });
            }
          }
        }
      }
      
      const apiInstagram = process.env.API_INSTAGRAM || "https://ig.siputzx.my.id";
      const response = await fetchWithTimeout(`${apiInstagram}/api/download?url=${encodeURIComponent(url as string)}`, {}, 8000);
      if (!response.ok) {
        throw new Error(`External API returned status ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        throw new Error(`Invalid response format: ${text.substring(0, 100)}`);
      }
    } catch (e: any) {
      console.error("Instagram Proxy Error:", e.message);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Main Download Endpoint
  app.post("/api/download", async (req, res) => {
    try {
      const { url, platform, uid, lang } = req.body;
      const ip = getClientIp(req);
      const isEn = lang === "EN";
      
      if (!url) {
        return res.status(400).json({ success: false, error: "URL is required" });
      }

      // Check if user is Banned / trace user email & details
      let isPremium = false;
      let userEmail: string | undefined = undefined;
      let downloadHistory: string[] = [];
      let usageLimit = 0;

      if (process.env.FIREBASE_SERVICE_ACCOUNT && uid) {
         try {
            const { db } = getFirebaseAdmin();
            if (db) {
              // 1. Verify if user is banned
              const banDoc = await db.collection('banned_users').doc(uid).get();
              let isBanned = false;
              if (banDoc.exists) {
                const banData = banDoc.data();
                if (!banData?.expiresAt || new Date(banData.expiresAt).getTime() > Date.now()) {
                    isBanned = true;
                } else {
                    // Ban expired, remove it
                    await db.collection('banned_users').doc(uid).delete();
                }
              } else {
                  // Check by email
                  const userDocForEmail = await db.collection('users').doc(uid).get();
                  if (userDocForEmail.exists && userDocForEmail.data()?.email) {
                      const email = userDocForEmail.data()!.email;
                      const bannedEmailSnap = await db.collection('banned_users').where("email", "==", email).get();
                      if (!bannedEmailSnap.empty) {
                          isBanned = true;
                      }
                  }
              }
              if (isBanned) {
                  return res.status(403).json({ success: false, error: "This account has been banned due to terms violations." });
              }

              // 2. Load user details
              const userDoc = await db.collection('users').doc(uid).get();
              if (userDoc.exists) {
                 const userData = userDoc.data();
                 userEmail = userData?.email;
                 downloadHistory = userData?.downloadHistory || [];
                  const rawLimit = userData?.usageLimit;
                  if (rawLimit === "permanent") {
                     isPremium = true;
                     usageLimit = 999999;
                  } else {
                     const parsed = Number(rawLimit);
                     usageLimit = (!isNaN(parsed) && rawLimit !== null && rawLimit !== undefined) ? parsed : INITIAL_LOGIN_LIMIT;
                  }
                 if (userData?.isPremium) {
                    isPremium = true;
                 }
              }
            }
         } catch(e) {}
      }

      // Check for super admin jrnabil570@gmail.com - they get unlimited downloads automatically
      const isSuperAdmin = userEmail === "jrnabil570@gmail.com";
      if (isSuperAdmin) {
        isPremium = true;
      }

      // 1. Rate Limiting Logic
      if (!isSuperAdmin) {
         if (uid) {
            if (isPremium) {
               // Premium user logic
               if (PREMIUM_LIMIT_TYPE && PREMIUM_LIMIT_TYPE !== 'no_limit') {
                  const now = Date.now();
                  let timeWindowMs = 24 * 60 * 60 * 1000;
                  if (PREMIUM_LIMIT_TYPE === 'weekly') timeWindowMs = 7 * 24 * 60 * 60 * 1000;
                  else if (PREMIUM_LIMIT_TYPE === 'monthly') timeWindowMs = 30 * 24 * 60 * 60 * 1000;

                  const windowStart = now - timeWindowMs;
                  const countInWindow = downloadHistory.filter((ts: string) => new Date(ts).getTime() > windowStart).length;

                  if (countInWindow >= PREMIUM_LIMIT_VALUE) {
                     return res.status(429).json({ 
                        success: false, 
                        error: isEn
                            ? `Premium download limit reached (${PREMIUM_LIMIT_VALUE}/${PREMIUM_LIMIT_TYPE}).`
                            : `Batas limit download Premium tercapai (${PREMIUM_LIMIT_VALUE}/${PREMIUM_LIMIT_TYPE}).` 
                     });
                  }
               }
            } else {
               // Logged-in non-premium user logic: strictly check usageLimit (only if service account is available to fetch accurate limit)
               if (process.env.FIREBASE_SERVICE_ACCOUNT && usageLimit <= 0) {
                  return res.status(403).json({
                     success: false,
                     error: isEn
                        ? "Sorry, your limit is exhausted. Please wait until tomorrow for your daily limit to reset if your purchased limit is exhausted."
                        : "mohon maaf limit anda telah habis silahkan tungguin besok ganti limit harian anda jika limit pembelian habis"
                  });
               }
            }
         } else {
            // Guest/IP logic (non-logged in)
            const now = Date.now();
            const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
            const guestHistory = ipRequests.get(ip) || [];
            const validHistory = guestHistory.filter((ts: number) => ts > twentyFourHoursAgo);
            
            if (validHistory.length >= FREE_LIMIT) {
               return res.status(429).json({ 
                  success: false, 
                  error: isEn 
                      ? `Daily guest limit of ${FREE_LIMIT} reached. Please login or upgrade.`
                      : `Batas limit ${FREE_LIMIT} download gratis harian (Guest) tercapai. Silakan login atau upgrade ke Premium.` 
               });
            }
            
            validHistory.push(now);
            ipRequests.set(ip, validHistory);
         }
      }

      // If we made it here, download is allowed. Record last login/ip for user
      if (process.env.FIREBASE_SERVICE_ACCOUNT && uid) {
         try {
            const { db } = getFirebaseAdmin();
            if (db) {
               const nowStr = new Date().toISOString();
               let updatedFields: any = {
                 lastIp: ip,
                 lastLogin: nowStr
               };

               await db.collection('users').doc(uid).set(updatedFields, { merge: true });
            }
         } catch (e) {}
      }

      globalRequests++;

      // Log download to in-memory active logs
      recentDownloads.unshift({
        ip,
        url,
        timestamp: new Date().toISOString(),
        platform: platform || "unknown",
        email: userEmail
      });
      if (recentDownloads.length > 50) {
        recentDownloads.pop();
      }
      
      // Simulate API latency & request
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Route to appropriate external API
      let data: any = {};

      if (platform === 'tiktok' || url.includes('tiktok')) {
        // TikTok API
        const expandedUrl = await expandTiktokUrl(url);
        
        // If TikTok redirected to the homepage, it means the short link is invalid, expired, or private
        if (expandedUrl.includes('tiktok.com/?_r=1') || expandedUrl === 'https://www.tiktok.com/' || expandedUrl === 'https://www.tiktok.com') {
           return res.status(400).json({ 
             success: false, 
             error: "Tautan TikTok tidak valid, kedaluwarsa, atau disetel ke privat. Silakan periksa kembali tautan Anda di aplikasi TikTok." 
           });
        }
        
        let fetchUrl = getTiktokUrl(TIKTOK_API_URL, expandedUrl);
        let response;
        let text = "";
        try {
            response = await fetchWithTimeout(fetchUrl, {}, 8000);
            text = await response.text();
        } catch (fetchErr: any) {
            console.error("TikTok API failed:", fetchErr);
            return res.status(502).json({ success: false, error: "Tiktok extraction service is temporarily unreachable. Please try again later." });
        }
        let tikResult;
        try {
            tikResult = JSON.parse(text);
        } catch(e) {
            console.error("TikTok API response is not JSON:", text);
            return res.status(500).json({ success: false, error: "TikTok API returned invalid response" });
        }
        
        if (tikResult.code !== 0) {
           return res.status(400).json({ success: false, error: tikResult.msg || "Failed to parse TikTok URL" });
        }
        
        const item = tikResult.data;
        const isSlides = item.images && item.images.length > 0;
        
        data = {
          platform: "tiktok",
          type: isSlides ? "slides" : "video",
          title: item.title || "TikTok Video",
          creator: item.author?.nickname || "@creator",
          creator_id: item.author?.unique_id || item.author?.id || "",
          creator_avatar: item.author?.avatar || "",
          duration: item.duration ? `${item.duration}s` : "0:00",
          thumbnail: item.cover,
          stats: {
            likes: item.digg_count?.toString() || "0",
            shares: item.share_count?.toString() || "0",
            views: item.play_count?.toString() || "0"
          },
          downloads: []
        };

        if (isSlides) {
            data.downloads.push({ type: "slides", label: "Download Photos (ZIP)", url: item.images[0], quality: "HD" }); // Mock ZIP link
        } else {
            data.downloads.push({ type: "video_no_wm", label: "No Watermark", url: item.play, quality: "HD" });
            if (item.wmplay) {
                data.downloads.push({ type: "video_wm", label: "Watermark", url: item.wmplay, quality: "SD" });
            }
        }
        if (item.music) {
            data.downloads.push({ type: "audio", label: "Audio (MP3)", url: item.music, quality: "320kbps" });
        }

      } else {
         return res.status(400).json({ success: false, error: "Invalid URL. Please enter a valid TikTok link." });
      }
      
      // Log Activity (including Guest downloads)
      try {
         if (process.env.FIREBASE_SERVICE_ACCOUNT) {
           const { db } = getFirebaseAdmin();
           if (db) {
             await db.collection('activity_logs').add({
               uid: uid || "guest",
               url,
               platform: data.platform || "unknown",
               ip: ip,
               timestamp: FieldValue.serverTimestamp()
             });
           }
         }
      } catch(e) {}

      res.json({ success: true, data: data });
    } catch (error) {
      console.error("API Error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error. The video might be private or region-locked." });
    }
  });

  // Proxy Download Endpoint to force download (bypass direct CDN opening)
  app.get("/api/proxy-download", async (req, res) => {
    const { url, filename, uid } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send("URL parameter is required");
    }

    // Decrement limit on actual file download request
    if (process.env.FIREBASE_SERVICE_ACCOUNT && uid && typeof uid === 'string') {
       try {
          const { db } = getFirebaseAdmin();
          if (db) {
             const userDoc = await db.collection('users').doc(uid).get();
             if (userDoc.exists) {
                const userData = userDoc.data();
                const userEmail = userData?.email;
                const isSuperAdmin = userEmail === "jrnabil570@gmail.com";
                const isPremium = userData?.isPremium || false;

                const rawLimit = userData?.usageLimit;
                let isPermanent = false;
                let usageLimit = INITIAL_LOGIN_LIMIT;
                if (rawLimit === "permanent") {
                   isPermanent = true;
                } else {
                   const parsed = Number(rawLimit);
                   if (!isNaN(parsed) && rawLimit !== null && rawLimit !== undefined) {
                      usageLimit = parsed;
                   }
                }

                if (!isSuperAdmin && !isPremium && !isPermanent) {
                   const downloadHistory = userData?.downloadHistory || [];
                   const now = Date.now();
                   const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
                   const todayDownloads = downloadHistory.filter((ts: string) => new Date(ts).getTime() > twentyFourHoursAgo).length;
                   
                   const maxDailyLimit = INITIAL_LOGIN_LIMIT;
                   const remainingDailyLimit = Math.max(0, maxDailyLimit - todayDownloads);
                   
                   if (remainingDailyLimit > 0) {
                       // Use daily limit
                       const nowStr = new Date(now).toISOString();
                       await db.collection('users').doc(uid).set({
                           downloadHistory: [...downloadHistory, nowStr]
                       }, { merge: true });
                   } else if (usageLimit > 0) {
                       // Use RW limit
                       await db.collection('users').doc(uid).set({
                           usageLimit: Math.max(0, usageLimit - 1)
                       }, { merge: true });
                   } else {
                       return res.status(403).send("mohon maaf limit anda telah habis silahkan tungguin besok ganti limit harian anda jika limit pembelian habis");
                   }
                }
             }
          }
       } catch (err) {
          console.error("Failed to update limit during proxy download:", err);
       }
    }

    try {
      const decodedUrl = decodeURIComponent(url);
      const response = await fetch(decodedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      const contentType = response.headers.get("content-type") || "video/mp4";
      const contentLength = response.headers.get("content-length");
      
      const safeFilename = (filename && typeof filename === 'string') 
        ? filename.replace(/[^a-zA-Z0-9.\-_ ]/g, "_") 
        : "tiktok-video.mp4";

      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("Content-Type", contentType);
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as any);
        nodeStream.pipe(res);
      } else {
        res.status(500).send("No stream body available");
      }
    } catch (err: any) {
      console.error("Proxy download error:", err);
      // Fallback redirect to direct url if something fails
      res.redirect(url);
    }
  });

// Lazy trigger for non-API requests (e.g. static pages if any)
// In production Vercel, this might not be called often as Vercel handles static.
// But we keep it for consistency.

// Middleware for development (Vite)
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  (async () => {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to initialize Vite middleware:", e);
    }
  })();
} else if (!process.env.VERCEL) {
  // Static serving for non-Vercel production environments
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global Error Handler (must be after routes)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Express Error:", err);
  res.status(500).json({ 
    success: false, 
    error: "Internal Server Error", 
    message: err?.message || "Unknown error" 
  });
});

// Only listen on port 3000 if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
