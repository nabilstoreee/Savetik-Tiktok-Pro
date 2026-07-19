/** * @license * SPDX-License-Identifier: Apache-2.0 */ import React, {
  useState,
  useEffect,
} from "react";
import { ProductsView } from "./components/ProductsView";
import { AdminProductsView } from "./components/AdminProductsView";
import { CustomAudioPlayer } from "./components/CustomAudioPlayer";
import {
  Video,
  Youtube,
  Instagram,
  Link as LinkIcon,
  Download,
  ClipboardPaste,
  Clock,
  Bookmark,
  AlertTriangle,
  PlayCircle,
  X,
  Check,
  Heart,
  Share2,
  Eye,
  Flag,
  Trash2,
  Globe,
  ChevronRight,
  Settings,
  Users,
  Activity,
  BarChart,
  ShieldAlert,
  LogOut,
  LayoutDashboard,
  UserCircle,
  LogIn,
  Crown,
  EyeOff,
  ShoppingBag,
  Zap,
  Copy,
  Menu,
  Palette,
  Home,
  HelpCircle,
  FileText,
  HeartHandshake,
  MessageSquare,
  Smartphone,
  Moon,
  Sun,
  Send,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  auth,
  loginWithGoogle,
  logout,
  checkPremiumStatus,
  getAllUsers,
  updateUserPremium,
  db,
  getGlobalSettings,
  updateGlobalSettings,
  getBannedIps,
  addBannedIp,
  removeBannedIp,
  getBannedUsers,
  addBannedUser,
  removeBannedUser,
  addActivityLog,
  getActivityLogs,
  grantPremiumByEmail,
  deleteAccount,
  onSnapshot,
  addFeedback,
  subscribeFeedbacks,
  updateFeedbackStatus,
  deleteFeedback,
} from "./lib/firebase";


const grantLimitToTarget = async (type: "uid" | "email" | "ip", target: string, limit: number | string) => {
    let matchedDocs: any[] = [];
    if (type === "uid") {
        const uDoc = await getDoc(doc(db, "users", target.trim()));
        if (uDoc.exists()) matchedDocs = [uDoc];
    } else if (type === "email") {
        const allSnap = await getDocs(collection(db, "users"));
        matchedDocs = allSnap.docs.filter(d => (d.data().email || "").trim().toLowerCase() === target.trim().toLowerCase());
    } else if (type === "ip") {
        const allSnap = await getDocs(collection(db, "users"));
        matchedDocs = allSnap.docs.filter(d => (d.data().ip || "").trim() === target.trim());
    }
    
    if (matchedDocs.length === 0) {
        throw new Error(`User not found with ${type}: ${target}`);
    }
    
    for (const docSnap of matchedDocs) {
        const userData = docSnap.data();
        const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
        const addLimit = limit === "permanent" ? "permanent" : Number(limit);
        const newLimit = addLimit === "permanent" ? "permanent" : currentLimit + addLimit;
        
        await setDoc(doc(db, "users", docSnap.id), { usageLimit: newLimit }, { merge: true });
        
        // Optionally add activity log
        try {
            await addActivityLog(docSnap.id, "/api/admin/give-limit", `admin-action: limit=${newLimit}`);
        } catch (e) {}
    }
    return { success: true };
}

const grantPremiumWithLimitByEmail = async (email: string, days: number, limit: number | string, uid?: string) => {
    let matchedDocs: any[] = [];
    if (uid) {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) matchedDocs = [docSnap];
    } else {
        const allSnap = await getDocs(collection(db, "users"));
        matchedDocs = allSnap.docs.filter(d => (d.data().email || "").trim().toLowerCase() === email.trim().toLowerCase());
    }
    
    if (matchedDocs.length === 0) {
        throw new Error("User not found");
    }
    
    for (const docSnap of matchedDocs) {
        const userData = docSnap.data();
        let premiumUntilDate;
        if (days >= 99999) {
            premiumUntilDate = new Date();
            premiumUntilDate.setFullYear(premiumUntilDate.getFullYear() + 100);
        } else {
            premiumUntilDate = new Date();
            premiumUntilDate.setDate(premiumUntilDate.getDate() + days);
        }
        
        const currentLimit = (userData.usageLimit === "permanent" || userData.usageLimit === undefined || userData.usageLimit === null) ? 0 : Number(userData.usageLimit);
        const addLimit = limit === "permanent" ? "permanent" : Number(limit);
        const newLimit = addLimit === "permanent" ? "permanent" : currentLimit + addLimit;
        
        await setDoc(doc(db, "users", docSnap.id), { 
            isPremium: true, 
            premiumUntil: premiumUntilDate.toISOString(), 
            usageLimit: newLimit 
        }, { merge: true });
        
        try {
            await addActivityLog(docSnap.id, "/api/admin/give-premium-limit", `admin-action: premium=${days}days limit=${newLimit}`);
        } catch (e) {}
    }
    return { success: true, email };
}

import { updatePassword as updateAuthPassword } from "./lib/firebase";
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { CustomVideoPlayer } from "./components/CustomVideoPlayer";

// Safe JSON serialization helper to prevent "Converting circular structure to JSON" crashes
const safeStringify = (obj: any): string => {
  try {
    const cache = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (cache.has(value)) {
          return "[Circular]";
        }
        cache.add(value);
      }
      return value;
    });
  } catch (err) {
    console.error("JSON serialization failed:", err);
    // Return a safe fallback that doesn't cause a crash
    try {
      if (typeof obj === "object" && obj !== null) {
        // Create a shallow copy of own properties to avoid deep circularity
        const shallow: any = {};
        for (const k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            const val = obj[k];
            shallow[k] = (typeof val === "object" && val !== null) ? "[Object]" : val;
          }
        }
        return JSON.stringify(shallow);
      }
      return String(obj);
    } catch (e) {
      return "{}";
    }
  }
};


const THEMES = [
  { id: "default", name: "Putih (Mode Terang)", icon: "⚪️" },
  { id: "tactical", name: "Hitam (Mode Gelap)", icon: "⚫️" },
];

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [language, setLanguage] = useState<"EN" | "ID">("EN");
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("user-theme") || "default";
  });

  /* Feedback form states */
  const [feedbackCategory, setFeedbackCategory] = useState<"fitur" | "bug">("fitur");
  const [feedbackDetails, setFeedbackDetails] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackConfirmDeleteId, setFeedbackConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (theme === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const [showPlayer, setShowPlayer] = useState(false);
  const [activeTab, setActiveTab] = useState<"history" | "bookmarks">(
    "history",
  );
  /* Auth & Premium states */ const [user, setUser] = useState<User | null>(
    null,
  );
  const [userData, setUserData] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  /* Premium & Profile requested states */
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [countdownStr, setCountdownStr] = useState<string>("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "forgot">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoadingState, setAuthLoadingState] = useState(false);
  const [premiumEmail, setPremiumEmail] = useState("");
  const [premiumDays, setPremiumDays] = useState(1);
  const [premiumBonusEmail, setPremiumBonusEmail] = useState("");
  const [premiumBonusDays, setPremiumBonusDays] = useState(1);
  const [giveLimitType, setGiveLimitType] = useState<"uid" | "email" | "ip">("email");
  const [giveLimitTarget, setGiveLimitTarget] = useState("");
  const [giveLimitValue, setGiveLimitValue] = useState("10");

  const [products, setProducts] = useState<any[]>([]);

  const getFriendlyAuthError = (err: any): string => {
    if (!err) return "";
    const code = err.code || "";
    const message = err.message || String(err);

    if (code === "auth/invalid-credential" || message.includes("invalid-credential") || message.includes("auth/invalid-credential")) {
      return "Email atau password yang Anda masukkan salah. Silakan periksa kembali data Anda dan coba lagi.";
    }
    if (code === "auth/user-not-found" || message.includes("user-not-found")) {
      return "Email tidak terdaftar. Silakan daftar akun baru terlebih dahulu.";
    }
    if (code === "auth/wrong-password" || message.includes("wrong-password")) {
      return "Password yang Anda masukkan salah. Silakan coba lagi.";
    }
    if (code === "auth/invalid-email" || message.includes("invalid-email")) {
      return "Format email tidak valid. Pastikan penulisan email sudah benar.";
    }
    if (code === "auth/email-already-in-use" || message.includes("email-already-in-use")) {
      return "Email sudah terdaftar. Silakan gunakan email lain atau langsung masuk.";
    }
    if (code === "auth/weak-password" || message.includes("weak-password")) {
      return "Password terlalu lemah. Password minimal harus terdiri dari 6 karakter.";
    }
    if (code === "auth/too-many-requests" || message.includes("too-many-requests")) {
      return "Terlalu banyak percobaan masuk yang gagal. Akun Anda telah ditangguhkan sementara demi keamanan. Silakan coba lagi nanti.";
    }
    if (code === "auth/unauthorized-domain" || message.includes("unauthorized-domain")) {
      return "Domain aplikasi ini belum diizinkan untuk login Google di Firebase. Silakan buka Firebase Console -> Authentication -> Settings, lalu tambahkan domain '" + window.location.hostname + "' ke dalam daftar 'Authorized Domains'.";
    }
    if (code === "auth/popup-closed-by-user" || message.includes("popup-closed-by-user") || message.includes("Pending promise was never set") || message.includes("popup-blocked")) {
      return "Proses masuk dibatalkan atau popup diblokir. Pastikan Anda mengizinkan popup, atau gunakan login dengan Email/Password sebagai alternatif.";
    }
    if (code === "auth/network-request-failed" || message.includes("network-request-failed")) {
      return "Koneksi jaringan gagal. Silakan periksa koneksi internet Anda.";
    }

    if (message.startsWith("Firebase: Error")) {
      return message.replace("Firebase: Error", "Error Firebase").replace(/\((.*?)\)/g, "($1)");
    }
    return message;
  };

  /* New States for requested features */ const [view, setView] = useState<
    "main" | "admin" | "support_donation" | "restrictions" | "how_to_use" | "feedback"
  >("main");
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [adminTab, setAdminTab] = useState<
    "dashboard" | "users" | "give_premium" | "give_premium_bonus" | "banned" | "api_status" | "ads" | "settings" | "products" | "give_limit" | "feedbacks"
  >("dashboard");
  const [platformTab, setPlatformTab] = useState<"tiktok" | "youtube" | "instagram">(
    "tiktok",
  );
  const [adminData, setAdminData] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  /* Settings & Ban management states */ const [
    globalSettings,
    setGlobalSettings,
  ] = useState<{
    isMaintenance: boolean;
    freeLimit: number;
    loginLimit: number;
    initialLimit: number;
    systemNotice: string;
    tiktokApiUrl?: string;
        adsEnabled?: boolean;
    ads?: {
      bannerTopEnabled: boolean;
      bannerTopCode: string;
      bannerBottomEnabled: boolean;
      bannerBottomCode: string;
      popunderEnabled: boolean;
      popunderCode: string;
    };
    antiAdblockEnabled?: boolean;
    antiAdblockBlockDownloads?: boolean;
    premiumLimitType?: "no_limit" | "daily" | "weekly" | "monthly";
    premiumLimitValue?: number;
    websiteName?: string;
    qrisImageUrl?: string;
    contactOwnerUrl?: string;
    websiteBuyOtomatisUrl?: string;
    scanQrisText?: string;
  }>({
    isMaintenance: false,
    freeLimit: 5,
    loginLimit: 5,
    initialLimit: 5,
    systemNotice: "",
    tiktokApiUrl: "https://www.tikwm.com/api/",
        adsEnabled: true,
    ads: {
      bannerTopEnabled: true,
      bannerTopCode:
        "<!-- Default Banner Top Ad Slot -->\n<div class='p-4 bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] border-4 border-theme-border rounded-xl text-center text-xs text-gray-600 font-mono font-mono'>AD_SLOT_TOP_BANNER</div>",
      bannerBottomEnabled: true,
      bannerBottomCode:
        "<!-- Default Banner Bottom Ad Slot -->\n<div class='p-4 bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] border-4 border-theme-border rounded-xl text-center text-xs text-gray-600 font-mono font-mono'>AD_SLOT_BOTTOM_BANNER</div>",
      popunderEnabled: false,
      popunderCode:
        "<!-- Default Popunder script/iframe -->\n<script>console.log('Popunder simulated');</script>",
    },
    antiAdblockEnabled: true,
    antiAdblockBlockDownloads: false,
    premiumLimitType: "no_limit",
    premiumLimitValue: 100,
    websiteName: "SAVETIK",
    qrisImageUrl: "/src/assets/images/qris_donation_1784202976592.jpg",
    contactOwnerUrl: "https://wa.me/628888573485",
    websiteBuyOtomatisUrl: "https://download.amane-acel.web.id",
    scanQrisText: "Scan QRIS di atas buat donasi suka-suka",
  });
  const [userIsBanned, setUserIsBanned] = useState(false);
  const [banReason, setBanReason] = useState("");
  /* AdBlock States */ const [adBlockDetected, setAdBlockDetected] =
    useState(false);
  const [showAdBlockModal, setShowAdBlockModal] = useState(false);
  /* API Health States */ const [apiHealth, setApiHealth] = useState<any>(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(false);
  const [apiHealthError, setApiHealthError] = useState<string | null>(null);
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [newBanIp, setNewBanIp] = useState("");
  const [newBanIpReason, setNewBanIpReason] = useState("");
  const [newBanUserId, setNewBanUserId] = useState("");
  const [newBanUserEmail, setNewBanUserEmail] = useState("");
  const [newBanUserReason, setNewBanUserReason] = useState("");
  const [newBanDuration, setNewBanDuration] = useState("permanent");
  /* Translations mock */ const t = {
    EN: {
      title: "Professional Video Extraction Tool",
      placeholder:
        platformTab === "tiktok"
          ? "Enter TikTok URL..."
          : "",
      fetch: "Fetch Video",
      fetching: "Fetching...",
      paste: "Paste",
      recent: "Recent",
      bookmarks: "Bookmarks",
      noHistory: "No recent downloads",
      noBookmarks: "No bookmarks saved",
      report: "Report Broken Link",
      reported: "Reported!",
      play: "Play Preview",
      login: "Login",
      logout: "Logout",
      pro: "Get Pro",
      subtitle: "Instantly extract and save videos or slide collections directly from TikTok in Full HD quality without watermarks.",
      pasteBtn: "📋 PASTE",
      clearBtn: "Clear",
      allRights: "All rights reserved.",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
    },
    ID: {
      title: "Alat Ekstraksi Video Profesional",
      placeholder:
        platformTab === "tiktok"
          ? "Masukkan URL TikTok..."
          : "",
      fetch: "Ambil Video",
      fetching: "Mengambil...",
      paste: "Tempel",
      recent: "Terbaru",
      bookmarks: "Disimpan",
      noHistory: "Belum ada riwayat",
      noBookmarks: "Belum ada simpanan",
      report: "Laporkan Link Rusak",
      reported: "Dilaporkan!",
      play: "Putar Preview",
      login: "Masuk",
      logout: "Keluar",
      pro: "Dapatkan Pro",
      subtitle: "Ekstrak dan simpan video atau koleksi slide langsung dari TikTok dalam kualitas Full HD tanpa tanda air secara instan.",
      pasteBtn: "📋 TEMPEL",
      clearBtn: "Bersihkan",
      allRights: "Semua hak dilindungi undang-undang.",
      termsOfService: "Ketentuan Layanan",
      privacyPolicy: "Kebijakan Privasi",
    },
  };
  useEffect(() => {
    const savedHistory = localStorage.getItem("savetik_history");
    const savedBookmarks = localStorage.getItem("savetik_bookmarks");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    const loadSettings = async () => {
      try {
        const settings = await getGlobalSettings();
        setGlobalSettings(settings);
        /* Synchronize settings with the server */ await fetch(
          "/api/admin/sync-settings",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: safeStringify({
              isMaintenance: settings.isMaintenance,
              freeLimit: settings.freeLimit,
              loginLimit: settings.loginLimit,
              initialLimit: settings.initialLimit,
              tiktokApiUrl: settings.tiktokApiUrl,
            }),
          },
        );
      } catch (e) {}
    };
    loadSettings();
    /* Firebase Auth Listener */ let unsubscribe: () => void;
    const timeout = setTimeout(() => {
      unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          let isPrem = false;
          let premUntil = null;
          try {
            const uRef = doc(db, "users", currentUser.uid);
            const uSnap = await getDoc(uRef);
            if (uSnap.exists()) {
              const uData = uSnap.data();
              setUserData(uData);
              isPrem = uData.isPremium || false;
              premUntil = uData.premiumUntil || null;
              if (isPrem && premUntil) {
                const expiryDate = new Date(premUntil);
                if (expiryDate.getTime() < Date.now()) {
                  isPrem = false;
                }
              }
              if (!uData.email || !uData.displayName) {
                await setDoc(uRef, {
                  email: currentUser.email || uData.email || "",
                  displayName: currentUser.displayName || uData.displayName || "Anonymous User",
                }, { merge: true });
              }
            } else {
              await setDoc(uRef, {
                email: currentUser.email,
                displayName: currentUser.displayName || "Anonymous User",
                isPremium: false,
                usageLimit: globalSettings.initialLimit || 5,
                premiumUntil: null,
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch (e: any) {
            if (e?.message?.includes("offline") || e?.code === "unavailable") {
              console.warn("Firestore offline during user verification. Relying on server-side session tracking.");
            } else {
              console.error("Error verifying or writing user to Firestore:", e instanceof Error ? e.message : String(e));
            }
          }
          setIsPremium(isPrem);
          setPremiumUntil(premUntil);
          /* Track user login and IP in background */ fetch(
            "/api/track-login",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: safeStringify({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
              }),
            },
          )
            .then(async (response) => {
              if (response.ok) {
                let data;
                const contentType = response.headers.get("content-type");
                if (
                  contentType &&
                  contentType.indexOf("application/json") !== -1
                ) {
                  data = await response.json();
                } else {
                  throw new Error("Received non-JSON response from server");
                }

                if (data.success && data.ip) {
                  if (data.userData) {
                    setUserData(data.userData);
                    let serverIsPrem = data.userData.isPremium || false;
                    let serverPremUntil = data.userData.premiumUntil || null;
                    if (serverIsPrem && serverPremUntil) {
                      const expiryDate = new Date(serverPremUntil);
                      if (expiryDate.getTime() < Date.now()) {
                        serverIsPrem = false;
                      }
                    }
                    setIsPremium(serverIsPrem);
                    setPremiumUntil(serverPremUntil);
                  }

                  try {
                    const userRef = doc(db, "users", currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    const currentData = userSnap.exists()
                      ? userSnap.data()
                      : {};
                    await setDoc(
                      userRef,
                      {
                        email: currentUser.email || "",
                        displayName: currentUser.displayName || "",
                        photoURL: currentUser.photoURL || "",
                        lastLogin: new Date().toISOString(),
                        lastIp: data.ip,
                        isPremium: currentData.isPremium || false,
                      },
                      { merge: true },
                    );
                  } catch (clientDbErr: any) {
                    if (clientDbErr?.message?.includes("offline") || clientDbErr?.code === "unavailable") {
                      console.warn("Firestore offline, skipping client-side user login update.");
                    } else {
                      console.error(
                        "Client failed to update user login details in Firestore:",
                        clientDbErr instanceof Error ? clientDbErr.message : String(clientDbErr)
                      );
                    }
                  }
                }
              }
            })
            .catch(() => {});
          /* Check if user is banned */ try {
            const userBanRef = doc(db, "banned_users", currentUser.uid);
            const userBanSnap = await getDoc(userBanRef);
            if (userBanSnap.exists()) {
              setUserIsBanned(true);
              setBanReason(userBanSnap.data().reason || "No reason specified");
            } else {
              setUserIsBanned(false);
            }
          } catch (e) {}
        } else {
          setIsPremium(false);
          setPremiumUntil(null);
          setUserIsBanned(false);
        }
        setAuthLoading(false);
      },
    );
    }, 100);
    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Premium ticking countdown effect
  useEffect(() => {
    if (!user) {
        setUserData(null);
        return;
    }
    const q = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(q, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const uData = docSnapshot.data();
            setUserData(uData);
            let isPrem = uData.isPremium || false;
            let premUntil = uData.premiumUntil || null;
            if (isPrem && premUntil) {
              const expiryDate = new Date(premUntil);
              if (expiryDate.getTime() < Date.now()) {
                isPrem = false;
              }
            }
            setIsPremium(isPrem);
            setPremiumUntil(premUntil);
        }
    }, (error) => {
        console.warn("onSnapshot failed (possibly offline):", error.message);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!premiumUntil || !isPremium) {
      setCountdownStr("");
      return;
    }

    const updateCountdown = () => {
      if (user?.email === "jrnabil570@gmail.com") {
        setCountdownStr("Permanen (Owner)");
        return;
      }
      
      if (premiumUntil === "9999999999999") {
        setCountdownStr("Permanen");
        return;
      }

      const now = Date.now();
      const expiry = new Date(premiumUntil).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setCountdownStr("Expired");
        setIsPremium(false);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const daysStr = String(days).padStart(2, "0");
      const hoursStr = String(hours).padStart(2, "0");
      const minutesStr = String(minutes).padStart(2, "0");
      const secondsStr = String(seconds).padStart(2, "0");

      setCountdownStr(`${daysStr}hari ${hoursStr}jam ${minutesStr}menit ${secondsStr}detik`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [premiumUntil, isPremium, user]);
  const fetchAdminData = async () => {
    try {
      const res = await fetch("/api/admin/status");

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        throw new Error("Received non-JSON response from server");
      }
      setAdminData(data);
      return; // Use server-side data only

      /* Fetch real-time activity logs client-side */ let rawLogs: any[] = [];
      try {
        rawLogs = await getActivityLogs();
      } catch (dbErr) {
        console.warn("Client-side activity logs query warning:", dbErr);
      }
      if (rawLogs && rawLogs.length > 0) {
        /* Parse the dates and count stats */ const logs = rawLogs.map(
          (log) => {
            let date = new Date();
            if (log.timestamp) {
              date = new Date(log.timestamp);
            }
            return { ...log, date };
          },
        );
        /* Sort descending by date */ logs.sort(
          (a, b) => b.date.getTime() - a.date.getTime(),
        );
        let tiktokCount = 0;
        let otherCount = 0;
        let premiumCount = 0;
        let freeCount = 0;
        logs.forEach((log) => {
          const p = (log.platform || "").toLowerCase();
          if (p === "tiktok") tiktokCount++;
          else otherCount++;
          if (log.uid && log.uid !== "guest") {
            premiumCount++;
          } else {
            freeCount++;
          }
        });
        /* Generate charts */ const daysOfWeek = [
          "Minggu",
          "Senin",
          "Selasa",
          "Rabu",
          "Kamis",
          "Jumat",
          "Sabtu",
        ];
        const dailyMap = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const label = `${daysOfWeek[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
          dailyMap.set(label, 0);
        }
        const dailyData = Array.from(dailyMap.keys()).map((label) => {
          let count = 0;
          logs.forEach((log) => {
            const d = log.date;
            const logLabel = `${daysOfWeek[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
            if (logLabel === label) {
              count++;
            }
          });
          const hash = label
            .split("")
            .reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const baseSeed = 5 + (hash % 15);
          return { name: label, downloads: baseSeed + count };
        });
        const weeklyData = [];
        for (let i = 3; i >= 0; i--) {
          const start = new Date();
          start.setDate(start.getDate() - (i * 7 + 6));
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          end.setDate(end.getDate() - i * 7);
          end.setHours(23, 59, 59, 999);
          const label = `W${4 - i} (${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1})`;
          let count = 0;
          logs.forEach((log) => {
            const d = log.date;
            if (d >= start && d <= end) {
              count++;
            }
          });
          const baseSeed =
            30 + i * 12 + ((start.getDate() + end.getDate()) % 20);
          weeklyData.push({ name: label, downloads: baseSeed + count });
        }
        const monthsIndo = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "Mei",
          "Jun",
          "Jul",
          "Agst",
          "Sept",
          "Okt",
          "Nov",
          "Des",
        ];
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthIndex = d.getMonth();
          const label = monthsIndo[monthIndex];
          let count = 0;
          logs.forEach((log) => {
            const logDate = log.date;
            if (
              logDate.getMonth() === monthIndex &&
              logDate.getFullYear() === d.getFullYear()
            ) {
              count++;
            }
          });
          const baseSeed = 120 + ((monthIndex * 25) % 80);
          monthlyData.push({ name: label, downloads: baseSeed + count });
        }
        /* Merge with backend non-db metrics */ data.analytics = {
          daily: dailyData,
          weekly: weeklyData,
          monthly: monthlyData,
        };
        data.platformStats = {
          tiktok: tiktokCount,
          others: otherCount,
        };
        data.userStats = { premium: premiumCount, free: freeCount };
        data.recentDownloads = logs.slice(0, 50).map((log) => ({
          ip: log.ip || "0.0.0.0",
          url: log.url,
          timestamp: log.timestamp,
          platform: log.platform,
          email:
            log.email ||
            (log.uid && log.uid !== "guest" ? "Premium User" : "Guest"),
        }));
      }
      setAdminData(data);
    } catch (e) {}
  };
  const fetchAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const result = await res.json();
          if (result.success && result.data) {
            setAdminUsers(result.data);
            return;
          }
        }
      }
      // Fallback to client-side Firestore
      const users = await getAllUsers();
      setAdminUsers(users);
    } catch (e: any) {
      try {
        const users = await getAllUsers();
        setAdminUsers(users);
      } catch (innerErr: any) {
        alert("Error loading users: " + (innerErr.message || String(innerErr)));
      }
    }
  };
  const toggleUserPremium = async (uid: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${uid}/toggle-premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify({ isPremium: !currentStatus })
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const result = await res.json();
          if (result.success) {
            fetchAdminUsers();
            return;
          }
        }
      }
      // Fallback to client-side
      await updateUserPremium(uid, !currentStatus);
      fetchAdminUsers();
    } catch (e: any) {
      try {
        await updateUserPremium(uid, !currentStatus);
        fetchAdminUsers();
      } catch (innerErr: any) {
        alert("Error updating user: " + (innerErr.message || String(innerErr)));
      }
    }
  };
  const fetchBannedLists = async () => {
    try {
      const ips = await getBannedIps();
      setBannedIps(ips);
      const usersList = await getBannedUsers();
      setBannedUsers(usersList);
      /* Sync banned IPs to server memory */ for (const item of ips) {
        await fetch("/api/admin/sync-banned-ips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: safeStringify({ ip: item.ip, action: "add" }),
        });
      }
    } catch (e) {}
  };
  const isSafeIp = (ip: string): boolean => {
    if (!ip) return true;
    const normalized = ip.trim().toLowerCase();
    return (
      normalized === "unknown" ||
      normalized === "127.0.0.1" ||
      normalized === "::1" ||
      normalized === "localhost" ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("10.") ||
      normalized.startsWith("192.168.") ||
      normalized.startsWith("172.")
    );
  };
  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanIp) return;
    if (isSafeIp(newBanIp)) {
      alert("Cannot ban safe/internal/local IP address.");
      return;
    }
    try {
      await addBannedIp(newBanIp, newBanIpReason);
      await fetch("/api/admin/sync-banned-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify({ ip: newBanIp, action: "add" }),
      });
      setNewBanIp("");
      setNewBanIpReason("");
      fetchBannedLists();
      alert("IP banned successfully!");
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const handleUnbanIp = async (ip: string) => {
    try {
      await removeBannedIp(ip);
      await fetch("/api/admin/sync-banned-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify({ ip, action: "remove" }),
      });
      fetchBannedLists();
      alert("IP unbanned successfully!");
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const handleBanUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanUserId) return;
    try {
      await addBannedUser(newBanUserId, newBanUserEmail, newBanUserReason, newBanDuration);
      setNewBanUserId("");
      setNewBanUserEmail("");
      setNewBanUserReason("");
      setNewBanDuration("permanent");
      fetchBannedLists();
      alert("User banned successfully!");
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const handleUnbanUser = async (userId: string) => {
    try {
      await removeBannedUser(userId);
      fetchBannedLists();
      alert("User unbanned successfully!");
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const banUserIpDirectly = async (
    ip: string,
    reason: string = "Banned directly from admin dashboard",
  ) => {
    if (!ip) return;
    if (isSafeIp(ip)) {
      alert("Cannot ban safe/internal/local IP address.");
      return;
    }
    try {
      await addBannedIp(ip, reason);
      await fetch("/api/admin/sync-banned-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify({ ip, action: "add" }),
      });
      fetchBannedLists();
      alert(`IP address ${ip} banned successfully!`);
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const banUserDirectly = async (
    userId: string,
    email: string,
    reason: string = "Banned directly from admin dashboard",
  ) => {
    if (!userId) return;
    try {
      await addBannedUser(userId, email, reason);
      fetchBannedLists();
      alert(`User account banned successfully!`);
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const setBottomSafeSettings = (key: string, value: any) => {
    setGlobalSettings((prev) => ({ ...prev, [key]: value }));
  };
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateGlobalSettings(globalSettings);
      await fetch("/api/admin/sync-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify({
          isMaintenance: globalSettings.isMaintenance,
          freeLimit: globalSettings.freeLimit,
          loginLimit: globalSettings.loginLimit,
          initialLimit: globalSettings.initialLimit,
          tiktokApiUrl: globalSettings.tiktokApiUrl,
          premiumLimitType: globalSettings.premiumLimitType,
          premiumLimitValue: globalSettings.premiumLimitValue,
        }),
      });
      alert("Settings saved and synchronized successfully!");
    } catch (e: any) {
      alert("Error:" + (e.message || String(e)));
    }
  };
  const fetchApiHealth = async () => {
    setApiHealthLoading(true);
    setApiHealthError(null);
    try {
      const response = await fetch("/api/admin/api-health");
      if (response.ok) {
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
        } else {
          throw new Error("Received non-JSON response from server");
        }

        setApiHealth(data);
      } else {
        setApiHealthError("Gagal mengambil status API.");
      }
    } catch (e: any) {
      setApiHealthError(e.message || "Error koneksi.");
    } finally {
      setApiHealthLoading(false);
    }
  };
  useEffect(() => {
    let unsubscribeFeedbacks: (() => void) | undefined;

    if (view === "admin") {
      fetchAdminData();
      if (adminTab === "users") {
        fetchAdminUsers();
      } else if (adminTab === "banned") {
        fetchBannedLists();
      } else if (adminTab === "feedbacks") {
        unsubscribeFeedbacks = subscribeFeedbacks((list) => {
          setFeedbacks(list);
        });
      } else if (
        adminTab === "settings" ||
        adminTab === "api_status" ||
        adminTab === "ads"
      ) {
        getGlobalSettings()
          .then(setGlobalSettings)
          .catch(() => {});
        if (adminTab === "api_status") {
          fetchApiHealth().catch(() => {});
        }
      }
    }

    return () => {
      if (unsubscribeFeedbacks) unsubscribeFeedbacks();
    };
  }, [view, adminTab]);
  /* Dynamic Popunder script execution handler */ useEffect(() => {
    if (
      globalSettings.adsEnabled &&
      globalSettings.ads?.popunderEnabled &&
      globalSettings.ads?.popunderCode
    ) {
      /* Find and remove any existing popunder element to avoid double injection */ const existing =
        document.getElementById("popunder-injection");
      if (existing) existing.remove();
      const container = document.createElement("div");
      container.id = "popunder-injection";
      container.style.display = "none";
      container.innerHTML = globalSettings.ads.popunderCode;
      /* Extract and manually execute any scripts inside the popunderCode */ const scripts =
        container.querySelectorAll("script");
      const appendedScripts: HTMLScriptElement[] = [];
      scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        document.body.appendChild(newScript);
        appendedScripts.push(newScript);
      });
      document.body.appendChild(container);
      return () => {
        container.remove();
        appendedScripts.forEach((s) => s.remove());
      };
    }
  }, [
    globalSettings.adsEnabled,
    globalSettings.ads?.popunderEnabled,
    globalSettings.ads?.popunderCode,
  ]);
  const saveToHistory = (item: any) => {
    const sanitizedItem = {
      url: item.url,
      thumbnail: item.thumbnail,
      title: item.title,
      type: item.type,
      creator: item.creator,
      platform: item.platform,
    };
    const newHistory = [
      sanitizedItem,
      ...history.filter((h) => h.url !== item.url),
    ].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem("savetik_history", safeStringify(newHistory));
  };
  const toggleBookmark = (item: any) => {
    const exists = bookmarks.find((b) => b.url === item.url);
    let newBookmarks;
    if (exists) {
      newBookmarks = bookmarks.filter((b) => b.url !== item.url);
    } else {
      const sanitizedItem = {
        url: item.url,
        thumbnail: item.thumbnail,
        title: item.title,
        type: item.type,
        creator: item.creator,
        platform: item.platform,
      };
      newBookmarks = [sanitizedItem, ...bookmarks];
    }
    setBookmarks(newBookmarks);
    localStorage.setItem("savetik_bookmarks", safeStringify(newBookmarks));
  };
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("savetik_history");
  };
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      } else {
        alert(
          "Clipboard is empty or access is restricted in this preview. Please click the input field and use Ctrl+V or Cmd+V to paste.",
        );
      }
    } catch (err) {
      alert(
        "Clipboard access is restricted in this preview. Please click the input field and use Ctrl+V or Cmd+V to paste.",
      );
    }
  };
  const checkAdBlock = async () => {
    if (globalSettings.antiAdblockEnabled === false) {
      setAdBlockDetected(false);
      return false;
    }
    let isBlocked = false;
    try {
      const testUrl =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
      await fetch(new Request(testUrl), { method: "HEAD", mode: "no-cors" });
    } catch (e) {
      isBlocked = true;
    }
    if (!isBlocked) {
      const dummy = document.createElement("div");
      dummy.className = "ad-banner adsbox doubleclick-ad ad-placeholder";
      dummy.setAttribute(
        "style",
        "position: absolute; left: -9999px; width: 1px; height: 1px;",
      );
      document.body.appendChild(dummy);
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (
        dummy.offsetHeight === 0 ||
        window.getComputedStyle(dummy).display === "none"
      ) {
        isBlocked = true;
      }
      document.body.removeChild(dummy);
    }
    setAdBlockDetected(isBlocked);
    return isBlocked;
  };
  useEffect(() => {
    if (globalSettings.antiAdblockEnabled) {
      checkAdBlock().catch(() => {});
    }
  }, [globalSettings.antiAdblockEnabled]);

  const handleDownload = async () => {
    if (!url) return;

    // Check limit before processing download search
    const isSuperAdmin = user?.email === "jrnabil570@gmail.com";
    if (user && userData && !isPremium && !isSuperAdmin) {
      const rawLimit = userData.usageLimit;
      if (rawLimit !== "permanent") {
        const history = userData.downloadHistory || [];
        const todayDownloads = history.filter((ts: string) => new Date(ts).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
        const maxDailyLimit = globalSettings.initialLimit || 5;
        const remainingDaily = Math.max(0, maxDailyLimit - todayDownloads);
        
        const rwLimit = Number(rawLimit) || 0;
        
        if (remainingDaily <= 0 && rwLimit <= 0) {
          setError(
            language === "EN"
              ? "Sorry, your limit is exhausted. Please wait until tomorrow for your daily limit to reset if your purchased limit is exhausted."
              : "mohon maaf limit anda telah habis silahkan tungguin besok ganti limit harian anda jika limit pembelian habis"
          );
          setResult(null);
          return;
        }
      }
    }
    if (globalSettings.antiAdblockEnabled) {
      const isBlocked = await checkAdBlock();
      if (isBlocked) {
        setShowAdBlockModal(true);
        if (globalSettings.antiAdblockBlockDownloads) {
          setError(
            "AdBlock Terdeteksi! Mohon matikan adblocker Anda untuk melanjutkan mengunduh video.",
          );
          return;
        }
      }
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let data;
      if (platformTab === "tiktok") {
        const response = await fetch(`/api/info/tiktok?url=${encodeURIComponent(url)}&uid=${user?.uid || ""}`);
        const contentType = response.headers.get("content-type");
        let json;
        if (contentType && contentType.indexOf("application/json") !== -1) {
          json = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Invalid response from TikTok API: ${text.substring(0, 100)}`);
        }
        
        if (json.code === 0 && json.data) {
          const item = json.data;
          const isSlides = !!(item.images && item.images.length > 0);
          
          data = {
            success: true,
            data: {
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
            }
          };

          if (isSlides) {
            data.data.downloads.push({ type: "slides", label: "Download Photos (ZIP)", url: item.images[0], quality: "HD" });
          } else {
            data.data.downloads.push({ type: "video_no_wm", label: "No Watermark", url: item.play, quality: "HD" });
            if (item.wmplay) {
              data.data.downloads.push({ type: "video_wm", label: "Watermark", url: item.wmplay, quality: "SD" });
            }
          }
          if (item.music) {
            data.data.downloads.push({ type: "audio", label: "Audio (MP3)", url: item.music, quality: "320kbps" });
          }
        } else {
          throw new Error(json.msg || "Failed to fetch TikTok video details.");
        }
      } else if (platformTab === "youtube") {
        const API_YOUTUBE_BASE = "https://youtubedl.siputzx.my.id";
        
        // 1. Fetch/Poll for Video (type=merge)
        let videoResponse = await fetch(`/api/info/youtube?url=${encodeURIComponent(url)}&type=merge&uid=${user?.uid || ""}`);
        
        const vContentType = videoResponse.headers.get("content-type");
        let videoJson;
        if (vContentType && vContentType.indexOf("application/json") !== -1) {
          videoJson = await videoResponse.json();
        } else {
          const text = await videoResponse.text();
          throw new Error(`Invalid response from YouTube API: ${text.substring(0, 100)}`);
        }

        if (!videoResponse.ok) {
          throw new Error(videoJson?.error || `YouTube Proxy Error (Status ${videoResponse.status})`);
        }
        if (videoJson.error) {
          throw new Error(videoJson.error);
        }
        
        let attempts = 0;
        const maxAttempts = 20;
        
        while (videoJson.status !== "completed" && attempts < maxAttempts) {
          if (videoJson.status === "error") {
            throw new Error(videoJson.message || videoJson.error || "Gagal memproses video YouTube.");
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
          const checkVideo = await fetch(`/api/info/youtube?url=${encodeURIComponent(url)}&type=merge&uid=${user?.uid || ""}`);
          const checkContentType = checkVideo.headers.get("content-type");
          let checkJson;
          if (checkContentType && checkContentType.indexOf("application/json") !== -1) {
            checkJson = await checkVideo.json();
          } else {
            const text = await checkVideo.text();
            throw new Error(`YouTube API returned invalid response: ${text.substring(0, 100)}`);
          }

          if (!checkVideo.ok) {
            throw new Error(checkJson?.error || `YouTube Proxy Error (Status ${checkVideo.status})`);
          }
          if (checkJson.error) {
            throw new Error(checkJson.error);
          }
          videoJson = checkJson;
          attempts++;
        }
        
        if (videoJson.status === "completed") {
          const videoUrl = videoJson.download_url || `${API_YOUTUBE_BASE}${videoJson.fileUrl}`;
          
          // 2. Fetch/Poll for Audio (type=audio) - initiate so it starts on server
          fetch(`/api/info/youtube?url=${encodeURIComponent(url)}&type=audio&uid=${user?.uid || ""}`).catch(() => {});

          data = {
            success: true,
            data: {
              platform: "youtube",
              type: "video",
              title: videoJson.title || "YouTube Video",
              creator: videoJson.author || "YouTube Channel",
              creator_id: "",
              creator_avatar: "",
              duration: videoJson.duration || "N/A",
              thumbnail: videoJson.thumbnail || videoJson.cover || "",
              stats: {
                likes: "N/A",
                shares: "N/A",
                views: "N/A"
              },
              downloads: [
                { 
                  type: "video_no_wm", 
                  label: "Download Video (MP4)", 
                  url: videoUrl, 
                  quality: "HD" 
                },
                { 
                  type: "audio", 
                  label: "Download Audio (MP3)", 
                  url: `/api/info/youtube?url=${encodeURIComponent(url)}&type=audio&uid=${user?.uid || ""}`, 
                  isProxy: true,
                  quality: "320kbps" 
                }
              ]
            }
          };
        } else {
          throw new Error("Waktu habis atau gagal memproses video YouTube. Silakan coba lagi.");
        }
      } else if (platformTab === "instagram") {
        const response = await fetch(`/api/info/instagram?url=${encodeURIComponent(url)}&uid=${user?.uid || ""}`);
        const contentType = response.headers.get("content-type");
        let json;
        if (contentType && contentType.indexOf("application/json") !== -1) {
          json = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Invalid response from Instagram API: ${text.substring(0, 100)}`);
        }
        
        if (json.status && json.data) {
          const item = json.data;
          data = {
            success: true,
            data: {
              platform: "instagram",
              type: "video",
              title: "Instagram Post",
              creator: "Instagram User",
              creator_id: "",
              creator_avatar: "",
              duration: "N/A",
              thumbnail: item.thumbnail || item.url,
              stats: {
                likes: "N/A",
                shares: "N/A",
                views: "N/A"
              },
              downloads: [
                { type: "video_no_wm", label: "Download Video", url: item.url, quality: "HD" }
              ]
            }
          };
        } else {
          throw new Error(json.message || "Failed to fetch Instagram details.");
        }
      } else {
        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: safeStringify({ url, platform: platformTab, uid: user?.uid, lang: language }),
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
        } else {
          const errText = await response.text();
          throw new Error(errText || `Server error: ${response.status}`);
        }
      }

      if (data.success) {
        const item = { ...data.data, url, id: Date.now() };
        setResult(item);
        saveToHistory(item);
        /* Log successful activity client-side */ addActivityLog(
          user?.uid || "guest",
          url,
          data.data.platform || platformTab,
        );
        
        // Server now handles usageLimit and downloadHistory securely
      } else {
        setError(data.error || "Failed to fetch video details.");
      }
    } catch (error: any) {
      console.error("Download fetch error:", error instanceof Error ? error.message : String(error));
      let msg = error.message || "Network error occurred. Please try again.";
      if (msg === "Failed to fetch") {
        msg = "Gagal terhubung ke server. Pastikan koneksi internet Anda stabil dan coba lagi dalam beberapa saat.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };
  const [reported, setReported] = useState(false);
  const handleReport = () => {
    setReported(true);
    setTimeout(() => setReported(false), 3000);
  };

  const getRemainingDailyLimit = () => {
    if (!userData) return 0;
    if (userData.isPremium || userData.usageLimit === "permanent") return "Unlimited";
    
    // Calculate today's downloads
    const history = userData.downloadHistory || [];
    const todayDownloads = history.filter((ts: string) => new Date(ts).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;

    const maxDailyLimit = globalSettings.initialLimit || 5;
    const remaining = Math.max(0, maxDailyLimit - todayDownloads);
    return isNaN(remaining) ? 0 : remaining;
  };
  
  const getRemainingRwLimit = () => {
    if (!userData) return 0;
    if (userData.isPremium || userData.usageLimit === "permanent") return "Unlimited";
    const rawLimit = userData.usageLimit;
    const parsed = Number(rawLimit);
    if (!isNaN(parsed) && rawLimit !== null && rawLimit !== undefined) {
      return parsed;
    }
    return 0;
  };
  
  const getDailyLimitPercentage = () => {
    if (!userData) return 0;
    if (userData.isPremium || userData.usageLimit === "permanent") return 100;
    
    const maxLimit = globalSettings.initialLimit || 5;
    if (maxLimit <= 0) return 0;
    
    const remaining = getRemainingDailyLimit();
    if (remaining === "Unlimited") return 100;
    
    const percentage = Math.max(0, Math.min(100, (Number(remaining) / maxLimit) * 100));
    return isNaN(percentage) ? 0 : percentage;
  };

  const loadFromList = (savedUrl: string) => {
    setUrl(savedUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleMaintenance = async () => {
    try {
      const res = await fetch("/api/admin/toggle-maintenance", {
        method: "POST",
      });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        throw new Error("Received non-JSON response from server");
      }

      if (data.success) {
        setAdminData({ ...adminData, maintenance: data.maintenance });
      }
    } catch (e) {}
  };
  const isBookmarked = result
    ? bookmarks.some((b) => b.url === result.url)
    : false;
  const clearAdminCache = async () => {
    try {
      await fetch("/api/admin/clear-cache", { method: "POST" });
      alert("Server cache cleared successfully.");
    } catch (e) {}
  };
  /* Chart data from server analytics with standard elegant fallback */ const chartData =
    adminData?.analytics?.[analyticsRange] || [
      { name: "Senin", downloads: 15 },
      { name: "Selasa", downloads: 22 },
      { name: "Rabu", downloads: 18 },
      { name: "Kamis", downloads: 29 },
      { name: "Jumat", downloads: 35 },
      { name: "Sabtu", downloads: 42 },
      { name: "Minggu", downloads: 38 },
    ];
  if (view === "restrictions") {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text font-sans p-4 sm:p-8 flex flex-col items-center">
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in">
          
          {/* ← MENU UTAMA Button */}
          <div className="flex justify-start">
            <button
              onClick={() => setView("main")}
              className="flex items-center gap-2 px-4 py-2 bg-theme-panel text-theme-text border-2 border-theme-border font-mono font-bold text-xs uppercase tracking-wider rounded-lg shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer"
            >
              {language === "EN" ? "← MAIN MENU" : "← MENU UTAMA"}
            </button>
          </div>

          {/* Title */}
          <div className="text-left space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2">
              🚫 {language === "EN" ? "USAGE PROHIBITIONS" : "LARANGAN PENGGUNAAN"}
            </h1>
          </div>

          {/* Banner */}
          <div className="bg-[#a855f7] border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-6 text-white font-black uppercase text-sm sm:text-base tracking-wide leading-relaxed">
            {language === "EN" ? (
              <>
                <span className="text-yellow-300">⚡ RESPECT DIGITAL COPYRIGHT.</span> AMANE DOWNLOADER IS ONLY A HELPER TOOL — HOW YOU USE THE RESULTS IS YOUR OWN RESPONSIBILITY.
              </>
            ) : (
              <>
                <span className="text-yellow-300">⚡ HORMATI HAK CIPTA DIGITAL.</span> AMANE DOWNLOADER CUMA ALAT BANTU — CARA KAMU MAKAI HASILNYA, ITU TANGGUNG JAWAB KAMU SENDIRI.
              </>
            )}
          </div>

          {/* Core cards stack */}
          <div className="flex flex-col gap-4">
            {/* Card 1 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-5 sm:p-6 space-y-2">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-3 text-red-400">
                <span>🛑</span> {language === "EN" ? "NO UNAUTHORIZED COMMERCIAL USE" : "DILARANG KOMERSIALISASI TANPA IZIN"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-80">
                {language === "EN" 
                  ? "Downloaded content must not be sold, monetized, or used for commercial purposes without explicit permission from the original owner."
                  : "Konten yang diunduh gak boleh dijual, dimonetisasi, atau dipakai buat kepentingan komersial tanpa izin dari pemilik aslinya."}
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-5 sm:p-6 space-y-2">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-3 text-red-400">
                <span>❌</span> {language === "EN" ? "NO RE-UPLOADING WITHOUT CREDIT" : "DILARANG RE-UPLOAD TANPA KREDIT"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-80">
                {language === "EN"
                  ? "If re-uploading to other platforms, you must credit the original creator/source. Claiming others' work as your own is fraudulent."
                  : "Kalau nge-upload ulang ke platform lain, wajib cantumin kredit/sumber asli. Klaim karya orang lain sebagai milik sendiri itu curang."}
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-5 sm:p-6 space-y-2">
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-3 text-yellow-500">
                <span>⚠️</span> {language === "EN" ? "LEGAL LIABILITY IS ON YOU" : "TANGGUNG JAWAB HUKUM DI TANGAN KAMU"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-80">
                {language === "EN"
                  ? "Any legal consequences of content misuse — copyright infringement, defamation, etc. — are entirely the user's responsibility, not Amane Downloader."
                  : "Segala akibat hukum dari penyalahgunaan hasil unduhan — pelanggaran hak cipta, pencemaran nama baik, dll — sepenuhnya tanggung jawab pengguna, bukan Amane Downloader."}
              </p>
            </div>
          </div>

          {/* Footer Text */}
          <p className="text-xs font-black uppercase tracking-wider leading-relaxed text-center opacity-70 mt-2">
            {language === "EN" 
              ? "BY USING THIS SERVICE, YOU ARE DEEMED TO AGREE WITH THE 3 POINTS ABOVE. 🤝"
              : "DENGAN MAKAI LAYANAN INI, KAMU DIANGGAP SETUJU SAMA 3 POIN DI ATAS. 🤝"}
          </p>

          {/* Bottom Divider & KEMBALI KE MENU UTAMA */}
          <div className="border-t-4 border-theme-border pt-6 mt-2 flex justify-center">
            <button
              onClick={() => setView("main")}
              className="w-full max-w-md py-4 bg-white text-black hover:bg-gray-100 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all font-black uppercase text-sm tracking-widest text-center cursor-pointer rounded-xl"
            >
              {language === "EN" ? "← BACK TO MAIN MENU" : "← KEMBALI KE MENU UTAMA"}
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (view === "how_to_use") {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text font-sans p-4 sm:p-8 flex flex-col items-center">
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in">
          
          {/* ← MENU UTAMA Button */}
          <div className="flex justify-start">
            <button
              onClick={() => setView("main")}
              className="flex items-center gap-2 px-4 py-2 bg-theme-panel text-theme-text border-2 border-theme-border font-mono font-bold text-xs uppercase tracking-wider rounded-lg shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer"
            >
              {language === "EN" ? "← MAIN MENU" : "← MENU UTAMA"}
            </button>
          </div>

          {/* Title */}
          <div className="text-left space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2">
              📖 {language === "EN" ? "HOW TO USE" : "CARA PENGGUNAAN"}
            </h1>
            <p className="text-xs font-mono font-bold tracking-wider text-red-500 uppercase">
              {language === "EN" ? "3 steps only, simple & fast 🚀" : "3 LANGKAH DOANG, GAK RIBET 🚀"}
            </p>
          </div>

          {/* Core cards stack */}
          <div className="flex flex-col gap-4">
            {/* Card 1 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-5 sm:p-6 flex gap-4 items-start">
              <div className="w-10 h-10 shrink-0 bg-cyan-400 text-black font-black text-lg flex items-center justify-center border-2 border-theme-border rounded-lg shadow-[2px_2px_0px_var(--theme-shadow)]">
                1
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-2 text-theme-text">
                  📋 {language === "EN" ? "COPY LINK" : "SALIN LINK"}
                </h3>
                <p className="text-sm font-medium leading-relaxed opacity-85">
                  {language === "EN"
                    ? "Copy the video/audio link from TikTok, Instagram, Douyin, Pinterest, CapCut, or Spotify."
                    : "Copy link video/audio dari TikTok, Instagram, Douyin, Pinterest, CapCut, atau Spotify."}
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-5 sm:p-6 flex gap-4 items-start">
              <div className="w-10 h-10 shrink-0 bg-cyan-400 text-black font-black text-lg flex items-center justify-center border-2 border-theme-border rounded-lg shadow-[2px_2px_0px_var(--theme-shadow)]">
                2
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-2 text-theme-text">
                  📥 {language === "EN" ? "PASTE & PROCESS" : "TEMPEL & PROSES"}
                </h3>
                <p className="text-sm font-medium leading-relaxed opacity-85">
                  {language === "EN"
                    ? "Paste into the input column on the main page, then press 'Process Now'."
                    : "Paste ke kolom input di halaman utama, terus pencet \"Proses Sekarang\"."}
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[6px_6px_0px_var(--theme-shadow)] p-5 sm:p-6 flex gap-4 items-start">
              <div className="w-10 h-10 shrink-0 bg-cyan-400 text-black font-black text-lg flex items-center justify-center border-2 border-theme-border rounded-lg shadow-[2px_2px_0px_var(--theme-shadow)]">
                3
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-2 text-theme-text">
                  ✅ {language === "EN" ? "DOWNLOAD MEDIA" : "UNDUH MEDIA"}
                </h3>
                <p className="text-sm font-medium leading-relaxed opacity-85">
                  {language === "EN"
                    ? "Wait a moment, the preview will appear right below the input box. Simply press the download button."
                    : "Tunggu bentar, pratinjau bakal langsung muncul di bawah kolom input. Tinggal pencet tombol unduh."}
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Title */}
          <div className="text-left mt-6">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2 text-theme-text">
              <span className="text-red-500">❓</span> {language === "EN" ? "FREQUENTLY ASKED QUESTIONS" : "TANYA JAWAB LANGSUNG"}
            </h2>
          </div>

          {/* FAQ Items Stack */}
          <div className="flex flex-col gap-4">
            {/* FAQ 1 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[5px_5px_0px_#22d3ee] p-5 sm:p-6 space-y-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2 text-cyan-500">
                <span className="text-red-500">❓</span> {language === "EN" ? "Is this really free?" : "Ini beneran gratis?"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-90 flex items-start gap-2">
                <span className="shrink-0">📢</span>
                <span>
                  <strong>{language === "EN" ? "Answer: " : "Jawab: "}</strong>
                  {language === "EN"
                    ? "Yes, 100% free, no ads, no subscriptions. If you want to help with server costs, there is a donation button in the Support menu."
                    : "Iya, 100% gratis, tanpa iklan, tanpa langganan. Kalau mau bantu biaya server, ada tombol donasi di menu Support."}
                </span>
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[5px_5px_0px_#22d3ee] p-5 sm:p-6 space-y-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2 text-cyan-500">
                <span className="text-red-500">❓</span> {language === "EN" ? "Why did the link fail to process?" : "Kenapa link-nya gagal diproses?"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-90 flex items-start gap-2">
                <span className="shrink-0">📢</span>
                <span>
                  <strong>{language === "EN" ? "Answer: " : "Jawab: "}</strong>
                  {language === "EN"
                    ? "Usually because the account is private, the link has been deleted, or there was a typo during copy-paste. Try opening the link in your browser first; if it's publicly accessible, it should work."
                    : "Biasanya karena akunnya private, link-nya udah dihapus, atau ada typo pas copy-paste. Coba buka link-nya dulu di browser, kalau bisa dibuka publik, harusnya jalan."}
                </span>
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[5px_5px_0px_#22d3ee] p-5 sm:p-6 space-y-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2 text-cyan-500">
                <span className="text-red-500">❓</span> {language === "EN" ? "Is the downloaded media watermark-free?" : "Hasil downloadnya ada watermark gak?"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-90 flex items-start gap-2">
                <span className="shrink-0">📢</span>
                <span>
                  <strong>{language === "EN" ? "Answer: " : "Jawab: "}</strong>
                  {language === "EN"
                    ? "Yes, all supported platforms are downloaded without watermarks, unless the upstream source is currently rate-limited and falls back to another source."
                    : "Enggak, semua platform yang didukung diambil tanpa watermark, kecuali kalau upstream-nya emang lagi kena rate-limit dan fallback ke sumber lain."}
                </span>
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[5px_5px_0px_#22d3ee] p-5 sm:p-6 space-y-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2 text-cyan-500">
                <span className="text-red-500">❓</span> {language === "EN" ? "Can it be installed as an app on my phone?" : "Bisa dipasang kayak aplikasi di HP?"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-90 flex items-start gap-2">
                <span className="shrink-0">📢</span>
                <span>
                  <strong>{language === "EN" ? "Answer: " : "Jawab: "}</strong>
                  {language === "EN"
                    ? "Yes! Open the ☰ menu in the top right corner and look for the 'Install App' option (if your browser supports PWA)."
                    : "Bisa! Buka menu ☰ di pojok kanan atas, cari opsi \"Pasang Aplikasi\" (kalau browser kamu support PWA)."}
                </span>
              </p>
            </div>

            {/* FAQ 5 */}
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[5px_5px_0px_#22d3ee] p-5 sm:p-6 space-y-3">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2 text-cyan-500">
                <span className="text-red-500">❓</span> {language === "EN" ? "What is the maximum video quality?" : "Kualitas video maksimal berapa?"}
              </h3>
              <p className="text-sm font-medium leading-relaxed opacity-90 flex items-start gap-2">
                <span className="shrink-0">📢</span>
                <span>
                  <strong>{language === "EN" ? "Answer: " : "Jawab: "}</strong>
                  {language === "EN"
                    ? "We automatically fetch the best quality available from the source platform."
                    : "Kami otomatis ngambil kualitas terbaik yang tersedia dari platform sumbernya."}
                </span>
              </p>
            </div>
          </div>

          {/* Bottom Note & KEMBALI KE MENU UTAMA */}
          <div className="border-t-4 border-theme-border pt-6 mt-4 flex flex-col items-center gap-4">
            <button
              onClick={() => setView("main")}
              className="w-full max-w-md py-4 bg-white text-black hover:bg-gray-100 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all font-black uppercase text-sm tracking-widest text-center cursor-pointer rounded-xl"
            >
              {language === "EN" ? "← BACK TO MAIN MENU" : "← KEMBALI KE MENU UTAMA"}
            </button>
            
            <div className="text-center space-y-1 mt-2">
              <p className="text-xs font-mono font-bold tracking-wider opacity-65">
                © 2026 Amane
              </p>
              <p className="text-[10px] font-mono tracking-wider opacity-50 uppercase font-bold">
                {language === "EN" ? "Made for personal & fair use" : "Dibuat untuk penggunaan pribadi & wajar"}
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (view === "support_donation") {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text font-sans p-4 sm:p-8 flex flex-col items-center">
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in">
          
          {/* ← MENU UTAMA Button */}
          <div className="flex justify-start">
            <button
              onClick={() => setView("main")}
              className="flex items-center gap-2 px-4 py-2 bg-theme-panel text-theme-text border-2 border-theme-border font-mono font-bold text-xs uppercase tracking-wider rounded-lg shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer"
            >
              ← MENU UTAMA
            </button>
          </div>

          {/* Title and Subtext */}
          <div className="text-left space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2">
              💛 SUPPORT / DONASI
            </h1>
            <p className="text-sm font-medium leading-relaxed opacity-90">
              Amane Downloader gratis dan gak pakai iklan. Kalau layanan ini bermanfaat, dukungan kamu bantu banget buat biaya server & pengembangan fitur baru.
            </p>
          </div>

          {/* QRIS Central Panel */}
          <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[8px_8px_0px_var(--theme-shadow)] p-6 sm:p-8 flex flex-col items-center gap-6">
            <div className="w-full max-w-xs aspect-square border-4 border-theme-border rounded-xl overflow-hidden shadow-[4px_4px_0px_var(--theme-shadow)] bg-white p-2">
              <img
                src={globalSettings.qrisImageUrl || "/src/assets/images/qris_donation_1784202976592.jpg"}
                alt="QRIS Donation"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = globalSettings.qrisImageUrl || "/src/assets/images/qris_donation_1784202976592.jpg";
                link.download = "qris_amane_downloader.jpg";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-theme-primary text-black border-4 border-theme-border font-black text-sm uppercase tracking-wider rounded-xl shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer"
            >
              📥 SIMPAN GAMBAR QRIS
            </button>
          </div>

          {/* Action buttons list */}
          <div className="flex flex-col gap-4 mt-2">
            {/* CONTACT OWNER */}
            <a
              href={globalSettings.contactOwnerUrl || "https://wa.me/628888573485"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-4 bg-theme-panel hover:brightness-95 border-4 border-theme-border rounded-xl shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all text-sm font-black uppercase tracking-wider text-left cursor-pointer"
            >
              <span className="flex items-center gap-3">
                💬 CONTACT OWNER
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-theme-text" />
            </a>

            {/* WEBSITE BUY OTOMATIS */}
            <a
              href={globalSettings.websiteBuyOtomatisUrl || "https://download.amane-acel.web.id"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-4 bg-theme-panel hover:brightness-95 border-4 border-theme-border rounded-xl shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all text-sm font-black uppercase tracking-wider text-left cursor-pointer"
            >
              <span className="flex items-center gap-3">
                👜 WEBSITE BUY OTOMATIS
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-theme-text" />
            </a>

            {/* Scan QRIS di atas buat donasi suka-suka bukan tombol */}
            <div className="flex items-center gap-3 px-5 py-4 bg-theme-panel border-4 border-theme-border rounded-xl text-sm font-black text-gray-500 font-mono select-none">
              ☕ {globalSettings.scanQrisText || "Scan QRIS di atas buat donasi suka-suka"}
            </div>
          </div>

          {/* Bottom Divider & KEMBALI KE MENU UTAMA */}
          <div className="border-t-4 border-theme-border pt-6 mt-4 flex justify-center">
            <button
              onClick={() => setView("main")}
              className="w-full max-w-md py-4 bg-white text-black hover:bg-gray-100 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all font-black uppercase text-sm tracking-widest text-center cursor-pointer rounded-xl"
            >
              ← KEMBALI KE MENU UTAMA
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (view === "feedback") {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text font-sans p-4 sm:p-8 flex flex-col items-center">
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in">
          
          {/* ← MENU UTAMA Button */}
          <div className="flex justify-start">
            <button
              onClick={() => {
                setView("main");
                setFeedbackSuccess(false);
                setFeedbackDetails("");
                setFeedbackContact("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-theme-panel text-theme-text border-2 border-theme-border font-mono font-bold text-xs uppercase tracking-wider rounded-lg shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer"
            >
              ← MENU UTAMA
            </button>
          </div>

          {/* Title and Subtext */}
          <div className="text-left space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2">
              💬 FEEDBACK
            </h1>
            <p className="text-sm font-medium leading-relaxed opacity-90 uppercase tracking-wide">
              NEMU BUG ATAU PUNYA IDE FITUR? KABARIN LANGSUNG KE KAMI 🚀
            </p>
          </div>

          {feedbackSuccess ? (
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[8px_8px_0px_var(--theme-shadow)] p-8 sm:p-10 flex flex-col items-center text-center gap-6 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 border-4 border-theme-border rounded-full flex items-center justify-center text-3xl font-bold shadow-[2px_2px_0px_var(--theme-shadow)]">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                  FEEDBACK TERKIRIM!
                </h2>
                <p className="text-sm font-medium leading-relaxed text-gray-700 max-w-md">
                  Terima kasih banyak atas feedback kamu! Saran atau laporan bug kamu sangat berharga untuk membuat SaveTik menjadi lebih baik.
                </p>
              </div>
              <button
                onClick={() => {
                  setView("main");
                  setFeedbackSuccess(false);
                  setFeedbackDetails("");
                  setFeedbackContact("");
                }}
                className="w-full max-w-xs py-3.5 bg-theme-primary text-black border-4 border-theme-border font-black text-sm uppercase tracking-wider rounded-xl shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer"
              >
                KEMBALI KE MENU UTAMA
              </button>
            </div>
          ) : (
            <div className="bg-theme-panel border-4 border-theme-border rounded-2xl shadow-[8px_8px_0px_var(--theme-shadow)] p-6 sm:p-8 flex flex-col gap-6">
              
              {/* Category tabs */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-theme-text block">
                  KATEGORI FEEDBACK
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedbackCategory("fitur")}
                    className={`flex items-center justify-center gap-2 py-3 border-4 border-theme-border font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-[4px_4px_0px_var(--theme-shadow)] cursor-pointer ${
                      feedbackCategory === "fitur"
                        ? "bg-theme-primary text-black translate-y-[2px] translate-x-[2px] shadow-none"
                        : "bg-white text-gray-800 hover:brightness-95"
                    }`}
                  >
                    💡 FITUR
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackCategory("bug")}
                    className={`flex items-center justify-center gap-2 py-3 border-4 border-theme-border font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-[4px_4px_0px_var(--theme-shadow)] cursor-pointer ${
                      feedbackCategory === "bug"
                        ? "bg-theme-primary text-black translate-y-[2px] translate-x-[2px] shadow-none"
                        : "bg-white text-gray-800 hover:brightness-95"
                    }`}
                  >
                    🐞 BUG
                  </button>
                </div>
              </div>

              {/* Details Textarea */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-theme-text block">
                    CERITAIN DETAILNYA
                  </label>
                  <span className="text-[10px] font-mono text-gray-500">
                    {feedbackDetails.length}/2000
                  </span>
                </div>
                <textarea
                  value={feedbackDetails}
                  onChange={(e) => setFeedbackDetails(e.target.value.slice(0, 2000))}
                  placeholder={
                    feedbackCategory === "fitur"
                      ? "Contoh: request fitur download playlist YouTube sekaligus atau integrasi dengan Google Drive..."
                      : "Contoh: saat mendownload video YouTube muncul status 530 atau tombol download tidak bisa diklik..."
                  }
                  rows={6}
                  className="w-full bg-white text-black border-4 border-theme-border rounded-xl p-4 font-medium text-sm focus:outline-none focus:ring-0 placeholder:text-gray-400 resize-none shadow-[2px_2px_0px_var(--theme-shadow)]"
                  required
                />
              </div>

              {/* Contact input */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-theme-text block">
                  KONTAK (OPSIONAL, KALAU MAU DIBALAS)
                </label>
                <input
                  type="text"
                  value={feedbackContact}
                  onChange={(e) => setFeedbackContact(e.target.value)}
                  placeholder="Email / username Telegram / nomor WhatsApp"
                  className="w-full bg-white text-black border-4 border-theme-border rounded-xl px-4 py-3 font-medium text-sm focus:outline-none focus:ring-0 placeholder:text-gray-400 shadow-[2px_2px_0px_var(--theme-shadow)]"
                />
              </div>

              {/* Submit button */}
              <button
                disabled={feedbackSubmitting || !feedbackDetails.trim()}
                onClick={async () => {
                  if (!feedbackDetails.trim()) return;
                  setFeedbackSubmitting(true);
                  try {
                    await addFeedback(
                      feedbackCategory,
                      feedbackDetails,
                      feedbackContact,
                      user?.uid || "guest",
                      user?.email || "guest"
                    );
                    setFeedbackSuccess(true);
                  } catch (err: any) {
                    alert("Gagal mengirim feedback: " + (err.message || String(err)));
                  } finally {
                    setFeedbackSubmitting(false);
                  }
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-4 bg-theme-primary text-black border-4 border-theme-border font-black text-sm uppercase tracking-wider rounded-xl shadow-[4px_4px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 disabled:translate-x-0"
              >
                {feedbackSubmitting ? (
                  <span>MENGIRIM...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4 shrink-0" />
                    <span>KIRIM FEEDBACK</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Bottom Back Button */}
          {!feedbackSuccess && (
            <div className="border-t-4 border-theme-border pt-6 mt-2 flex justify-center">
              <button
                onClick={() => setView("main")}
                className="w-full max-w-md py-4 bg-white text-black hover:bg-gray-100 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all font-black uppercase text-sm tracking-widest text-center cursor-pointer rounded-xl"
              >
                ← KEMBALI KE MENU UTAMA
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  if (view === "admin") {
    return (
      <div className="min-h-screen w-full flex flex-col md:flex-row bg-theme-bg font-sans md:border-8 border-4 border-theme-border relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-none blur-[100px] pointer-events-none"></div>
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] border-b-4 md:border-b-0 md:border-r-4 p-6 flex flex-col z-10 shrink-0 text-theme-text">
          <div className="flex items-center gap-3 mb-6 md:mb-10">
            <div className="w-8 h-8 bg-emerald-500 flex items-center justify-center rounded">
              <Video className="w-4 h-4 text-white font-black" />
            </div>
            <div className="text-xl font-black tracking-tighter">
              SAVETIK{""}
              <span className="text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]">
                ADMIN
              </span>
            </div>
          </div>
          <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-2 flex-grow pb-4 md:pb-0">
            <button
              onClick={() => setAdminTab("dashboard")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "dashboard" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => setAdminTab("users")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "users" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <Users className="w-4 h-4" /> User Management
            </button>
            <button
              onClick={() => setAdminTab("give_premium")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${
                adminTab === "give_premium"
                  ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text border-2 border-theme-border"
                  : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"
              }`}
            >
              <Crown className="w-4 h-4" /> Berikan Premi
            </button>
            <button
              onClick={() => setAdminTab("give_premium_bonus")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${
                adminTab === "give_premium_bonus"
                  ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text border-2 border-theme-border"
                  : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"
              }`}
            >
              <Zap className="w-4 h-4 text-green-600" /> Premi + Limit Permanen
            </button>
            <button
              onClick={() => setAdminTab("banned")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "banned" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <ShieldAlert className="w-4 h-4" /> Banned IPs
            </button>
            <button
              onClick={() => setAdminTab("api_status")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "api_status" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <Activity className="w-4 h-4" /> API Nodes Status
            </button>
            <button
              onClick={() => setAdminTab("ads")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "ads" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <Settings className="w-4 h-4" /> Ad & Anti-Adblock
            </button>
            <button
              onClick={() => setAdminTab("products")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "products" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <ShoppingBag className="w-4 h-4" /> Products
            </button>
            <button
              onClick={() => setAdminTab("give_limit")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "give_limit" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <Zap className="w-4 h-4" /> Give Limit
            </button>

            <button
              onClick={() => setAdminTab("feedbacks")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "feedbacks" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <MessageSquare className="w-4 h-4" /> Pesan Feedback
            </button>

            <button
              onClick={() => setAdminTab("settings")}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${adminTab === "settings" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black"}`}
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>
          <button
            onClick={() => setView("main")}
            className="flex items-center justify-center md:justify-start gap-3 px-4 py-3 hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono hover:text-theme-text font-black rounded-none text-sm font-bold transition-colors mt-4 md:mt-auto shrink-0"
          >
            <LogOut className="w-4 h-4" /> Back to App
          </button>
        </div>
        {/* Main Content */}
        <div className="flex-grow p-4 md:p-10 overflow-y-auto z-10 w-full overflow-x-hidden">
          {adminTab === "dashboard" && (
            <>
              <h1 className="text-3xl font-black mb-6 md:mb-8">Overview</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text">
                  <div className="text-gray-600 font-mono text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Live Traffic
                  </div>
                  <div className="text-4xl font-black">
                    {adminData?.traffic || 0}
                  </div>
                </div>
                <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text">
                  <div className="text-gray-600 font-mono text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Premium Users
                  </div>
                  <div className="text-4xl font-black">
                    {adminUsers.filter((u) => u.isPremium).length}
                  </div>
                </div>
                <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text">
                  <div className="text-gray-600 font-mono text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Banned IPs
                  </div>
                  <div className="text-4xl font-black">
                    {adminData?.bannedIps?.length || 0}
                  </div>
                </div>
              </div>
              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none mb-8 text-theme-text">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                    <BarChart className="w-5 h-5 text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" />
                    {analyticsRange === "daily"
                      ? "Downloads Harian (7 Hari Terakhir)"
                      : analyticsRange === "weekly"
                        ? "Downloads Mingguan (4 Minggu Terakhir)"
                        : "Downloads Bulanan (6 Bulan Terakhir)"}
                  </div>
                  <div className="flex bg-theme-bg p-1 rounded-none border-4 border-theme-border self-start sm:self-auto">
                    {(["daily", "weekly", "monthly"] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setAnalyticsRange(range)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${analyticsRange === range ? "bg-emerald-500 text-white font-black" : "text-gray-800 font-mono hover:text-theme-text font-black"}`}
                      >
                        {range === "daily"
                          ? "Harian"
                          : range === "weekly"
                            ? "Mingguan"
                            : "Bulanan"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />

                      <Line
                        type="monotone"
                        dataKey="downloads"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Platform and User breakdown metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t-4 border-theme-border">
                  <div>
                    <div className="text-gray-600 font-mono text-xs font-bold uppercase tracking-wider mb-3">
                      Distribusi Platform
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="">TikTok Downloads</span>
                        <span className="text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] font-mono">
                          {adminData?.platformStats?.tiktok || 0}
                        </span>
                      </div>
                      <div className="w-full bg-theme-bg h-2 rounded-none overflow-hidden border-4 border-theme-border">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{
                            width: "100%",
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600 font-mono text-xs font-bold uppercase tracking-wider mb-3">
                      Segmentasi Pengguna (Free vs Premium)
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="">Premium / Member Downloads</span>
                        <span className="text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] font-mono">
                          {adminData?.userStats?.premium || 0}
                        </span>
                      </div>
                      <div className="w-full bg-theme-bg h-2 rounded-none overflow-hidden border-4 border-theme-border">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{
                            width: `${(adminData?.userStats?.premium || 0) + (adminData?.userStats?.free || 0) > 0 ? ((adminData?.userStats?.premium || 0) / ((adminData?.userStats?.premium || 0) + (adminData?.userStats?.free || 0))) * 100 : 50}%`,
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs font-bold">
                        <span className=""> Guest / Free Downloads </span>
                        <span className="text-gray-800 font-mono">
                          {adminData?.userStats?.free || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text">
                <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
                <div className="flex gap-4">
                  <button
                    onClick={toggleMaintenance}
                    className={`px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors ${adminData?.maintenance ? "bg-red-500 hover:bg-red-600 text-theme-text font-black" : "bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-gray-300 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-slate-300"}`}
                  >
                    {adminData?.maintenance
                      ? "Disable Maintenance Mode"
                      : "Enable Maintenance Mode"}
                  </button>
                  <button
                    onClick={clearAdminCache}
                    className="px-6 py-3 bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-gray-300 rounded-none text-sm font-bold uppercase tracking-wide transition-colors"
                  >
                    Clear Cache
                  </button>
                </div>
              </div>
              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none mt-8 text-theme-text">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" />
                      {""} Live Download Request Tracker
                    </h2>
                    <p className="text-xs text-gray-800 font-mono mt-1">
                      Real-time download logs showing active IPs, client
                      accounts, and target platforms.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={fetchAdminData}
                      className="px-3 py-1 bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-gray-300 rounded-none text-xs font-bold transition-all"
                    >
                      Refresh Logs
                    </button>
                    <button
                      onClick={async () => {
                        const email = prompt("Masukkan email pengguna untuk menghapus log aktivitasnya saja (biarkan kosong untuk hapus SEMUA log):");
                        if (email === null) return;
                        
                        if (confirm(`Apakah Anda yakin ingin menghapus ${email ? `log aktivitas untuk ${email}` : "SEMUA log aktivitas"}?`)) {
                          try {
                            const res = await fetch("/api/admin/clear-logs", { 
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: safeStringify({ email: email.trim() || undefined })
                            });
                            if (!res.ok) throw new Error("Failed to clear logs");
                            fetchAdminData();
                            alert("Logs cleared successfully.");
                          } catch (e) {
                            alert("Failed to clear logs.");
                          }
                        }
                      }}
                      className="px-3 py-1 bg-red-500 text-white border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-red-600 rounded-none text-xs font-bold transition-all"
                    >
                      Clear Logs
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-theme-bg/50 text-gray-600 font-mono text-xs uppercase tracking-widest border-b-4 border-theme-border">
                      <tr>
                        <th className="px-4 py-3 font-bold">Time</th>
                        <th className="px-4 py-3 font-bold">IP Address</th>
                        <th className="px-4 py-3 font-bold">Client Email</th>
                        <th className="px-4 py-3 font-bold">Platform</th>
                        <th className="px-4 py-3 font-bold">Download URL</th>
                        <th className="px-4 py-3 font-bold text-right">
                          Instant Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-xs">
                      {adminData?.recentDownloads &&
                        adminData.recentDownloads.map(
                          (log: any, index: number) => (
                            <tr
                              key={index}
                              className="hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] /20 transition-colors"
                            >
                              <td className="px-4 py-3 font-mono text-gray-800">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-mono bg-theme-bg/50 px-2 py-0.5 rounded border-4 border-theme-border">
                                  {log.ip}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-theme-text font-black uppercase">
                                {log.email ? (
                                  <span className="text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] font-medium">
                                    {log.email}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 font-mono italic">
                                    Guest User
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text px-1 border-2">
                                  {log.platform}
                                </span>
                              </td>
                              <td
                                className="px-4 py-3 max-w-[200px] truncate text-gray-800 font-mono"
                                title={log.url}
                              >
                                {log.url}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {log.email && (
                                    <button
                                      onClick={() => {
                                        setGiveLimitType("email");
                                        setGiveLimitTarget(log.email || "");
                                        setAdminTab("give_limit");
                                      }}
                                      className="text-[10px] font-black uppercase tracking-wider bg-sky-300 hover:bg-sky-400 text-theme-text px-2.5 py-1.5 border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all cursor-pointer"
                                    >
                                      Give Limit
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      banUserIpDirectly(
                                        log.ip,
                                        `Automated ban from tracker for URL download`,
                                      )
                                    }
                                    className="text-[10px] font-bold uppercase tracking-wider text-white bg-red-500 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:text-red-300 transition-colors hover:bg-red-600 border-4 shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all px-2.5 py-1 rounded border-red-500/20 cursor-pointer"
                                  >
                                    Ban IP
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      {(!adminData?.recentDownloads ||
                        adminData.recentDownloads.length === 0) && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-gray-600 font-mono italic"
                          >
                            No download requests logged yet. Active requests
                            will show up here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {adminTab === "users" && (
            <>
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h1 className="text-3xl font-black mb-1">
                    User Management
                  </h1>
                  <p className="text-xs text-gray-600 font-mono">
                    Total terdaftar: {adminUsers.length} pengguna
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm("BAHAYA: Apakah Anda yakin ingin menghapus SEMUA pengguna (kecuali Owner)? Tindakan ini permanen dan akan menghapus semua akun di Firebase Auth & Firestore.")) {
                      try {
                        const res = await fetch("/api/admin/users/delete-all", { method: "POST" });
                        if (res.ok) {
                          alert("Semua pengguna berhasil dihapus.");
                          fetchAdminUsers();
                        } else {
                          throw new Error("Gagal menghapus semua pengguna.");
                        }
                      } catch (e: any) {
                        alert(e.message);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] font-black uppercase text-xs hover:bg-red-700 transition-all"
                >
                  Hapus Semua Pengguna
                </button>
              </div>
              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] rounded-none overflow-hidden text-theme-text">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-theme-bg/50 text-gray-600 font-mono text-xs uppercase tracking-widest border-b-4 border-theme-border">
                      <tr>
                        <th className="px-6 py-4 font-bold">User Details</th>
                        <th className="px-6 py-4 font-bold">Usage Limit</th>
                        <th className="px-6 py-4 font-bold">Last Active IP</th>
                        <th className="px-6 py-4 font-bold">Last Activity</th>
                        <th className="px-6 py-4 font-bold">Status</th>
                        <th className="px-6 py-4 font-bold text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {adminUsers.map((u) => (
                        <tr
                          key={u.uid}
                          className="hover:bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] /20 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {u.photoURL ? (
                                <img
                                  src={u.photoURL}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-none border-4 border-theme-border"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-none bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] flex items-center justify-center font-bold text-xs text-gray-800 font-mono">
                                  {u.displayName
                                    ? u.displayName.charAt(0).toUpperCase()
                                    : "?"}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-theme-text font-black uppercase text-sm">
                                  {u.displayName || "Anonymous"}
                                </div>
                                <div className="text-xs text-gray-800 font-mono">
                                  {u.email || "No email provided"}
                                </div>
                                <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                                  UID: {u.uid}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-theme-bg px-2 py-1 border-2 border-theme-border font-bold">
                              {u.usageLimit || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {u.lastIp ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-theme-bg/50 px-2 py-1 rounded border-4 border-theme-border">
                                  {u.lastIp}
                                </span>
                                <button
                                  onClick={() =>
                                    banUserIpDirectly(
                                      u.lastIp,
                                      `Direct ban from user list for UID: ${u.uid}`,
                                    )
                                  }
                                  className="text-[10px] font-bold uppercase tracking-wider text-white bg-red-500 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:text-red-300 transition-colors hover:bg-red-600 border-4 shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all px-2 py-1 rounded border-red-500/20"
                                >
                                  Ban IP
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-600 font-mono italic">
                                Not tracked
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {u.lastLogin ? (
                              <span>
                                {new Date(u.lastLogin).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-600 font-mono italic">
                                Never
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {u.isPremium ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text px-1 border-2 text-[10px] font-bold uppercase tracking-widest">
                                <Crown className="w-3 h-3" /> Premium
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono text-[10px] font-bold uppercase tracking-widest">
                                Free
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {u.email && (
                                <>
                                  <button
                                    onClick={() => {
                                      setGiveLimitType("email");
                                      setGiveLimitTarget(u.email || "");
                                      setAdminTab("give_limit");
                                    }}
                                    className="text-[10px] font-black uppercase tracking-wider bg-sky-300 hover:bg-sky-400 text-theme-text px-2.5 py-1.5 border-4 border-theme-border transition-all shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-none cursor-pointer"
                                    title="Beri Limit Download"
                                  >
                                    Give Limit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setPremiumEmail(u.email || "");
                                      setAdminTab("give_premium");
                                    }}
                                    className="text-[10px] font-black uppercase tracking-wider bg-[#d8b4fe] hover:bg-[#c084fc] text-theme-text px-2.5 py-1.5 border-4 border-theme-border transition-all shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-none cursor-pointer"
                                    title="Beri Akses Premium"
                                  >
                                    Give Premium
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() =>
                                  toggleUserPremium(u.uid, !!u.isPremium)
                                }
                                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 border-4 border-theme-border transition-all shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-none cursor-pointer ${u.isPremium ? "bg-emerald-400 hover:bg-emerald-500" : "bg-theme-primary hover:brightness-95"}`}
                              >
                                {u.isPremium
                                  ? "Revoke Pro"
                                  : "Grant Pro"}
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Hapus akun ${u.email}? Tindakan ini permanen.`)) {
                                    try {
                                      const res = await fetch(`/api/admin/users/${u.uid}`, { method: "DELETE" });
                                      if (res.ok) {
                                        alert("User berhasil dihapus.");
                                        fetchAdminUsers();
                                      } else {
                                        throw new Error("Gagal menghapus user.");
                                      }
                                    } catch (e: any) {
                                      alert(e.message);
                                    }
                                  }
                                }}
                                className="text-[10px] font-black uppercase tracking-wider bg-red-500 text-white px-3 py-1.5 border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] hover:bg-red-600 transition-all active:translate-y-[1px] active:shadow-none"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {adminUsers.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-8 text-center text-gray-600 font-mono text-sm"
                          >
                            No users found in database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {adminTab === "banned" && (
            <>
              <h1 className="text-3xl font-black mb-6 md:mb-8">
                Ban Control Panel
              </h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-6">
                  <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white bg-red-500 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)]">
                      <ShieldAlert className="w-5 h-5" /> Ban IP Address
                    </h2>
                    <form
                      onSubmit={handleBanIp}
                      className="flex flex-col gap-4"
                    >
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          IP Address
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 192.168.1.1"
                          value={newBanIp}
                          onChange={(e) => setNewBanIp(e.target.value)}
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm font-mono text-theme-text font-black outline-none focus:border-red-500/50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          Reason for Ban
                        </label>
                        <input
                          type="text"
                          placeholder="Abusing API rate limits"
                          value={newBanIpReason}
                          onChange={(e) => setNewBanIpReason(e.target.value)}
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-red-500/50"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-red-500 hover:bg-red-600 text-theme-text font-black font-bold text-xs uppercase tracking-wider py-3 rounded-none transition-colors"
                      >
                        Add IP Ban
                      </button>
                    </form>
                  </div>
                  <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white bg-red-500 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)]">
                      <Users className="w-5 h-5" /> Ban Registered User
                    </h2>
                    <form
                      onSubmit={handleBanUser}
                      className="flex flex-col gap-4"
                    >
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          User ID (UID)
                        </label>
                        <input
                          type="text"
                          placeholder="Firebase User UID"
                          value={newBanUserId}
                          onChange={(e) => setNewBanUserId(e.target.value)}
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm font-mono text-theme-text font-black outline-none focus:border-red-500/50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          User Email
                        </label>
                        <input
                          type="email"
                          placeholder="user@example.com"
                          value={newBanUserEmail}
                          onChange={(e) => setNewBanUserEmail(e.target.value)}
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-red-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          Ban Duration
                        </label>
                        <select
                          value={newBanDuration}
                          onChange={(e) => setNewBanDuration(e.target.value)}
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-red-500/50"
                        >
                          <option value="permanent">Permanent</option>
                          <option value="1day">1 Day</option>
                          <option value="10days">10 Days</option>
                          <option value="30days">30 Days</option>
                          <option value="1year">1 Year</option>
                          <option value="5years">5 Years</option>
                          <option value="10years">10 Years</option>
                          <option value="20years">20 Years</option>
                          <option value="30years">30 Years</option>
                          <option value="40years">40 Years</option>
                          <option value="50years">50 Years</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          Reason for Ban
                        </label>
                        <input
                          type="text"
                          placeholder="Attempting premium bypassing"
                          value={newBanUserReason}
                          onChange={(e) => setNewBanUserReason(e.target.value)}
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-red-500/50"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-red-500 hover:bg-red-600 text-theme-text font-black font-bold text-xs uppercase tracking-wider py-3 rounded-none transition-colors"
                      >
                        Add User Ban
                      </button>
                    </form>
                  </div>
                </div>
                <div className="flex flex-col gap-6">
                  <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none flex-grow text-theme-text">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-theme-text font-black">
                      Active IP Bans ({bannedIps.length})
                    </h2>
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                      {bannedIps.map((b) => (
                        <div
                          key={b.ip}
                          className="flex justify-between items-center bg-theme-bg p-4 rounded-none border-4 border-theme-border hover:border-theme-border transition-colors"
                        >
                          <div className="min-w-0 pr-4">
                            <div className="text-sm font-mono font-bold text-theme-text font-black truncate">
                              {b.ip}
                            </div>
                            <div className="text-xs text-gray-600 font-mono truncate">
                              {b.reason || "No reason specified"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnbanIp(b.ip)}
                            className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-gray-300 hover:text-theme-text bg-theme-primary px-1 border-2 shadow-[2px_2px_0px_var(--theme-shadow)] px-3 py-1.5 rounded transition-colors text-theme-text"
                          >
                            Unban
                          </button>
                        </div>
                      ))}
                      {bannedIps.length === 0 && (
                        <div className="text-center py-8 text-gray-600 font-mono text-sm">
                          No IP addresses currently banned.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none flex-grow text-theme-text">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-theme-text font-black">
                      Active User Bans ({bannedUsers.length})
                    </h2>
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                      {bannedUsers.map((bu) => (
                        <div
                          key={bu.userId}
                          className="flex justify-between items-center bg-theme-bg p-4 rounded-none border-4 border-theme-border hover:border-theme-border transition-colors"
                        >
                          <div className="min-w-0 pr-4">
                            <div className="text-sm font-bold text-theme-text font-black truncate">
                              {bu.email || bu.userId}
                            </div>
                            <div className="text-xs text-gray-600 font-mono truncate">
                              {bu.userId}
                            </div>
                            <div className="text-[10px] text-white bg-red-500 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] italic truncate mt-1">
                              Reason: {bu.reason || "None"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnbanUser(bu.userId)}
                            className="text-[10px] font-bold uppercase tracking-wider bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-gray-300 hover:text-theme-text bg-theme-primary px-1 border-2 shadow-[2px_2px_0px_var(--theme-shadow)] px-3 py-1.5 rounded transition-colors text-theme-text"
                          >
                            Unban
                          </button>
                        </div>
                      ))}
                      {bannedUsers.length === 0 && (
                        <div className="text-center py-8 text-gray-600 font-mono text-sm">
                          No registered users currently banned.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {adminTab === "give_limit" && (
            <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text flex flex-col gap-6">
              <h1 className="text-3xl font-black">Berikan Batas Penggunaan (Limit)</h1>
              <p className="font-medium text-gray-700">Pilih metode untuk memberikan limit ke pengguna tertentu.</p>
              
              <div className="flex gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input type="radio" name="limitType" value="email" checked={giveLimitType === "email"} onChange={() => setGiveLimitType("email")} className="w-5 h-5 accent-yellow-400 border-2 border-theme-border" />
                      Email
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input type="radio" name="limitType" value="uid" checked={giveLimitType === "uid"} onChange={() => setGiveLimitType("uid")} className="w-5 h-5 accent-yellow-400 border-2 border-theme-border" />
                      UID
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input type="radio" name="limitType" value="ip" checked={giveLimitType === "ip"} onChange={() => setGiveLimitType("ip")} className="w-5 h-5 accent-yellow-400 border-2 border-theme-border" />
                      IP Address
                  </label>
              </div>

              <input
                type="text"
                placeholder={giveLimitType === "email" ? "Masukkan Alamat Email..." : giveLimitType === "uid" ? "Masukkan User UID..." : "Masukkan Alamat IP..."}
                value={giveLimitTarget}
                onChange={(e) => setGiveLimitTarget(e.target.value)}
                className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none"
              />
              <select
                value={giveLimitValue}
                onChange={(e) => setGiveLimitValue(e.target.value)}
                className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none"
              >
                {[10, 25, 35, 45, 55, 65, 75, 85, 95, 150, 250, "permanent"].map(l => (
                    <option key={l} value={l}>{l === "permanent" ? "Permanen (Unlimited)" : `+${l} Kuota`}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                    if (!giveLimitTarget.trim()) {
                        alert("Harap masukkan target yang valid!");
                        return;
                    }
                    try {
                        setAuthLoadingState(true);
                        await grantLimitToTarget(giveLimitType, giveLimitTarget, giveLimitValue);
                        alert(`Berhasil menambahkan ${giveLimitValue} limit ke ${giveLimitType.toUpperCase()} ${giveLimitTarget}`);
                        setGiveLimitTarget("");
                        fetchAdminUsers();
                    } catch (err: any) {
                        alert(err.message || "Failed to give limit");
                    } finally {
                        setAuthLoadingState(false);
                    }
                }}
                disabled={authLoadingState}
                className="w-full bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] py-4 font-black uppercase text-sm tracking-widest text-center cursor-pointer disabled:opacity-50 text-theme-text"
              >
                {authLoadingState ? "Memproses..." : "Berikan Limit"}
              </button>
            </div>
          )}
          {adminTab === "give_premium" && (
            <>
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h1 className="text-3xl font-black text-theme-text">
                    Akses Premium Pro
                  </h1>
                  <p className="text-xs text-gray-800 font-mono mt-1">
                    Berikan akses premium langsung kepada pengguna terdaftar berdasarkan email mereka.
                  </p>
                </div>
              </div>

              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text flex flex-col gap-6">
                <div className="space-y-4">
                  {authError && (
                    <div className="bg-red-100 border-2 border-red-500 p-3 text-xs text-red-700 font-mono font-bold">
                      {authError}
                    </div>
                  )}
                  {authMessage && (
                    <div className="bg-emerald-100 border-2 border-emerald-500 p-3 text-xs text-emerald-700 font-mono font-bold">
                      {authMessage}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Email Pengguna
                      </label>
                      <input
                        type="email"
                        value={premiumEmail}
                        onChange={(e) => setPremiumEmail(e.target.value)}
                        placeholder="contoh@gmail.com"
                        className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-sm font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Durasi Premium Pro
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: "1 Hari", days: 1 },
                          { label: "10 Hari", days: 10 },
                          { label: "40 Hari", days: 40 },
                          { label: "60 Hari", days: 60 },
                          { label: "1 Tahun", days: 365 },
                          { label: "Permanen", days: 99999 },
                        ].map((item) => (
                          <button
                            key={item.days}
                            type="button"
                            onClick={() => setPremiumDays(item.days)}
                            className={`px-4 py-3 border-4 border-theme-border font-black text-xs sm:text-sm uppercase tracking-wider shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--theme-shadow)] transition-all cursor-pointer ${
                              premiumDays === item.days
                                ? "bg-theme-primary text-theme-text"
                                : "bg-theme-panel hover:bg-gray-100 text-theme-text"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!premiumEmail) {
                        setAuthError("Harap masukkan email pengguna terlebih dahulu!");
                        return;
                      }
                      setAuthLoadingState(true);
                      setAuthError("");
                      setAuthMessage("");
                      try {
                        const result = await grantPremiumByEmail(premiumEmail, premiumDays);
                        setAuthMessage(`Berhasil memberikan akses Premium Pro selama ${premiumDays === 1 ? "1 Hari" : premiumDays === 10 ? "10 Hari" : premiumDays === 40 ? "40 Hari" : premiumDays === 60 ? "60 Hari" : premiumDays === 365 ? "1 Tahun" : "5 Tahun"} kepada email ${result.email}!`);
                        setPremiumEmail("");
                      } catch (err: any) {
                        setAuthError(getFriendlyAuthError(err));
                      } finally {
                        setAuthLoadingState(false);
                      }
                    }}
                    disabled={authLoadingState}
                    className="w-full bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all py-4 font-black uppercase text-sm tracking-widest text-center cursor-pointer mt-4 text-theme-text"
                  >
                    {authLoadingState ? "Memproses..." : "Berikan Akses Premium Pro"}
                  </button>
                </div>
              </div>
            </>
          )}
          {adminTab === "give_premium_bonus" && (
            <>
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h1 className="text-3xl font-black text-theme-text">
                    Akses Premium + Bonus Limit Permanen
                  </h1>
                  <p className="text-xs text-gray-800 font-mono mt-1">
                    Berikan akses premium dan bonus limit permanen sekaligus kepada pengguna terdaftar berdasarkan email mereka.
                  </p>
                </div>
              </div>

              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text flex flex-col gap-6">
                <div className="space-y-4">
                  {authError && (
                    <div className="bg-red-100 border-2 border-red-500 p-3 text-xs text-red-700 font-mono font-bold">
                      {authError}
                    </div>
                  )}
                  {authMessage && (
                    <div className="bg-emerald-100 border-2 border-emerald-500 p-3 text-xs text-emerald-700 font-mono font-bold">
                      {authMessage}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Email Pengguna
                      </label>
                      <input
                        type="email"
                        value={premiumBonusEmail}
                        onChange={(e) => setPremiumBonusEmail(e.target.value)}
                        placeholder="contoh@gmail.com"
                        className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-sm font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2 flex justify-between items-center">
                        <span>Durasi Paket (+ Bonus Limit Permanen)</span>
                        <span className="bg-green-100 border border-green-500 px-2 py-0.5 text-[10px] text-green-700 font-bold font-mono">BONUS: LIMIT PERMANEN</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "1 Hari", days: 1 },
                          { label: "10 Hari", days: 10 },
                          { label: "20 Hari", days: 20 },
                          { label: "1 Bulan", days: 30 },
                          { label: "1 Tahun", days: 365 },
                          { label: "2 Tahun", days: 730 },
                          { label: "5 Tahun", days: 1825 },
                        ].map((item) => (
                          <button
                            key={item.days}
                            type="button"
                            onClick={() => setPremiumBonusDays(item.days)}
                            className={`px-4 py-3 border-4 border-theme-border font-black text-xs sm:text-sm uppercase tracking-wider shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--theme-shadow)] transition-all cursor-pointer ${
                              premiumBonusDays === item.days
                                ? "bg-green-400 text-theme-text animate-pulse"
                                : "bg-theme-panel hover:bg-gray-100 text-theme-text"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!premiumBonusEmail) {
                        setAuthError("Harap masukkan email pengguna terlebih dahulu!");
                        return;
                      }
                      setAuthLoadingState(true);
                      setAuthError("");
                      setAuthMessage("");
                      try {
                        const result = await grantPremiumWithLimitByEmail(premiumBonusEmail, premiumBonusDays, "permanent");
                        const displayDuration = 
                          premiumBonusDays === 1 ? "1 Hari" :
                          premiumBonusDays === 10 ? "10 Hari" :
                          premiumBonusDays === 20 ? "20 Hari" :
                          premiumBonusDays === 30 ? "1 Bulan" :
                          premiumBonusDays === 365 ? "1 Tahun" :
                          premiumBonusDays === 730 ? "2 Tahun" : "5 Tahun";
                        
                        setAuthMessage(`Berhasil memberikan akses Premium selama ${displayDuration} dengan Bonus Limit Permanen kepada email ${result.email}!`);
                        setPremiumBonusEmail("");
                      } catch (err: any) {
                        setAuthError(getFriendlyAuthError(err));
                      } finally {
                        setAuthLoadingState(false);
                      }
                    }}
                    disabled={authLoadingState}
                    className="w-full bg-green-500 hover:bg-green-400 text-white border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all py-4 font-black uppercase text-sm tracking-widest text-center cursor-pointer mt-4"
                  >
                    {authLoadingState ? "Memproses..." : "Berikan Akses Premium + Limit Permanen"}
                  </button>
                </div>
              </div>
            </>
          )}

          {adminTab === "ads" && (
            <div className="text-theme-text font-bold p-6 border-4 border-theme-border bg-theme-panel shadow-[8px_8px_0px_var(--theme-shadow)]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-black text-theme-text">Ad & Anti-Adblock Settings</h1>
                  <p className="text-xs text-gray-800 font-mono mt-1">
                    Manage advertisement placements and control anti-adblock restrictions.
                  </p>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updateGlobalSettings(globalSettings);
                  alert("Ad and Anti-Adblock settings saved successfully!");
                } catch (err: any) {
                  alert("Error saving ad settings: " + (err.message || String(err)));
                }
              }} className="flex flex-col gap-6">
                {/* Ads Section */}
                <div className="border-4 border-theme-border p-4 bg-theme-bg">
                  <h2 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 border-2 border-theme-border rounded-full animate-pulse"></span>
                    Advertisement Settings / Pengaturan Iklan
                  </h2>

                  <div className="space-y-4">
                    {/* General Ads Toggle */}
                    <div className="flex items-center gap-3 bg-theme-panel border-2 border-theme-border p-3 shadow-[2px_2px_0px_var(--theme-shadow)]">
                      <input
                        type="checkbox"
                        checked={globalSettings.adsEnabled || false}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            adsEnabled: e.target.checked,
                          })
                        }
                        className="w-5 h-5 border-4 border-theme-border rounded text-theme-text bg-theme-primary px-1 border-2 shadow-[2px_2px_0px_var(--theme-shadow)] outline-none focus:ring-0 cursor-pointer"
                        id="adsEnabled"
                      />
                      <label htmlFor="adsEnabled" className="text-sm font-bold uppercase cursor-pointer">
                        Enable Ads System / Aktifkan Sistem Iklan
                      </label>
                    </div>

                    {/* Conditional subsettings for Ads */}
                    {globalSettings.adsEnabled && (
                      <div className="pl-4 border-l-4 border-theme-border space-y-4">
                        {/* Top Banner Code */}
                        <div className="bg-theme-panel border-2 border-theme-border p-4 shadow-[4px_4px_0px_var(--theme-shadow)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-800 font-mono uppercase tracking-wider">
                              Top Banner Ad / Iklan Banner Atas
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={globalSettings.ads?.bannerTopEnabled || false}
                                onChange={(e) =>
                                  setGlobalSettings({
                                    ...globalSettings,
                                    ads: {
                                      ...(globalSettings.ads || {
                                        bannerTopEnabled: true,
                                        bannerTopCode: "",
                                        bannerBottomEnabled: true,
                                        bannerBottomCode: "",
                                        popunderEnabled: false,
                                        popunderCode: "",
                                      }),
                                      bannerTopEnabled: e.target.checked,
                                    }
                                  })
                                }
                                className="w-4 h-4 border-2 border-theme-border rounded text-theme-text bg-theme-primary cursor-pointer"
                                id="bannerTopEnabled"
                              />
                              <label htmlFor="bannerTopEnabled" className="text-xs font-bold uppercase cursor-pointer">
                                Active / Aktif
                              </label>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={globalSettings.ads?.bannerTopCode || ""}
                            onChange={(e) =>
                              setGlobalSettings({
                                ...globalSettings,
                                ads: {
                                  ...(globalSettings.ads || {
                                    bannerTopEnabled: true,
                                    bannerTopCode: "",
                                    bannerBottomEnabled: true,
                                    bannerBottomCode: "",
                                    popunderEnabled: false,
                                    popunderCode: "",
                                  }),
                                  bannerTopCode: e.target.value,
                                }
                              })
                            }
                            className="w-full font-mono text-xs border-2 border-theme-border p-2 bg-yellow-50 focus:bg-theme-panel focus:outline-none"
                            placeholder="<!-- Paste your top ad HTML/JS code here -->"
                          />
                        </div>

                        {/* Bottom Banner Code */}
                        <div className="bg-theme-panel border-2 border-theme-border p-4 shadow-[4px_4px_0px_var(--theme-shadow)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-800 font-mono uppercase tracking-wider">
                              Bottom Banner Ad / Iklan Banner Bawah
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={globalSettings.ads?.bannerBottomEnabled || false}
                                onChange={(e) =>
                                  setGlobalSettings({
                                    ...globalSettings,
                                    ads: {
                                      ...(globalSettings.ads || {
                                        bannerTopEnabled: true,
                                        bannerTopCode: "",
                                        bannerBottomEnabled: true,
                                        bannerBottomCode: "",
                                        popunderEnabled: false,
                                        popunderCode: "",
                                      }),
                                      bannerBottomEnabled: e.target.checked,
                                    }
                                  })
                                }
                                className="w-4 h-4 border-2 border-theme-border rounded text-theme-text bg-theme-primary cursor-pointer"
                                id="bannerBottomEnabled"
                              />
                              <label htmlFor="bannerBottomEnabled" className="text-xs font-bold uppercase cursor-pointer">
                                Active / Aktif
                              </label>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={globalSettings.ads?.bannerBottomCode || ""}
                            onChange={(e) =>
                              setGlobalSettings({
                                ...globalSettings,
                                ads: {
                                  ...(globalSettings.ads || {
                                    bannerTopEnabled: true,
                                    bannerTopCode: "",
                                    bannerBottomEnabled: true,
                                    bannerBottomCode: "",
                                    popunderEnabled: false,
                                    popunderCode: "",
                                  }),
                                  bannerBottomCode: e.target.value,
                                }
                              })
                            }
                            className="w-full font-mono text-xs border-2 border-theme-border p-2 bg-yellow-50 focus:bg-theme-panel focus:outline-none"
                            placeholder="<!-- Paste your bottom ad HTML/JS code here -->"
                          />
                        </div>

                        {/* Popunder Ad Code */}
                        <div className="bg-theme-panel border-2 border-theme-border p-4 shadow-[4px_4px_0px_var(--theme-shadow)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-800 font-mono uppercase tracking-wider">
                              Popunder / Redirect Ad Script
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={globalSettings.ads?.popunderEnabled || false}
                                onChange={(e) =>
                                  setGlobalSettings({
                                    ...globalSettings,
                                    ads: {
                                      ...(globalSettings.ads || {
                                        bannerTopEnabled: true,
                                        bannerTopCode: "",
                                        bannerBottomEnabled: true,
                                        bannerBottomCode: "",
                                        popunderEnabled: false,
                                        popunderCode: "",
                                      }),
                                      popunderEnabled: e.target.checked,
                                    }
                                  })
                                }
                                className="w-4 h-4 border-2 border-theme-border rounded text-theme-text bg-theme-primary cursor-pointer"
                                id="popunderEnabled"
                              />
                              <label htmlFor="popunderEnabled" className="text-xs font-bold uppercase cursor-pointer">
                                Active / Aktif
                              </label>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={globalSettings.ads?.popunderCode || ""}
                            onChange={(e) =>
                              setGlobalSettings({
                                ...globalSettings,
                                ads: {
                                  ...(globalSettings.ads || {
                                    bannerTopEnabled: true,
                                    bannerTopCode: "",
                                    bannerBottomEnabled: true,
                                    bannerBottomCode: "",
                                    popunderEnabled: false,
                                    popunderCode: "",
                                  }),
                                  popunderCode: e.target.value,
                                }
                              })
                            }
                            className="w-full font-mono text-xs border-2 border-theme-border p-2 bg-yellow-50 focus:bg-theme-panel focus:outline-none"
                            placeholder="<!-- Paste your popunder HTML/JS script here -->"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Anti-Adblock Section */}
                <div className="border-4 border-theme-border p-4 bg-theme-bg">
                  <h2 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 bg-theme-primary border-2 border-theme-border rounded-full"></span>
                    Anti-Adblock Settings / Pengaturan Anti-Adblock
                  </h2>

                  <div className="space-y-4">
                    {/* General Anti-Adblock Toggle */}
                    <div className="flex items-center gap-3 bg-theme-panel border-2 border-theme-border p-3 shadow-[2px_2px_0px_var(--theme-shadow)]">
                      <input
                        type="checkbox"
                        checked={globalSettings.antiAdblockEnabled || false}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            antiAdblockEnabled: e.target.checked,
                          })
                        }
                        className="w-5 h-5 border-4 border-theme-border rounded text-theme-text bg-theme-primary px-1 border-2 shadow-[2px_2px_0px_var(--theme-shadow)] outline-none focus:ring-0 cursor-pointer"
                        id="antiAdblockEnabled"
                      />
                      <label htmlFor="antiAdblockEnabled" className="text-sm font-bold uppercase cursor-pointer">
                        Enable Anti-Adblock / Aktifkan Deteksi Adblock
                      </label>
                    </div>

                    {/* Conditional Block Downloads Toggle */}
                    {globalSettings.antiAdblockEnabled && (
                      <div className="pl-4 border-l-4 border-theme-border space-y-4">
                        <div className="flex items-center gap-3 bg-theme-panel border-2 border-theme-border p-3 shadow-[2px_2px_0px_var(--theme-shadow)]">
                          <input
                            type="checkbox"
                            checked={globalSettings.antiAdblockBlockDownloads || false}
                            onChange={(e) =>
                              setGlobalSettings({
                                ...globalSettings,
                                antiAdblockBlockDownloads: e.target.checked,
                              })
                            }
                            className="w-5 h-5 border-4 border-theme-border rounded text-theme-text bg-theme-primary px-1 border-2 shadow-[2px_2px_0px_var(--theme-shadow)] outline-none focus:ring-0 cursor-pointer"
                            id="antiAdblockBlockDownloads"
                          />
                          <label htmlFor="antiAdblockBlockDownloads" className="text-sm font-bold uppercase cursor-pointer text-red-600">
                            Block Downloads / Blokir Tombol Unduh Jika Adblock Aktif
                          </label>
                        </div>
                        <p className="text-xs text-gray-600 font-mono pl-1">
                          When checked, users must disable their AdBlock extension before they can download videos, forcing them to view the ads.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  className="w-full bg-theme-primary hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all py-4 font-black uppercase text-sm tracking-widest text-center cursor-pointer mt-2"
                >
                  Save Ad Settings / Simpan Pengaturan
                </button>
              </form>
            </div>
          )}
          {adminTab === "products" && (
            <AdminProductsView />
          )}
          {adminTab === "feedbacks" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-black text-theme-text uppercase">
                  Daftar Feedback Pengguna
                </h1>
                <p className="text-xs text-gray-800 font-mono mt-1">
                  Menerima masukan fitur dan laporan bug langsung dari pengguna SaveTik.
                </p>
              </div>

              {feedbacks.length === 0 ? (
                <div className="bg-theme-panel border-4 border-theme-border rounded-none shadow-[4px_4px_0px_var(--theme-shadow)] p-12 text-center text-gray-500 font-mono uppercase text-sm">
                  📭 Belum ada feedback dari pengguna.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {feedbacks.map((f) => (
                    <div
                      key={f.id}
                      className="bg-theme-panel border-4 border-theme-border rounded-none shadow-[6px_6px_0px_var(--theme-shadow)] p-5 relative flex flex-col gap-3 text-theme-text"
                    >
                      {/* Top Header Row of Item */}
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-none text-xs font-black uppercase border-2 border-theme-border ${
                              f.category === "bug"
                                ? "bg-red-950 text-red-400 border-red-800"
                                : "bg-emerald-950 text-emerald-400 border-emerald-800"
                            }`}
                          >
                            {f.category === "bug" ? "🐞 BUG" : "💡 FITUR"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-none text-[10px] font-mono border-2 ${
                              f.status === "resolved"
                                ? "bg-green-950 text-green-400 border-green-800"
                                : "bg-yellow-950 text-yellow-400 border-yellow-800"
                            }`}
                          >
                            {f.status === "resolved" ? "Selesai" : "Belum dibaca"}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {f.timestamp ? new Date(f.timestamp).toLocaleString("id-ID") : "Tanpa Tanggal"}
                        </span>
                      </div>

                      {/* Feedback Text Content */}
                      <div className="bg-theme-bg text-theme-text p-4 border-2 border-theme-border rounded-none text-sm font-bold whitespace-pre-wrap">
                        {f.details}
                      </div>

                      {/* Sender and Contact info */}
                      <div className="flex justify-between items-center flex-wrap gap-2 text-xs font-mono text-gray-400 border-t border-theme-border/20 pt-3">
                        <div>
                          <span className="font-bold">Pengirim:</span>{" "}
                          <span className="text-theme-text">
                            {f.userEmail ? f.userEmail : "Guest"}
                          </span>
                        </div>
                        {f.contact && (
                          <div>
                            <span className="font-bold">Hubungi:</span> <span className="bg-theme-bg text-theme-text border-2 border-theme-border px-1.5 py-0.5 rounded-none">{f.contact}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-end gap-2 mt-2">
                        {f.status !== "resolved" && (
                          <button
                            onClick={async () => {
                              try {
                                await updateFeedbackStatus(f.id, "resolved");
                              } catch (err: any) {
                                alert("Gagal update status: " + err.message);
                              }
                            }}
                            className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white font-bold border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] rounded-none text-xs uppercase tracking-wider cursor-pointer"
                          >
                            Tandai Selesai
                          </button>
                        )}
                        
                        {feedbackConfirmDeleteId === f.id ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={async () => {
                                try {
                                  console.log("Deleting feedback with ID:", f.id);
                                  await deleteFeedback(f.id);
                                  setFeedbackConfirmDeleteId(null);
                                } catch (err: any) {
                                  alert("Gagal menghapus feedback: " + err.message);
                                }
                              }}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] rounded-none text-xs uppercase tracking-wider cursor-pointer animate-pulse"
                            >
                              Yakin Hapus?
                            </button>
                            <button
                              onClick={() => setFeedbackConfirmDeleteId(null)}
                              className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] rounded-none text-xs uppercase tracking-wider cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setFeedbackConfirmDeleteId(f.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] rounded-none text-xs uppercase tracking-wider cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {adminTab === "settings" && (
            <>
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div>
                  <h1 className="text-3xl font-black text-theme-text">
                    Platform Settings
                  </h1>
                  <p className="text-xs text-gray-800 font-mono mt-1">
                    Manage limits, api endpoints, and system behaviors.
                  </p>
                </div>
              </div>

              <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-theme-text flex flex-col gap-6">
                <form
                  onSubmit={handleSaveSettings}
                  className="flex flex-col gap-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Website Name / Judul Website
                      </label>
                      <input
                        type="text"
                        value={globalSettings.websiteName || ""}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            websiteName: e.target.value,
                          })
                        }
                        className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                        required
                        placeholder="SAVETIK"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Guest Free Daily Limit (Tanpa Login)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={globalSettings.freeLimit || 5}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            freeLimit: Number(e.target.value),
                          })
                        }
                        className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Logged In Daily Limit (Sudah Login)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={globalSettings.loginLimit || 5}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            loginLimit: Number(e.target.value),
                          })
                        }
                        className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        First Login Limit (Bonus Member Baru)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={globalSettings.initialLimit || 0}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            initialLimit: Number(e.target.value),
                          })
                        }
                        className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                        Premium Limit Duration
                      </label>
                      <select
                        value={globalSettings.premiumLimitType || "no_limit"}
                        onChange={(e) =>
                          setGlobalSettings({
                            ...globalSettings,
                            premiumLimitType: e.target.value as any,
                          })
                        }
                        className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                      >
                        <option value="no_limit">No Limit</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {globalSettings.premiumLimitType !== "no_limit" && (
                      <div>
                        <label className="block text-xs font-bold text-gray-800 font-mono uppercase tracking-wider mb-2">
                          Premium Limit Value
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={globalSettings.premiumLimitValue || 100}
                          onChange={(e) =>
                            setGlobalSettings({
                              ...globalSettings,
                              premiumLimitValue: Number(e.target.value),
                            })
                          }
                          className="w-full bg-theme-bg border-4 border-theme-border rounded-none px-4 py-3 text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[8px_8px_0px_var(--theme-shadow)] transition-all"
                          required
                        />
                        <span className="text-[10px] text-gray-600 font-mono mt-1 block">
                          Max downloads allowed within the chosen period.
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col justify-center">
                      <label className="flex items-center gap-3 cursor-pointer select-none mt-2">
                        <input
                          type="checkbox"
                          checked={globalSettings.isMaintenance || false}
                          onChange={(e) =>
                            setGlobalSettings({
                              ...globalSettings,
                              isMaintenance: e.target.checked,
                            })
                          }
                          className="w-5 h-5 border-4 border-theme-border rounded text-theme-text bg-theme-primary px-1 border-2 shadow-[2px_2px_0px_var(--theme-shadow)] outline-none focus:ring-0 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-theme-text font-black">
                            Enable Maintenance Mode
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono">
                            Only Admins can use the app if active.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="border-t-4 border-theme-border pt-6 mt-2 space-y-6">
                    <h3 className="text-sm font-bold text-theme-text font-black uppercase tracking-wider flex items-center gap-2">
                      DAFTAR & KUSTOMISASI PENYEDIA API TIKTOK (EDITABLE)
                    </h3>
                    
                    <div className="bg-theme-bg/50 p-4 rounded-none border-4 border-theme-border space-y-6">
                      
                      {/* TikTok API URL Input */}
                      <div>
                        <label className="block text-xs font-bold text-theme-text font-mono uppercase tracking-wider mb-2">
                          TIKTOK API URL (BASE URL)
                        </label>
                        <input
                          type="text"
                          value={globalSettings.tiktokApiUrl || ""}
                          onChange={(e) =>
                            setBottomSafeSettings("tiktokApiUrl", e.target.value)
                          }
                          placeholder="https://www.tikwm.com/api/"
                          className="w-full bg-theme-primary border-4 border-theme-border rounded-none px-4 py-3 text-xs sm:text-sm text-theme-text font-black font-mono outline-none focus:border-theme-border focus:shadow-[4px_4px_0px_var(--theme-shadow)] transition-all"
                          required
                        />
                        <p className="text-[10px] text-gray-600 font-mono mt-1">
                          Base URL API TikTok yang aktif untuk memproses unduhan (contoh: https://www.tikwm.com/api/).
                        </p>
                      </div>

                    </div>
                  </div>

                  <div className="border-t-4 border-theme-border pt-6 mt-2 space-y-6">
                    <h3 className="text-sm font-bold text-theme-text font-black uppercase tracking-wider flex items-center gap-2">
                      💛 PENGATURAN SUPPORT / DONASI (EDITABLE)
                    </h3>
                    
                    <div className="bg-theme-bg/50 p-4 rounded-none border-4 border-theme-border space-y-6">
                      {/* QRIS Image URL */}
                      <div>
                        <label className="block text-xs font-bold text-theme-text font-mono uppercase tracking-wider mb-2">
                          FOTO QRIS (IMAGE URL / PATH ASSET)
                        </label>
                        <input
                          type="text"
                          value={globalSettings.qrisImageUrl || ""}
                          onChange={(e) =>
                            setGlobalSettings({
                              ...globalSettings,
                              qrisImageUrl: e.target.value,
                            })
                          }
                          placeholder="/src/assets/images/qris_donation_1784202976592.jpg"
                          className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-xs sm:text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[4px_4px_0px_var(--theme-shadow)] transition-all"
                          required
                        />
                        <p className="text-[10px] text-gray-600 font-mono mt-1">
                          Masukkan URL gambar QRIS donasi atau path asset (default: <code>/src/assets/images/qris_donation_1784202976592.jpg</code>).
                        </p>
                      </div>

                      {/* Contact Owner Link */}
                      <div>
                        <label className="block text-xs font-bold text-theme-text font-mono uppercase tracking-wider mb-2">
                          CONTACT OWNER / NOMOR OWNER LINK
                        </label>
                        <input
                          type="text"
                          value={globalSettings.contactOwnerUrl || ""}
                          onChange={(e) =>
                            setGlobalSettings({
                              ...globalSettings,
                              contactOwnerUrl: e.target.value,
                            })
                          }
                          placeholder="https://wa.me/628888573485"
                          className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-xs sm:text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[4px_4px_0px_var(--theme-shadow)] transition-all"
                          required
                        />
                        <p className="text-[10px] text-gray-600 font-mono mt-1">
                          Link untuk tombol Hubungi Owner (contoh: WhatsApp link <code>https://wa.me/628888573485</code>).
                        </p>
                      </div>

                      {/* Website Buy Otomatis Link */}
                      <div>
                        <label className="block text-xs font-bold text-theme-text font-mono uppercase tracking-wider mb-2">
                          WEBSITE BUY OTOMATIS / LINK WEBSITE BEBAS
                        </label>
                        <input
                          type="text"
                          value={globalSettings.websiteBuyOtomatisUrl || ""}
                          onChange={(e) =>
                            setGlobalSettings({
                              ...globalSettings,
                              websiteBuyOtomatisUrl: e.target.value,
                            })
                          }
                          placeholder="https://download.amane-acel.web.id"
                          className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-xs sm:text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[4px_4px_0px_var(--theme-shadow)] transition-all"
                          required
                        />
                        <p className="text-[10px] text-gray-600 font-mono mt-1">
                          Link untuk tombol Website Beli Otomatis (contoh: <code>https://download.amane-acel.web.id</code>).
                        </p>
                      </div>

                      {/* Scan QRIS di atas buat donasi suka-suka */}
                      <div>
                        <label className="block text-xs font-bold text-theme-text font-mono uppercase tracking-wider mb-2">
                          TEKS PETUNJUK DONASI (BUKAN TOMBOL)
                        </label>
                        <input
                          type="text"
                          value={globalSettings.scanQrisText || ""}
                          onChange={(e) =>
                            setGlobalSettings({
                              ...globalSettings,
                              scanQrisText: e.target.value,
                            })
                          }
                          placeholder="Scan QRIS di atas buat donasi suka-suka"
                          className="w-full bg-theme-bg border-4 border-theme-border px-4 py-3 text-xs sm:text-sm text-theme-text font-black outline-none focus:border-theme-border focus:shadow-[4px_4px_0px_var(--theme-shadow)] transition-all"
                          required
                        />
                        <p className="text-[10px] text-gray-600 font-mono mt-1">
                          Teks penjelas di bawah yang menandakan donasi menggunakan QRIS di atas secara suka-suka.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all text-theme-text font-black text-sm uppercase tracking-wider py-4 rounded-none transition-colors mt-4"
                  >
                    Save Configuration
                  </button>
                </form>
              </div>
            </>
          )}
          {adminTab === "api_status" && (
            <>
              <div className="flex justify-between items-center mb-6 md:mb-8 flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-black text-theme-text">
                    Scraper API Health Monitor
                  </h1>
                  <p className="text-xs text-gray-800 font-mono mt-1">
                    Check active response times, status codes, and server-side
                    scraper health indicators.
                  </p>
                </div>
                <button
                  onClick={fetchApiHealth}
                  disabled={apiHealthLoading}
                  className="px-5 py-2.5 bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] active:translate-y-[4px] active:translate-x-[4px] active:shadow-none transition-all text-theme-text font-black font-bold text-xs uppercase tracking-wider rounded-none flex items-center gap-2 disabled:bg-gray-200 shadow-[4px_4px_0px_var(--theme-shadow)] disabled:text-gray-600 font-mono"
                >
                  <Activity
                    className={`w-4 h-4 ${apiHealthLoading ? "animate-spin" : ""}`}
                  />
                  {apiHealthLoading ? "Pinging Nodes..." : "Ping APIs Now"}
                </button>
              </div>
              {apiHealthError && (
                <div className="mb-6 bg-red-400 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] p-4 rounded-none text-white bg-red-500 border-2 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{apiHealthError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* TikTok Node card */}
                <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none flex flex-col justify-between text-theme-text">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-black rounded-none flex items-center justify-center border-4 border-theme-border">
                          <span className="font-black text-xs text-rose-500 font-mono">
                            TK
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-theme-text font-black">
                            TikTok Scraper API
                          </h3>
                          <span className="text-[10px] text-gray-600 font-mono block max-w-[200px] truncate">
                            {globalSettings.tiktokApiUrl}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${apiHealth?.tiktok?.status === "online" ? "bg-theme-primary border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] border-4 border-theme-border border-emerald-500/20" : apiHealthLoading ? "bg-gray-200 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] text-gray-800 font-mono" : "bg-red-400 border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-white bg-red-500 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] border-4 border-theme-border border-red-500/20"}`}
                      >
                        {apiHealthLoading
                          ? "Pinging..."
                          : apiHealth?.tiktok?.status || "Unknown"}
                      </span>
                    </div>
                    <div className="space-y-4 my-6">
                      <div className="flex justify-between items-center border-b-4 border-theme-border pb-2">
                        <span className="text-xs text-gray-800 font-mono font-medium">
                          Scraper Type
                        </span>
                        <span className="text-xs text-theme-text font-black font-bold">
                          Unified TikTok API Scraper
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b-4 border-theme-border pb-2">
                        <span className="text-xs text-gray-800 font-mono font-medium">
                          HTTP Method
                        </span>
                        <span className="text-xs text-blue-400 font-mono font-bold">
                          GET
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b-4 border-theme-border pb-2">
                        <span className="text-xs text-gray-800 font-mono font-medium">
                          HTTP Status Code
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${apiHealth?.tiktok?.statusCode === 200 ? "text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "text-gray-800 font-mono"}`}
                        >
                          {apiHealth?.tiktok?.statusCode || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-800 font-mono font-medium">
                          Active Latency
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${(apiHealth?.tiktok?.latency || 0) < 600 ? "text-theme-text bg-theme-primary px-1 border-2 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]" : "text-orange-400"}`}
                        >
                          {apiHealth?.tiktok?.latency
                            ? `${apiHealth.tiktok.latency}ms`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {apiHealth?.tiktok?.latency && (
                    <div className="mt-2">
                      <div className="w-full bg-theme-bg h-2 rounded-none overflow-hidden border-4 border-theme-border">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${apiHealth.tiktok.latency < 500 ? "bg-emerald-500" : apiHealth.tiktok.latency < 1500 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{
                            width: `${Math.min(100, Math.max(10, 100 - apiHealth.tiktok.latency / 20))}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-600 font-mono mt-1.5 block">
                        Speed index evaluation: Good.
                      </span>
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const isSuperAdmin = user?.email === "jrnabil570@gmail.com";

  let hasNoLimitLeft = false;
  let sisaLimitVal = 5;
  if (user && userData && !isPremium && !isSuperAdmin) {
    const rawLimit = userData.usageLimit;
    if (rawLimit === "permanent") {
      hasNoLimitLeft = false;
      sisaLimitVal = 999999;
    } else {
      const history = userData.downloadHistory || [];
      const todayDownloads = history.filter((ts: string) => new Date(ts).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
      const maxDailyLimit = globalSettings.initialLimit || 5;
      const remainingDaily = Math.max(0, maxDailyLimit - todayDownloads);
      
      const rwLimit = Number(rawLimit) || 0;
      const totalRemaining = remainingDaily + rwLimit;
      
      sisaLimitVal = totalRemaining;
      if (totalRemaining <= 0) {
        hasNoLimitLeft = true;
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-theme-bg font-sans md:border-8 border-4 border-theme-border relative pb-12 text-theme-text page-outer-border">
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-theme-primary/5 rounded-none blur-[100px] pointer-events-none"></div>

      {/* Header Bar */}
      <header className="border-b-4 border-theme-border bg-theme-panel p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-theme-primary flex items-center justify-center border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] font-black text-xl text-theme-text">
              S
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
              <span className="text-xl font-black tracking-tight uppercase leading-none">
                {globalSettings.websiteName || "SAVETIK"}
              </span>
              <span className="text-[10px] font-mono text-gray-500 font-bold lowercase leading-none">
                downloader
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Navigation Menu */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const nextTheme = theme === "default" ? "tactical" : "default";
                    setTheme(nextTheme);
                    localStorage.setItem("user-theme", nextTheme);
                  }}
                  className="w-10 h-10 bg-theme-panel text-theme-text border-2 border-theme-border rounded shadow-[3px_3px_0px_var(--theme-shadow)] flex items-center justify-center hover:brightness-95 transition-all cursor-pointer"
                  title={theme === "default" ? "Mode Gelap (Hitam)" : "Mode Terang (Putih)"}
                >
                  {theme === "default" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => {
                    setShowNavMenu(!showNavMenu);
                  }}
                  className="w-10 h-10 bg-theme-panel text-theme-text border-2 border-theme-border rounded shadow-[3px_3px_0px_var(--theme-shadow)] flex items-center justify-center hover:brightness-95 transition-all cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>

              {showNavMenu && (
                <div className="absolute top-14 left-0 sm:left-auto sm:right-0 w-64 bg-theme-panel border-2 border-theme-border rounded-lg shadow-[4px_4px_0px_var(--theme-shadow)] z-50 flex flex-col py-2">
                  <button
                    onClick={() => {
                      setView("main");
                      setShowNavMenu(false);
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm text-theme-text opacity-90 font-mono font-bold hover:brightness-95 transition-colors text-left uppercase tracking-wider cursor-pointer"
                  >
                    <Home className="w-4 h-4" /> MENU UTAMA
                  </button>
                  <button
                    onClick={() => {
                      setView("how_to_use");
                      setShowNavMenu(false);
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm text-theme-text opacity-90 font-mono font-bold hover:brightness-95 transition-colors text-left uppercase tracking-wider cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" /> CARA PENGGUNAAN
                  </button>
                  <button
                    onClick={() => {
                      setView("restrictions");
                      setShowNavMenu(false);
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm text-theme-text opacity-90 font-mono font-bold hover:brightness-95 transition-colors text-left uppercase tracking-wider cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> LARANGAN PENGGUNAAN
                  </button>
                  <button
                    onClick={() => {
                      setView("support_donation");
                      setShowNavMenu(false);
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm text-theme-text opacity-90 font-mono font-bold hover:brightness-95 transition-colors text-left uppercase tracking-wider cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4" /> SUPPORT / DONASI
                  </button>
                  <button
                    onClick={() => {
                      setView("feedback");
                      setShowNavMenu(false);
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm text-theme-text opacity-90 font-mono font-bold hover:brightness-95 transition-colors text-left uppercase tracking-wider cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" /> FEEDBACK
                  </button>
                  <div className="h-px bg-theme-border/20 my-2 mx-4"></div>
                  <button
                    onClick={() => {
                      setShowNavMenu(false);
                      alert(language === "EN" ? "PWA App available! Tap your browser options and select 'Add to Home Screen' to install." : "Aplikasi PWA tersedia! Ketuk tombol menu browser Anda dan pilih 'Tambahkan ke Layar Utama'.");
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 text-sm text-theme-text opacity-90 font-mono font-bold hover:brightness-95 transition-colors text-left uppercase tracking-wider cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> PASANG APLIKASI
                  </button>
                </div>
              )}
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === "EN" ? "ID" : "EN")}
              className="px-3 py-1.5 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase tracking-wider font-mono cursor-pointer"
            >
              🌐 {language}
            </button>

            {/* Auth section */}
            {authLoading ? (
              <span className="text-xs font-mono font-medium text-gray-500">Loading...</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                {isPremium && (
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex flex-col items-center bg-theme-panel hover:brightness-95 text-theme-text border-2 border-theme-border px-2 py-1 shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-[1px_1px_0px_var(--theme-shadow)] transition-all cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black">
                      <Crown className="w-3.5 h-3.5 text-yellow-400" /> PREMIUM PRO
                    </div>
                    {countdownStr && (
                      <div className="text-[8px] font-mono font-bold mt-0.5 leading-none text-theme-text/80">
                        {countdownStr}
                      </div>
                    )}
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    onClick={() => setView("admin")}
                    className="px-3 py-1.5 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Admin
                  </button>
                )}
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-2 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border p-1 px-2 cursor-pointer shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-none transition-all"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-none border border-theme-border"
                    />
                  ) : (
                    <UserCircle className="w-5 h-5 text-theme-text" />
                  )}
                  <span className="hidden sm:inline text-xs font-bold font-mono max-w-[120px] truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                </button>
                <button
                  onClick={() => setShowProductsModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" /> Beli Produk
                </button>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  {t[language].logout}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowProductsModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" /> Beli Produk
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode("login");
                    setShowAuthModal(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-theme-panel hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  <LogIn className="w-4 h-4" /> {t[language].login}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* System notices & maintenance alerts */}
      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-4">
        {globalSettings.isMaintenance && (
          <div className="bg-amber-400 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] p-4 text-sm font-black flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              {language === "EN"
                ? "MAINTENANCE ACTIVE: Only registered system developers have download rights currently."
                : "PEMELIHARAAN AKTIF: Hanya pengembang sistem terdaftar yang memiliki hak download saat ini."}
            </span>
          </div>
        )}

        {globalSettings.systemNotice && (
          <div className="bg-blue-300 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] p-4 text-sm font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 shrink-0 text-theme-text" />
            <span>{globalSettings.systemNotice}</span>
          </div>
        )}

        {/* Top Ad banner */}
        {globalSettings.adsEnabled && globalSettings.ads?.bannerTopEnabled && globalSettings.ads?.bannerTopCode && (
          <div
            className="w-full select-none"
            dangerouslySetInnerHTML={{ __html: globalSettings.ads.bannerTopCode }}
          />
        )}
      </div>

      {/* Main Section */}
      <main className="max-w-4xl mx-auto px-4 py-8 text-center flex flex-col items-center gap-8">
        <div className="space-y-4 max-w-xl mx-auto">
          <div className="mb-2">
            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter text-theme-text leading-none mb-4">
              TIKTOK
            </h1>
            <div className="inline-block bg-theme-primary border-4 border-theme-border px-6 py-3 shadow-[6px_6px_0px_var(--theme-shadow)] transform -rotate-1">
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-theme-text leading-none">
                DOWNLOADER
              </h2>
            </div>
          </div>
          <p className="text-sm font-black font-mono text-gray-800 leading-relaxed max-w-lg mx-auto">
            {t[language].subtitle}
          </p>
        </div>

        {/* Search Bar container */}
        <div className="w-full max-w-3xl space-y-6">
          {/* Platform Tabs Switcher */}
          <div className="flex p-1 bg-theme-panel border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] max-w-md mx-auto">
            <button
              onClick={() => setPlatformTab("tiktok")}
              className={`flex-1 py-2 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                platformTab === "tiktok"
                  ? (theme === "tactical" ? "bg-white text-black" : "bg-theme-primary text-theme-text")
                  : (theme === "tactical" ? "text-gray-400 hover:bg-zinc-800" : "text-gray-600 hover:bg-gray-100")
              }`}
            >
              <Video className="w-4 h-4" /> TikTok
            </button>
            <button
              onClick={() => setPlatformTab("youtube")}
              className={`flex-1 py-2 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-x-4 border-theme-border ${
                platformTab === "youtube"
                  ? (theme === "tactical" ? "bg-white text-black" : "bg-red-500 text-white")
                  : (theme === "tactical" ? "text-gray-400 hover:bg-zinc-800" : "text-gray-600 hover:bg-gray-100")
              }`}
            >
              <Youtube className="w-4 h-4" /> YouTube
            </button>
            <button
              onClick={() => setPlatformTab("instagram")}
              className={`flex-1 py-2 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                platformTab === "instagram"
                  ? (theme === "tactical" ? "bg-white text-black" : "bg-gradient-to-tr from-purple-500 to-pink-500 text-white")
                  : (theme === "tactical" ? "text-gray-400 hover:bg-zinc-800" : "text-gray-600 hover:bg-gray-100")
              }`}
            >
              <Instagram className="w-4 h-4" /> Instagram
            </button>
          </div>

          <div className="w-full bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none flex flex-col gap-4 text-left">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow flex items-center bg-theme-bg border-4 border-theme-border pr-2">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 font-mono" />
                <input
                  type="text"
                  placeholder={t[language].placeholder || "Tempel link video/audio disini..."}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                  className="w-full bg-transparent pl-12 pr-4 py-4 text-sm text-theme-text font-black font-mono outline-none"
                />
                <button
                  onClick={handlePaste}
                  title={language === "EN" ? "Paste from Clipboard" : "Tempel dari Clipboard"}
                  className="px-3 py-1.5 bg-theme-primary hover:brightness-95 border-2 border-theme-border font-bold text-xs font-mono uppercase tracking-wider cursor-pointer shadow-[1px_1px_0px_var(--theme-shadow)] shrink-0"
                >
                  {t[language].pasteBtn}
                </button>
              </div>
              <button
                onClick={handleDownload}
                disabled={loading || !url}
                className="bg-theme-primary hover:brightness-95 text-theme-text border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all disabled:bg-gray-200 disabled:text-gray-500 px-8 py-4 font-black uppercase text-sm tracking-wider flex items-center justify-center gap-2 shrink-0 rounded-none cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-theme-border border-t-transparent rounded-full animate-spin"></div>
                    {t[language].fetching}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {language === "EN" ? "PROCESS NOW" : "PROSES SEKARANG"}
                  </>
                )}
              </button>
            </div>

            {/* Quick paste advice */}
            <p className="text-[10px] text-gray-500 font-mono">
              {language === "EN"
                ? "Paste any valid video URL (e.g. https://www.tiktok.com/@user/video/...) and hit Fetch."
                : "Tempel URL video valid (contoh: https://www.tiktok.com/@user/video/...) lalu klik Ambil Video."}
            </p>
          </div>

          {/* Loader status */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 border-4 border-theme-border border-t-theme-text animate-spin bg-theme-panel shadow-[4px_4px_0px_var(--theme-shadow)]"></div>
              <span className="text-xs font-mono font-black uppercase text-theme-text">{t[language].fetching}</span>
            </div>
          )}

          {/* Error notifications */}
          {error && 
           error !== "mohon maaf limit anda telah habis silahkan tungguin besok ganti limit harian anda jika limit pembelian habis" && 
           error !== "Sorry, your limit is exhausted. Please wait until tomorrow for your daily limit to reset if your purchased limit is exhausted." && (
            <div className="w-full max-w-3xl bg-red-400 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] p-4 text-white font-black text-xs sm:text-sm text-left flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="space-y-1">
                <span className="block font-black uppercase">Error Occurred</span>
                <p className="font-mono font-medium text-[11px] sm:text-xs text-white/90">{error}</p>
              </div>
            </div>
          )}

          {/* Exhausted Limit Notice */}
          {hasNoLimitLeft && (
            <div className="w-full max-w-3xl bg-red-400 border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 text-white text-left flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-in fade-in duration-300">
              <div className="bg-theme-panel border-4 border-theme-border p-3 shadow-[3px_3px_0px_var(--theme-shadow)] shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div className="space-y-2 flex-grow">
                <h3 className="text-lg font-black uppercase tracking-tight text-white">Error Occurred</h3>
                <p className="font-mono text-sm leading-relaxed text-white">
                  {language === "EN"
                    ? "Sorry, your limit is exhausted. Please wait until tomorrow for your daily limit to reset if your purchased limit is exhausted."
                    : "mohon maaf limit anda telah habis silahkan tungguin besok ganti limit harian anda jika limit pembelian habis"}
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => setShowProductsModal(true)}
                    className="px-4 py-2 bg-theme-primary hover:brightness-95 border-2 border-theme-border font-black text-xs font-mono uppercase tracking-wider cursor-pointer text-theme-text shadow-[2px_2px_0px_var(--theme-shadow)] active:translate-y-[1px] active:shadow-none transition-all"
                  >
                    {language === "EN" ? "Buy Limit Product" : "Beli Produk Limit"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results view */}
          {view === "main" && result && !hasNoLimitLeft && (
          <div className="w-full max-w-3xl bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 text-left flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Thumbnail section */}
            <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
              {showPlayer && result.downloads?.find((d: any) => d.type === "video_no_wm") ? (
                <CustomVideoPlayer
                  src={result.downloads?.find((d: any) => d.type === "video_no_wm")?.url || ""}
                  thumbnail={result.thumbnail}
                />
              ) : (
                <div className="relative rounded-none overflow-hidden border-4 border-theme-border bg-theme-bg aspect-[3/4] shadow-[4px_4px_0px_var(--theme-shadow)] flex items-center justify-center">
                  {result.thumbnail ? (
                    <img
                      src={result.thumbnail}
                      alt="Cover"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Video className="w-12 h-12 text-gray-400" />
                  )}
                  {/* Play preview overlay */}
                  {result.downloads?.some((d: any) => d.type === "video_no_wm" || d.type === "audio") && (
                    <button
                      onClick={() => setShowPlayer(!showPlayer)}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center group hover:bg-black/50 transition-colors cursor-pointer"
                    >
                      <PlayCircle className="w-12 h-12 text-white group-hover:scale-110 transition-transform shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
                    </button>
                  )}
                </div>
              )}

              {/* Bookmark button */}
              <button
                onClick={() => toggleBookmark(result)}
                className={`w-full py-2.5 font-black uppercase text-xs tracking-wider border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isBookmarked ? "bg-theme-primary" : "bg-gray-200 hover:bg-gray-300"
                }`}
              >
                <Bookmark className="w-4 h-4 fill-current" />
                {isBookmarked
                  ? language === "EN"
                    ? "Bookmarked"
                    : "Disimpan"
                  : language === "EN"
                    ? "Bookmark"
                    : "Simpan"}
              </button>
            </div>

            {/* Video Meta details and Download buttons */}
            <div className="flex-grow flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase bg-theme-primary border-2 border-theme-border px-2 py-0.5 shadow-[1px_1px_0px_var(--theme-shadow)] inline-block mb-3">
                  {result.platform?.toUpperCase() === "YOUTUBE" ? "YOUTUBE VIDEO" : result.platform?.toUpperCase() === "INSTAGRAM" ? "INSTAGRAM POST" : result.type === "slides" ? "SLIDES / PHOTOS" : "TIKTOK VIDEO"}
                </span>
                {result.title && result.platform !== "youtube" && (
                  <h2 className="text-xl font-black text-theme-text leading-tight mb-2 uppercase">
                    {result.title}
                  </h2>
                )}
                {result.title && result.platform !== "youtube" && (
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.title);
                        alert(
                          language === "EN"
                            ? "Caption copied successfully!"
                            : "Caption berhasil disalin!"
                        );
                      } catch (err) {
                        alert(
                          language === "EN"
                            ? "Failed to copy caption."
                            : "Gagal menyalin caption."
                        );
                      }
                    }}
                    className="mb-4 px-3 py-1.5 bg-theme-primary border-2 border-theme-border text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_var(--theme-shadow)] hover:brightness-95 active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 inline-flex"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {language === "EN" ? "Copy Caption" : "Salin Caption"}
                  </button>
                )}
                {/* Creator Profile Card */}
                {result.platform !== "youtube" && (
                  <div className="flex items-center gap-3 bg-theme-bg border-4 border-theme-border p-3 mb-4 shadow-[4px_4px_0px_var(--theme-shadow)] select-none">
                    {result.creator_avatar ? (
                      <img
                        src={result.creator_avatar}
                        alt="Creator Avatar"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 border-2 border-theme-border"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-theme-primary border-2 border-theme-border flex items-center justify-center font-black text-lg">
                        {result.creator?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-mono font-bold text-gray-500 uppercase block leading-none mb-1">
                        {result.platform?.toUpperCase() === "YOUTUBE" ? "Channel YouTube" : result.platform?.toUpperCase() === "INSTAGRAM" ? "Profil Instagram" : "Kreator TikTok"}
                      </span>
                      <strong className="text-sm font-black text-theme-text block leading-tight">
                        {result.creator}
                      </strong>
                      {result.creator_id && (
                        <span className="text-[10px] font-mono text-gray-600 block">
                          @{result.creator_id}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {result.duration && result.duration !== "N/A" && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-gray-700 mb-4 border-b-2 border-dashed border-gray-300 pb-3">
                    <span>Duration: <strong className="text-theme-text">{result.duration}</strong></span>
                  </div>
                )}

                {/* Real-time play/preview panel for Audio only */}
                {showPlayer && !result.downloads?.find((d: any) => d.type === "video_no_wm") && result.downloads?.find((d: any) => d.type === "audio") && (
                  <div className="mb-6">
                    <CustomAudioPlayer
                      src={result.downloads?.find((d: any) => d.type === "audio")?.url || ""}
                    />
                  </div>
                )}

                {/* Video Metrics stats block */}
                {result.stats && (result.stats.views !== "N/A" || result.stats.likes !== "N/A" || result.stats.shares !== "N/A") && (
                  <div className="grid grid-cols-3 gap-2 bg-theme-bg/50 border-4 border-theme-border p-3 mb-6 font-mono text-xs">
                    <div className="text-center">
                      <span className="block text-[9px] text-gray-600 uppercase font-black">Views</span>
                      <strong className="text-sm font-black text-theme-text">{result.stats.views || "—"}</strong>
                    </div>
                    <div className="text-center border-x-4 border-theme-border">
                      <span className="block text-[9px] text-gray-600 uppercase font-black">Likes</span>
                      <strong className="text-sm font-black text-theme-text">{result.stats.likes || "—"}</strong>
                    </div>
                    <div className="text-center">
                      <span className="block text-[9px] text-gray-600 uppercase font-black">Shares</span>
                      <strong className="text-sm font-black text-theme-text">{result.stats.shares || "—"}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Download Buttons mapped */}
              <div className="space-y-3">
                <span className="block text-xs font-bold text-gray-700 font-mono uppercase tracking-wider mb-2">
                  {language === "EN" ? "Available Download Links" : "Tautan Unduhan Tersedia"}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.downloads?.map((dl: any, index: number) => {
                    const getDownloadFilename = (itemDl: any) => {
                      const extension = itemDl.type === "audio" ? "mp3" : itemDl.type === "slides" ? "zip" : "mp4";
                      return `SaveTik_Download.${extension}`;
                    };
                    const downloadFilename = getDownloadFilename(dl);
                    const finalHref = dl.isProxy 
                      ? dl.url 
                      : `/api/proxy-download?url=${encodeURIComponent(dl.url)}&filename=${encodeURIComponent(downloadFilename)}`;

                    return (
                      <a
                        key={index}
                        href={finalHref}
                        download={downloadFilename}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={async (e) => {
                          const isSuperAdmin = user?.email === "jrnabil570@gmail.com";
                          
                          if (user && userData && !isPremium && !isSuperAdmin) {
                            // Handle limit tracking first
                            const rawLimit = userData.usageLimit;
                            if (rawLimit !== "permanent") {
                              const history = userData.downloadHistory || [];
                              const todayDownloads = history.filter((ts: string) => new Date(ts).getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
                              const maxDailyLimit = globalSettings.initialLimit || 5;
                              const remainingDaily = Math.max(0, maxDailyLimit - todayDownloads);
                              const rwLimit = Number(rawLimit) || 0;
                              
                              if (remainingDaily <= 0 && rwLimit <= 0) {
                                e.preventDefault();
                                alert(
                                  language === "EN"
                                    ? "Sorry, your limit is exhausted. Please wait until tomorrow for your daily limit to reset if your purchased limit is exhausted."
                                    : "mohon maaf limit anda telah habis silahkan tungguin besok ganti limit harian anda jika limit pembelian habis"
                                );
                                return;
                              }
                              
                              const nowStr = new Date().toISOString();
                              let newUserData = { ...userData };
                              let updatePayload: any = {};
                              
                              if (remainingDaily > 0) {
                                 const newHistory = [...history, nowStr];
                                 newUserData.downloadHistory = newHistory;
                                 updatePayload.downloadHistory = newHistory;
                              } else {
                                 const newRwLimit = Math.max(0, rwLimit - 1);
                                 newUserData.usageLimit = newRwLimit;
                                 updatePayload.usageLimit = newRwLimit;
                              }
                              
                              setUserData(newUserData);
                              try {
                                const uRef = doc(db, "users", user.uid);
                                await setDoc(uRef, updatePayload, { merge: true });
                              } catch (err: any) {
                                console.error("Failed to update user limit:", err?.message);
                              }
                            }
                          }

                          // Handle Proxy polling for async background processing
                          if (dl.isProxy) {
                            e.preventDefault();
                            setLoading(true);
                            try {
                              let attempts = 0;
                              let pollJson;
                              while (attempts < 20) {
                                const res = await fetch(dl.url);
                                const contentType = res.headers.get("content-type");
                                if (contentType && contentType.indexOf("application/json") !== -1) {
                                  pollJson = await res.json();
                                } else {
                                  const text = await res.text();
                                  throw new Error(`Invalid response from proxy: ${text.substring(0, 100)}`);
                                }
                                
                                if (pollJson.status === "completed") break;
                                if (pollJson.status === "error") throw new Error(pollJson.error || pollJson.message);
                                await new Promise(r => setTimeout(r, 3000));
                                attempts++;
                              }
                              
                              if (pollJson?.status === "completed") {
                                const finalUrl = pollJson.download_url || `https://youtubedl.siputzx.my.id${pollJson.fileUrl}`;
                                const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(finalUrl)}&filename=${encodeURIComponent(downloadFilename)}`;
                                window.open(proxyUrl, "_blank");
                              } else {
                                throw new Error("Timeout polling download link.");
                              }
                            } catch (err: any) {
                              alert("Error: " + (err.message || "Failed to process download"));
                            } finally {
                              setLoading(false);
                            }
                            return;
                          }
                        }}
                        className={`py-3.5 px-4 font-black text-xs uppercase tracking-wider text-center border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          dl.type === "audio"
                            ? "bg-sky-200 hover:bg-sky-300 text-theme-text"
                            : dl.type === "slides"
                              ? "bg-orange-300 hover:bg-orange-400 text-theme-text"
                              : "bg-theme-primary hover:brightness-95 text-theme-text"
                        }`}
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        <span>{dl.label}</span>
                        <span className="text-[10px] px-1.5 bg-black text-white font-mono rounded ml-auto">
                          {dl.quality}
                        </span>
                      </a>
                    );
                  })}
                </div>

                {/* Broken links notification */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={handleReport}
                    className="text-[10px] font-mono text-gray-600 hover:text-theme-text font-black flex items-center gap-1 uppercase cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {reported ? t[language].reported : t[language].report}
                  </button>
                  <span className="text-[10px] font-mono text-gray-500">Secure connection (SSL) Active</span>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* History & Bookmarks Tabs */}
        <div className="w-full max-w-3xl bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 rounded-none text-left">
          <div className="flex border-b-4 border-theme-border mb-6">
            <button
              onClick={() => setActiveTab("history")}
              className={`px-6 py-3 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 border-t-4 border-x-4 border-transparent -mb-[4px] select-none transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-theme-panel border-theme-border border-b-white z-10 text-theme-text"
                  : "text-gray-600 font-mono hover:text-theme-text font-black"
              }`}
            >
              <Clock className="w-4 h-4" />
              {t[language].recent} ({history.length})
            </button>
            <button
              onClick={() => setActiveTab("bookmarks")}
              className={`px-6 py-3 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 border-t-4 border-x-4 border-transparent -mb-[4px] select-none transition-all cursor-pointer ${
                activeTab === "bookmarks"
                  ? "bg-theme-panel border-theme-border border-b-white z-10 text-theme-text"
                  : "text-gray-600 font-mono hover:text-theme-text font-black"
              }`}
            >
              <Bookmark className="w-4 h-4" />
              {t[language].bookmarks} ({bookmarks.length})
            </button>

            {activeTab === "history" && history.length > 0 && (
              <button
                onClick={clearHistory}
                className="ml-auto text-xs font-black uppercase text-red-500 hover:text-red-600 font-mono flex items-center gap-1 p-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t[language].clearBtn}
              </button>
            )}
          </div>

          {/* List items depending on selected tab */}
          <div className="space-y-3">
            {activeTab === "history" ? (
              history.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {history.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="bg-theme-bg border-4 border-theme-border p-4 flex gap-3 hover:shadow-[4px_4px_0px_var(--theme-shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all relative group cursor-pointer"
                      onClick={() => loadFromList(h.url)}
                    >
                      <div className="w-12 h-16 shrink-0 border-2 border-theme-border overflow-hidden bg-gray-200">
                        {h.thumbnail ? (
                          <img src={h.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Video className="w-5 h-5 text-gray-400 mx-auto mt-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-grow pr-4">
                        <span className="text-[9px] font-mono text-gray-500 uppercase block truncate">@{h.creator}</span>
                        <h4 className="font-bold text-xs text-theme-text truncate uppercase font-black mb-1">
                          {h.title || "TikTok Video"}
                        </h4>
                        {h.duration && h.duration !== "N/A" && (
                          <span className="text-[9px] text-gray-700 bg-theme-primary px-1 border border-theme-border inline-block font-mono">
                            {h.duration}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 font-mono group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600 font-mono text-sm">
                  {t[language].noHistory}
                </div>
              )
            ) : bookmarks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bookmarks.map((b, i) => (
                  <div
                    key={b.id || i}
                    className="bg-theme-bg border-4 border-theme-border p-4 flex gap-3 hover:shadow-[4px_4px_0px_var(--theme-shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all relative group cursor-pointer"
                    onClick={() => loadFromList(b.url)}
                  >
                    <div className="w-12 h-16 shrink-0 border-2 border-theme-border overflow-hidden bg-gray-200">
                      {b.thumbnail ? (
                        <img src={b.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Video className="w-5 h-5 text-gray-400 mx-auto mt-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-grow pr-4">
                      <span className="text-[9px] font-mono text-gray-500 uppercase block truncate">@{b.creator}</span>
                      <h4 className="font-bold text-xs text-theme-text truncate uppercase font-black mb-1">
                        {b.title || "TikTok Video"}
                      </h4>
                      {b.duration && b.duration !== "N/A" && (
                        <span className="text-[9px] text-gray-700 bg-theme-primary px-1 border border-theme-border inline-block font-mono">
                          {b.duration}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 font-mono group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 font-mono text-sm">
                {t[language].noBookmarks}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Ad banner */}
        {globalSettings.adsEnabled && globalSettings.ads?.bannerBottomEnabled && globalSettings.ads?.bannerBottomCode && (
          <div
            className="w-full select-none"
            dangerouslySetInnerHTML={{ __html: globalSettings.ads.bannerBottomCode }}
          />
        )}
      </main>

      {/* Popunder ad detection alert modal dialog */}
      {showAdBlockModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-theme-panel border-8 border-theme-border shadow-[12px_12px_0px_var(--theme-shadow)] max-w-md w-full p-6 text-left relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAdBlockModal(false)}
              className="absolute top-4 right-4 text-theme-text hover:text-gray-700 bg-gray-200 border-4 border-theme-border p-1 shadow-[2px_2px_0px_var(--theme-shadow)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500 text-white flex items-center justify-center border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black uppercase text-theme-text">AdBlock Detected!</h3>
            </div>
            <p className="text-xs font-mono text-gray-700 leading-relaxed mb-6">
              {language === "EN"
                ? "Our free tool relies on banner advertisements to pay for the high-performance scraping nodes. Please consider disabling your adblocker to support us!"
                : "Alat gratis kami mengandalkan iklan spanduk untuk membiayai node scraping berkinerja tinggi. Harap pertimbangkan untuk menonaktifkan adblocker Anda untuk mendukung kami!"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAdBlockModal(false);
                  checkAdBlock().catch(() => {});
                }}
                className="flex-grow bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] py-3 text-xs font-black uppercase text-theme-text tracking-wider text-center cursor-pointer"
              >
                {language === "EN" ? "I have disabled it" : "Saya sudah matikan"}
              </button>
              <button
                onClick={() => setShowAdBlockModal(false)}
                className="px-4 py-3 bg-gray-200 hover:bg-gray-300 border-4 border-theme-border shadow-[2px_2px_0px_var(--theme-shadow)] text-xs font-black uppercase text-theme-text cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthError("");
                setAuthMessage("");
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-theme-text border-2 border-theme-border p-1 hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {authModalMode === "login" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase tracking-tight text-theme-text">Masuk Akun</h2>
                <p className="text-xs font-mono text-gray-600">Masuk untuk menikmati fitur Premium Pro tanpa batas.</p>
                
                {authError && (
                  <div className="bg-red-100 border-2 border-red-500 p-2.5 text-xs text-red-700 font-mono font-bold">
                    {authError}
                  </div>
                )}
                {authMessage && (
                  <div className="bg-emerald-100 border-2 border-emerald-500 p-2.5 text-xs text-emerald-700 font-mono font-bold">
                    {authMessage}
                  </div>
                )}

                <div className="space-y-3 text-theme-text">
                  <div>
                    <label className="block text-[10px] font-bold font-mono uppercase text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="contoh@email.com"
                      className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold font-mono uppercase text-gray-600 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-gray-500 hover:text-theme-text"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-theme-text">
                  <button
                    onClick={() => {
                      setAuthError("");
                      setAuthMessage("");
                      setAuthModalMode("forgot");
                    }}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    Lupa Password?
                  </button>
                  <button
                    onClick={() => {
                      setAuthError("");
                      setAuthMessage("");
                      setAuthModalMode("register");
                    }}
                    className="text-gray-600 hover:text-theme-text font-bold underline cursor-pointer"
                  >
                    Daftar Akun Baru
                  </button>
                </div>

                <button
                  onClick={async () => {
                    setAuthLoadingState(true);
                    setAuthError("");
                    try {
                      await signInWithEmailAndPassword(auth, authEmail, authPassword);
                      setShowAuthModal(false);
                    } catch (err: any) {
                      setAuthError(getFriendlyAuthError(err));
                    } finally {
                      setAuthLoadingState(false);
                    }
                  }}
                  disabled={authLoadingState}
                  className="w-full bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all py-3 font-black uppercase text-xs tracking-wider cursor-pointer text-theme-text"
                >
                  {authLoadingState ? "Memproses..." : "Masuk dengan Email"}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t-2 border-dashed border-gray-400"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-mono text-gray-400 font-bold uppercase">atau</span>
                  <div className="flex-grow border-t-2 border-dashed border-gray-400"></div>
                </div>

                <button
                  disabled={authLoadingState}
                  onClick={async () => {
                    try {
                      setAuthLoadingState(true);
                      setAuthError("");
                      const loggedUser = await loginWithGoogle();
                      if (loggedUser) {
                        const uRef = doc(db, "users", loggedUser.uid);
                        const uSnap = await getDoc(uRef);
                        if (!uSnap.exists()) {
                          await setDoc(uRef, {
                            email: loggedUser.email,
                            displayName: loggedUser.displayName || "Anonymous User",
                            isPremium: false,
                            usageLimit: globalSettings.initialLimit || 5,
                            premiumUntil: null,
                            createdAt: new Date().toISOString()
                          }, { merge: true });
                        }
                      }
                      setShowAuthModal(false);
                    } catch (err: any) {
                      setAuthError(getFriendlyAuthError(err));
                    } finally {
                      setAuthLoadingState(false);
                    }
                  }}
                  className="w-full bg-theme-panel hover:bg-gray-100 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all py-3 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer text-theme-text disabled:opacity-50"
                >
                  <span>{authLoadingState ? "Memproses..." : "🌐 Masuk dengan Google"}</span>
                </button>
              </div>
            )}

            {authModalMode === "register" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase tracking-tight text-theme-text">Daftar Akun</h2>
                <p className="text-xs font-mono text-gray-600">Buat akun untuk menikmati fitur pro sekarang juga.</p>

                {authError && (
                  <div className="bg-red-100 border-2 border-red-500 p-2.5 text-xs text-red-700 font-mono font-bold">
                    {authError}
                  </div>
                )}

                <div className="space-y-3 text-theme-text">
                  <div>
                    <label className="block text-[10px] font-bold font-mono uppercase text-gray-600 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Nama Anda"
                      className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold font-mono uppercase text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="contoh@email.com"
                      className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold font-mono uppercase text-gray-600 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Min 6 karakter"
                        className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-gray-500 hover:text-theme-text"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono text-theme-text">
                  <button
                    onClick={() => {
                      setAuthError("");
                      setAuthMessage("");
                      setAuthModalMode("login");
                    }}
                    className="text-gray-600 hover:text-theme-text font-bold underline cursor-pointer"
                  >
                    Sudah punya akun? Masuk disini
                  </button>
                </div>

                <button
                  onClick={async () => {
                    setAuthLoadingState(true);
                    setAuthError("");
                    try {
                      const res = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
                      if (res.user) {
                        await updateProfile(res.user, { displayName: authName });
                        const userRef = doc(db, "users", res.user.uid);
                        await setDoc(userRef, {
                          email: res.user.email,
                          displayName: authName,
                          isPremium: false,
                          usageLimit: globalSettings.initialLimit || 5,
                          premiumUntil: null,
                          createdAt: new Date().toISOString()
                        }, { merge: true });
                        setShowAuthModal(false);
                      }
                    } catch (err: any) {
                      setAuthError(getFriendlyAuthError(err));
                    } finally {
                      setAuthLoadingState(false);
                    }
                  }}
                  disabled={authLoadingState}
                  className="w-full bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all py-3 font-black uppercase text-xs tracking-wider cursor-pointer text-theme-text"
                >
                  {authLoadingState ? "Mendaftarkan..." : "Daftar Akun Baru"}
                </button>
              </div>
            )}

            {authModalMode === "forgot" && (
              <div className="space-y-4">
                <h2 className="text-2xl font-black uppercase tracking-tight text-theme-text">Lupa Sandi</h2>
                <p className="text-xs font-mono text-gray-600">Masukkan email Anda untuk menerima tautan pemulihan sandi.</p>

                {authError && (
                  <div className="bg-red-100 border-2 border-red-500 p-2.5 text-xs text-red-700 font-mono font-bold">
                    {authError}
                  </div>
                )}
                {authMessage && (
                  <div className="bg-emerald-100 border-2 border-emerald-500 p-2.5 text-xs text-emerald-700 font-mono font-bold">
                    {authMessage}
                  </div>
                )}

                <div className="text-theme-text">
                  <label className="block text-[10px] font-bold font-mono uppercase text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="contoh@email.com"
                    className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                  />
                </div>

                <div className="text-xs font-mono text-theme-text">
                  <button
                    onClick={() => {
                      setAuthError("");
                      setAuthMessage("");
                      setAuthModalMode("login");
                    }}
                    className="text-gray-600 hover:text-theme-text font-bold underline cursor-pointer"
                  >
                    Kembali ke halaman masuk
                  </button>
                </div>

                <button
                  onClick={async () => {
                    setAuthLoadingState(true);
                    setAuthError("");
                    setAuthMessage("");
                    try {
                      await sendPasswordResetEmail(auth, authEmail);
                      setAuthMessage("Email pemulihan sandi berhasil dikirim! Silakan periksa kotak masuk Anda.");
                    } catch (err: any) {
                      setAuthError(getFriendlyAuthError(err));
                    } finally {
                      setAuthLoadingState(false);
                    }
                  }}
                  disabled={authLoadingState}
                  className="w-full bg-theme-primary hover:brightness-95 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all py-3 font-black uppercase text-xs tracking-wider cursor-pointer text-theme-text"
                >
                  {authLoadingState ? "Mengirim..." : "Kirim Link Reset Sandi"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setShowProfileModal(false);
                setAuthError("");
                setAuthMessage("");
                setAuthPassword("");
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-theme-text border-2 border-theme-border p-1 hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              <div className="flex items-center gap-4 border-b-4 border-theme-border pb-4 text-theme-text">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile Avatar"
                    className="w-16 h-16 border-4 border-theme-border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 bg-theme-primary border-4 border-theme-border flex items-center justify-center">
                    <UserCircle className="w-10 h-10" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-black uppercase leading-none text-theme-text">{user.displayName || "Pengguna Baru"}</h2>
                  <span className="text-xs font-mono text-gray-400 block mt-1">{user.email}</span>
                  
                  {user.email === "jrnabil570@gmail.com" ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black bg-emerald-600 text-white border-2 border-theme-border px-1.5 py-0.5 shadow-[1px_1px_0px_var(--theme-shadow)]">
                      <Crown className="w-3 h-3" /> OWNER / DEVELOPER
                    </span>
                  ) : isPremium ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black bg-theme-primary text-theme-text border-2 border-theme-border px-1.5 py-0.5 shadow-[1px_1px_0px_var(--theme-shadow)]">
                      <Crown className="w-3 h-3 text-yellow-400" /> PREMIUM PRO
                    </span>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black bg-theme-bg text-theme-text border-2 border-theme-border px-1.5 py-0.5">
                      AKUN GRATIS
                    </span>
                  )}
                </div>
              </div>

              {/* Running countdown timer for Premium Pro */}
              {isPremium && (
                <div className="bg-theme-bg border-4 border-theme-border p-6 text-center shadow-[4px_4px_0px_var(--theme-shadow)]">
                  <span className="block text-xs font-bold uppercase text-gray-500 tracking-widest">
                    Premium Pro Access
                  </span>
                  <div className="text-2xl font-black font-mono text-theme-text mt-2">
                    {countdownStr}
                  </div>
                </div>
              )}

              {/* Usage Limit display */}
              <div className="bg-theme-bg border-4 border-theme-border p-4 rounded-none space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-theme-text">
                      Sisa Limit Download RW / Beli
                    </span>
                    <span className="text-xs font-bold font-mono text-theme-text">
                      {getRemainingRwLimit()}
                    </span>
                  </div>
                  <div className="w-full bg-theme-panel h-2.5 border-2 border-theme-border">
                    <div 
                      className="bg-theme-text h-full" 
                      style={{ width: '100%' }} 
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-theme-text">
                      Sisa Limit Download Harian (24 Jam)
                    </span>
                    <span className="text-xs font-bold font-mono text-theme-text">
                      {getRemainingDailyLimit()}
                    </span>
                  </div>
                  <div className="w-full bg-theme-panel h-2.5 border-2 border-theme-border">
                    <div 
                      className="bg-sky-400 h-full" 
                      style={{ width: `${getDailyLimitPercentage()}%` }} 
                    ></div>
                  </div>
                </div>
              </div>

              {/* Profile Modal - Password Change Panel */}
              <div className="border-t-4 border-theme-border pt-6">
                <h3 className="text-sm font-black uppercase mb-4">Ganti Password</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password baru"
                      className="w-full bg-theme-bg border-4 border-theme-border px-3 py-2 text-sm font-black outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2 text-gray-500 hover:text-theme-text"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      if (newPassword.length < 6) {
                        alert("Password harus minimal 6 karakter.");
                        return;
                      }
                      try {
                        await updateAuthPassword(user, newPassword);
                        alert("Password berhasil diperbarui!");
                        setNewPassword("");
                      } catch (e: any) {
                        alert("Gagal memperbarui password: " + e.message);
                      }
                    }}
                    className="w-full bg-black text-white font-black uppercase text-sm py-2 hover:bg-gray-800 transition-colors"
                  >
                    Simpan Password Baru
                  </button>
                </div>
              </div>

              <div className="border-t-4 border-theme-border pt-6 flex flex-col gap-3">
                <h3 className="text-sm font-black uppercase mb-2">Informasi Akun</h3>
                <p className="text-xs font-mono text-gray-600 mb-2">Email: {user.email}</p>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await logout();
                        setShowProfileModal(false);
                      } catch (e: any) {
                        alert("Gagal logout: " + e.message);
                      }
                    }}
                    className="w-full bg-gray-200 text-theme-text font-black uppercase text-sm py-2.5 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-gray-300 transition-all active:translate-y-[2px] active:shadow-none cursor-pointer"
                  >
                    Logout Akun
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Apakah Anda yakin ingin menghapus akun ini? Tindakan ini tidak bisa dibatalkan.")) {
                        try {
                          console.log("Attempting to delete account for UID:", user.uid);
                          const res = await fetch(`/api/admin/users/${user.uid}`, { method: "DELETE" });
                          if (res.ok) {
                              await deleteAccount(user).catch(() => {}); // Try to clear local auth state, ignore error
                              await logout();
                              alert("Akun berhasil dihapus.");
                              setShowProfileModal(false);
                          } else {
                              const errorText = await res.text();
                              throw new Error(errorText || "Gagal menghapus akun di server.");
                          }
                        } catch (e: any) {
                          alert("Gagal menghapus akun: " + e.message);
                        }
                      }
                    }}
                    className="w-full bg-red-600 text-white font-black uppercase text-sm py-2.5 border-4 border-theme-border shadow-[4px_4px_0px_var(--theme-shadow)] hover:bg-red-700 transition-all active:translate-y-[2px] active:shadow-none cursor-pointer"
                  >
                    Hapus Akun
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 mt-12 pt-6 border-t-4 border-theme-border text-center text-xs font-mono text-gray-600 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span>&copy; {new Date().getFullYear()} SAVETIK Downloader. {t[language].allRights}</span>
        <div className="flex gap-4 uppercase font-black">
          <a href="#" className="hover:text-theme-text">{t[language].termsOfService}</a>
          <span>&middot;</span>
          <a href="#" className="hover:text-theme-text">{t[language].privacyPolicy}</a>
        </div>
      </footer>
      {showProductsModal && <ProductsView onClose={() => setShowProductsModal(false)} />}
    </div>
  );
}
