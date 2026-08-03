import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager
} from "firebase/firestore";
import { getRemoteConfig, isSupported } from "firebase/remote-config";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAihaAWbI0BHz6zI6Q5JGNxnMPf0JQmZho",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "profiles-system.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "profiles-system",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "profiles-system.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "900022943169",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:900022943169:web:583b03be3f070dfe92c340"
};

const initializeFirebase = () => {
  if (getApps().length > 0) {
    return getApp();
  }
  try {
    return initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
    return null;
  }
};

const app = initializeFirebase();

export const auth = (() => {
  if (!app) return null;
  if (Capacitor.isNativePlatform()) {
    try {
      return initializeAuth(app, {
        persistence: indexedDBLocalPersistence
      });
    } catch (e) {
      return getAuth(app);
    }
  }
  return getAuth(app);
})();

export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}) : null;

export { app };

let remoteConfigInstance = null;

export const getFirebaseRemoteConfig = async () => {
    if (typeof window === "undefined" || !app) return null;
    if (remoteConfigInstance) return remoteConfigInstance;

    try {
        const supported = await isSupported();
        if (supported) {
            const remoteConfig = getRemoteConfig(app);
            remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
            remoteConfig.defaultConfig = {
                'show_sync_login': true,
                'show_maptiler_features': true,
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
            remoteConfigInstance = remoteConfig;
            return remoteConfigInstance;
        }
    } catch (e) {
        console.warn("Remote Config / Installations Error (expected in some environments):", e.message);
    }
    return null;
};
