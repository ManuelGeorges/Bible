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

// دالة لجلب الـ Remote Config بشكل آمن
const getFirebaseRemoteConfig = async () => {
    if (typeof window !== "undefined") {
        const supported = await isSupported();
        if (supported) {
            const remoteConfig = getRemoteConfig(app);
            remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // ساعة واحدة كاش
            remoteConfig.defaultConfig = {
                app_news: JSON.stringify({ active: false })
            };
            return remoteConfig;
        }
    }
    return null;
};

export { app, auth, db, getFirebaseRemoteConfig };