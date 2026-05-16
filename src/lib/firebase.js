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

// وظيفة لتهيئة التطبيق بأمان
const initializeFirebase = () => {
  if (getApps().length > 0) {
    return getApp();
  }

  // التحقق من أن القيم الأساسية موجودة قبل التهيئة
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("Firebase configuration is missing! Firebase services will not be available.");
    return null;
  }

  try {
    return initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    return null;
  }
};

const app = initializeFirebase();

// تصدير الخدمات مع التحقق من وجود التطبيق
export const auth = app ? getAuth(app) : null;

export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}) : null;

export { app };

// دالة Remote Config لضمان عملها فقط في المتصفح ومع وجود تطبيق
let remoteConfigInstance = null;

export const getFirebaseRemoteConfig = async () => {
    if (typeof window === "undefined" || !app) return null;

    if (remoteConfigInstance) return remoteConfigInstance;

    try {
        const supported = await isSupported();
        if (supported) {
            remoteConfigInstance = getRemoteConfig(app);
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
