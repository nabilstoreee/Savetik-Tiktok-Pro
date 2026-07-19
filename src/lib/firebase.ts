import { initializeApp } from "firebase/app";
import { 
  initializeAuth,
  browserLocalPersistence,
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  browserPopupRedirectResolver
} from "firebase/auth";
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
export { onSnapshot };

const firebaseConfig = {
  apiKey: "AIzaSyC9URH_rdEqhpskYoPxIeCTew54KFWQv9A",
  authDomain: "gen-lang-client-0184221253.firebaseapp.com",
  projectId: "gen-lang-client-0184221253",
  storageBucket: "gen-lang-client-0184221253.firebasestorage.app",
  messagingSenderId: "4119005247",
  appId: "1:4119005247:web:df3379e035d7ccfafa508a",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, "ai-studio-b027d49e-19d8-4107-949a-0fefbfb09805");
export const googleProvider = new GoogleAuthProvider();
export { updatePassword, deleteUser };

export const deleteAccount = async (user: any) => {
    try {
        const uid = user.uid;
        // 1. Delete Firestore doc while we still have Auth session
        try {
            await deleteDoc(doc(db, "users", uid));
        } catch (e) {
            console.error("Failed to delete user document:", e instanceof Error ? e.message : String(e));
        }
        // 2. Delete Auth account
        await deleteUser(user);
    } catch (error) {
        throw error;
    }
};

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
        return result.user;
    } catch (error) {
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        throw error;
    }
};

export const checkPremiumStatus = async (uid: string) => {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            let isPrem = data.isPremium || false;
            const expiry = data.premiumUntil || null;
            if (isPrem && expiry) {
                const expiryDate = new Date(expiry);
                if (expiryDate.getTime() < Date.now()) {
                    isPrem = false; // Expired!
                }
            }
            return isPrem;
        }
        return false;
    } catch (error) {
        return false;
    }
};

export const getAllUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const users: any[] = [];
    querySnapshot.forEach((doc) => {
        users.push({ uid: doc.id, ...doc.data() });
    });
    return users;
};

export const updateUserPremium = async (uid: string, isPremium: boolean) => {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { isPremium }, { merge: true });
};

export const grantPremiumByEmail = async (email: string, days: number) => {
    const trimmed = email.trim();
    const lower = trimmed.toLowerCase();
    
    // 1. Try lowercase query
    let q = query(collection(db, "users"), where("email", "==", lower));
    let snap = await getDocs(q);
    let userDoc = snap.empty ? null : snap.docs[0];
    
    // 2. Try raw query if empty
    if (!userDoc && trimmed !== lower) {
        q = query(collection(db, "users"), where("email", "==", trimmed));
        snap = await getDocs(q);
        if (!snap.empty) {
            userDoc = snap.docs[0];
        }
    }
    
    // 3. Fallback: search all users case-insensitively
    if (!userDoc) {
        const allUsersSnap = await getDocs(collection(db, "users"));
        for (const doc of allUsersSnap.docs) {
            const data = doc.data();
            if (data && data.email && typeof data.email === 'string') {
                if (data.email.trim().toLowerCase() === lower) {
                    userDoc = doc as any;
                    break;
                }
            }
        }
    }

    if (!userDoc) {
        throw new Error("Pengguna dengan email tersebut tidak ditemukan. Pastikan email yang dimasukkan sudah terdaftar di sistem.");
    }
    const uid = userDoc.id;
    const docRef = doc(db, "users", uid);
    
    let premiumUntilDate;
    if (days >= 99999) {
        premiumUntilDate = "9999999999999";
    } else {
        premiumUntilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    
    await setDoc(docRef, { isPremium: true, premiumUntil: premiumUntilDate }, { merge: true });
    return { uid, email, premiumUntil: premiumUntilDate };
};

export const getGlobalSettings = async () => {
    try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                isMaintenance: data.isMaintenance ?? false,
                freeLimit: data.freeLimit ?? 5,
                loginLimit: data.loginLimit ?? 5,
                initialLimit: data.initialLimit ?? 5,
                systemNotice: data.systemNotice ?? "",
                tiktokApiUrl: data.tiktokApiUrl ?? "https://www.tikwm.com/api/",
                adsEnabled: data.adsEnabled ?? true,
                ads: data.ads ?? {
                    bannerTopEnabled: true,
                    bannerTopCode: "<!-- Default Banner Top Ad Slot -->\n<div class='p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono'>AD_SLOT_TOP_BANNER</div>",
                    bannerBottomEnabled: true,
                    bannerBottomCode: "<!-- Default Banner Bottom Ad Slot -->\n<div class='p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono'>AD_SLOT_BOTTOM_BANNER</div>",
                    popunderEnabled: false,
                    popunderCode: "<!-- Default Popunder script/iframe -->\n<script>console.log('Popunder simulated');</script>"
                },
                antiAdblockEnabled: data.antiAdblockEnabled ?? true,
                antiAdblockBlockDownloads: data.antiAdblockBlockDownloads ?? false,
                premiumLimitType: data.premiumLimitType ?? "no_limit",
                premiumLimitValue: data.premiumLimitValue ?? 100,
                websiteName: data.websiteName ?? "SAVETIK",
                qrisImageUrl: data.qrisImageUrl ?? "/src/assets/images/qris_donation_1784202976592.jpg",
                contactOwnerUrl: data.contactOwnerUrl ?? "https://wa.me/628888573485",
                websiteBuyOtomatisUrl: data.websiteBuyOtomatisUrl ?? "https://download.amane-acel.web.id",
                scanQrisText: data.scanQrisText ?? "Scan QRIS di atas buat donasi suka-suka",
            };
        }
        return {
            isMaintenance: false,
            freeLimit: 5,
            systemNotice: "",
            tiktokApiUrl: "https://www.tikwm.com/api/",
            adsEnabled: true,
            ads: {
                bannerTopEnabled: true,
                bannerTopCode: "<!-- Default Banner Top Ad Slot -->\n<div class='p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono'>AD_SLOT_TOP_BANNER</div>",
                bannerBottomEnabled: true,
                bannerBottomCode: "<!-- Default Banner Bottom Ad Slot -->\n<div class='p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono'>AD_SLOT_BOTTOM_BANNER</div>",
                popunderEnabled: false,
                popunderCode: "<!-- Default Popunder script/iframe -->\n<script>console.log('Popunder simulated');</script>"
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
        };
    } catch (e) {
        return {
            isMaintenance: false,
            freeLimit: 5,
            systemNotice: "",
            tiktokApiUrl: "https://www.tikwm.com/api/",
            adsEnabled: true,
            ads: {
                bannerTopEnabled: true,
                bannerTopCode: "<!-- Default Banner Top Ad Slot -->\n<div class='p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono'>AD_SLOT_TOP_BANNER</div>",
                bannerBottomEnabled: true,
                bannerBottomCode: "<!-- Default Banner Bottom Ad Slot -->\n<div class='p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-mono'>AD_SLOT_BOTTOM_BANNER</div>",
                popunderEnabled: false,
                popunderCode: "<!-- Default Popunder script/iframe -->\n<script>console.log('Popunder simulated');</script>"
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
        };
    }
};

export const updateGlobalSettings = async (settings: any) => {
    const docRef = doc(db, "settings", "global");
    await setDoc(docRef, settings, { merge: true });
};

export const getBannedIps = async () => {
    const querySnapshot = await getDocs(collection(db, "banned_ips"));
    const ips: any[] = [];
    querySnapshot.forEach((doc) => {
        ips.push({ ip: doc.id, ...doc.data() });
    });
    return ips;
};

export const addBannedIp = async (ip: string, reason: string) => {
    const docRef = doc(db, "banned_ips", ip);
    await setDoc(docRef, { ip, reason, bannedAt: new Date().toISOString() });
};

export const removeBannedIp = async (ip: string) => {
    const docRef = doc(db, "banned_ips", ip);
    await deleteDoc(docRef);
};

export const getBannedUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "banned_users"));
    const users: any[] = [];
    querySnapshot.forEach((doc) => {
        users.push({ userId: doc.id, ...doc.data() });
    });
    return users;
};

export const addBannedUser = async (userId: string, email: string, reason: string, duration: string = "permanent") => {
    const docRef = doc(db, "banned_users", userId);
    let expiresAt: string | null = null;
    if (duration !== 'permanent') {
        const now = new Date();
        const days = duration.includes('day') ? parseInt(duration) : 
                     duration.includes('year') ? parseInt(duration) * 365 : 0;
        now.setDate(now.getDate() + days);
        expiresAt = now.toISOString();
    }
    await setDoc(docRef, { userId, email, reason, duration, expiresAt, bannedAt: new Date().toISOString() });
};

export const removeBannedUser = async (userId: string) => {
    const docRef = doc(db, "banned_users", userId);
    await deleteDoc(docRef);
};

export const addActivityLog = async (uid: string, url: string, platform: string) => {
    try {
        await addDoc(collection(db, "activity_logs"), {
            uid: uid || "guest",
            url: url || "",
            platform: platform || "unknown",
            timestamp: new Date().toISOString()
        });
    } catch (e: any) {
        console.error("Failed to add activity log client-side:", e instanceof Error ? e.message : String(e));
    }
};

export const getActivityLogs = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "activity_logs"));
        const logs: any[] = [];
        querySnapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() });
        });
        return logs;
    } catch (e: any) {
        console.error("Failed to get activity logs client-side:", e instanceof Error ? e.message : String(e));
        return [];
    }
};

export const getProducts = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const products: any[] = [];
        let hasPremiumBonus = false;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.type === "premium_bonus") {
                hasPremiumBonus = true;
            }
            products.push({ id: doc.id, ...data });
        });
        
        // Auto-seed if completely empty
        if (products.length === 0) {
            const defaultProducts = [
                { name: "Batas Limit 10", price: "Rp10.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 10 seharga Rp10.000" },
                { name: "Batas Limit 25", price: "Rp20.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 25 seharga Rp20.000" },
                { name: "Batas Limit 35", price: "Rp30.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 35 seharga Rp30.000" },
                { name: "Batas Limit 45", price: "Rp40.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 45 seharga Rp40.000" },
                { name: "Batas Limit 55", price: "Rp50.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 55 seharga Rp50.000" },
                { name: "Batas Limit 65", price: "Rp60.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 65 seharga Rp60.000" },
                { name: "Batas Limit 75", price: "Rp70.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 75 seharga Rp70.000" },
                { name: "Batas Limit 85", price: "Rp80.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 85 seharga Rp80.000" },
                { name: "Batas Limit 95", price: "Rp90.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 95 seharga Rp90.000" },
                { name: "Batas Limit 150", price: "Rp110.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 150 seharga Rp110.000" },
                { name: "Batas Limit 250", price: "Rp120.000", type: "limit", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Batas Limit 250 seharga Rp120.000" },
                
                { name: "Premium Pro 1 Bulan", price: "Rp25.000", type: "premium", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium Pro 1 Bulan seharga Rp25.000" },
                { name: "Premium Pro 1 Tahun", price: "Rp75.000", type: "premium", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium Pro 1 Tahun seharga Rp75.000" }
            ];
            
            for (const prod of defaultProducts) {
                try {
                    const addedDoc = await addDoc(collection(db, "products"), prod);
                    products.push({ id: addedDoc.id, ...prod });
                } catch (addError) {
                    // Fallback to client-side only if permission denied
                    products.push({ id: Math.random().toString(), ...prod });
                }
            }
        }

        // If no premium bonus products exist, auto-seed them
        if (!hasPremiumBonus) {
            const defaultBonusProducts = [
                { name: "Premium 1 Hari + Limit Permanen", price: "Rp55.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 1 Hari + Limit Permanen seharga Rp55.000" },
                { name: "Premium 10 Hari + Limit Permanen", price: "Rp65.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 10 Hari + Limit Permanen seharga Rp65.000" },
                { name: "Premium 20 Hari + Limit Permanen", price: "Rp75.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 20 Hari + Limit Permanen seharga Rp75.000" },
                { name: "Premium 1 Bulan + Limit Permanen", price: "Rp85.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 1 Bulan + Limit Permanen seharga Rp85.000" },
                { name: "Premium 1 Tahun + Limit Permanen", price: "Rp95.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 1 Tahun + Limit Permanen seharga Rp95.000" },
                { name: "Premium 2 Tahun + Limit Permanen", price: "Rp150.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 2 Tahun + Limit Permanen seharga Rp150.000" },
                { name: "Premium 5 Tahun + Limit Permanen", price: "Rp350.000", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Premium 5 Tahun + Limit Permanen seharga Rp350.000" },
                { name: "Limit Premium Permanen", price: "Rp555.555", type: "premium_bonus", waNumber: "6282136034173", waMessage: "Halo Admin, saya mau beli Limit Premium Permanen seharga Rp555.555" }
            ];
            
            for (const prod of defaultBonusProducts) {
                try {
                    const addedDoc = await addDoc(collection(db, "products"), prod);
                    products.push({ id: addedDoc.id, ...prod });
                } catch (addError) {
                    // Fallback to client-side only if permission denied
                    products.push({ id: Math.random().toString(), ...prod });
                }
            }
        }
        return products;
    } catch (e) {
        console.error("Failed to get products:", e instanceof Error ? e.message : String(e));
        return [];
    }
};

export const addProduct = async (product: any) => {
    try {
        return await addDoc(collection(db, "products"), product);
    } catch (e) {
        console.error("Failed to add product:", e instanceof Error ? e.message : String(e));
        throw e;
    }
};

export const updateProduct = async (id: string, product: any) => {
    try {
        await updateDoc(doc(db, "products", id), product);
    } catch (e) {
        console.error("Failed to update product:", e instanceof Error ? e.message : String(e));
        throw e;
    }
};

export const deleteProduct = async (id: string) => {
    try {
        await deleteDoc(doc(db, "products", id));
    } catch (e) {
        console.error("Failed to delete product:", e instanceof Error ? e.message : String(e));
        throw e;
    }
};

export const subscribeProducts = (onUpdate: (products: any[]) => void) => {
    return onSnapshot(collection(db, "products"), (snapshot) => {
        const productsList: any[] = [];
        snapshot.forEach((doc) => {
            productsList.push({ id: doc.id, ...doc.data() });
        });
        onUpdate(productsList);
    }, (error) => {
        console.error("Failed to subscribe to products:", error instanceof Error ? error.message : String(error));
    });
};

export const addFeedback = async (category: "fitur" | "bug", details: string, contact: string, userId: string, userEmail: string) => {
    try {
        return await addDoc(collection(db, "feedbacks"), {
            category,
            details: details.substring(0, 2000),
            contact: contact || "",
            userId: userId || "guest",
            userEmail: userEmail || "guest",
            timestamp: new Date().toISOString(),
            status: "unread"
        });
    } catch (e) {
        console.error("Failed to add feedback:", e instanceof Error ? e.message : String(e));
        throw e;
    }
};

export const subscribeFeedbacks = (onUpdate: (feedbacks: any[]) => void) => {
    return onSnapshot(collection(db, "feedbacks"), (snapshot) => {
        const feedbacksList: any[] = [];
        snapshot.forEach((doc) => {
            feedbacksList.push({ id: doc.id, ...doc.data() });
        });
        feedbacksList.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        onUpdate(feedbacksList);
    }, (error) => {
        console.error("Failed to subscribe to feedbacks:", error instanceof Error ? error.message : String(error));
    });
};

export const updateFeedbackStatus = async (id: string, status: "unread" | "read" | "resolved") => {
    try {
        await updateDoc(doc(db, "feedbacks", id), { status });
    } catch (e) {
        console.error("Failed to update feedback status:", e instanceof Error ? e.message : String(e));
        throw e;
    }
};

export const deleteFeedback = async (id: string) => {
    try {
        console.log("Deleting document in 'feedbacks' with ID:", id);
        await deleteDoc(doc(db, "feedbacks", id));
        console.log("Successfully deleted feedback with ID:", id);
    } catch (e) {
        console.error("Failed to delete feedback:", e instanceof Error ? e.message : String(e));
        throw e;
    }
};


