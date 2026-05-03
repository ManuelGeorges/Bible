import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getRemoteConfig, isSupported } from "firebase/remote-config";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// متغير لحفظ النسخة لضمان عدم تكرار التهيئة
let remoteConfigInstance = null;

export const getFirebaseRemoteConfig = async () => {
    if (typeof window === "undefined") return null;

    if (remoteConfigInstance) return remoteConfigInstance;

    try {
        const supported = await isSupported();
        if (supported) {
            remoteConfigInstance = getRemoteConfig(app);
            // ضبط قيم افتراضية للحقول
            remoteConfigInstance.defaultConfig = {
                'app_news': JSON.stringify({
                    active: false,
                    title: "",
                    message: "",
                    buttonText: "",
                    link: "",
                    accentColor: "#3b82f6",
                    bgColor: "#eff6ff"
                })
            };
            return remoteConfigInstance;
        }
    } catch (e) {
        console.error("Remote Config Support Check Error:", e);
    }
    return null;
};

export { app, auth, db };