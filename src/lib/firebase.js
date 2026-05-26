import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getRemoteConfig, isSupported } from "firebase/remote-config";

// إعدادات Firebase - تم تحديث الـ API Key ليتطابق مع إعدادات المشروع
const firebaseConfig = {
  apiKey: "AIzaSyAihaAWbI0BHz6zI6Q5JGNxnMPf0JQmZho",
  authDomain: "profiles-system.firebaseapp.com",
  projectId: "profiles-system",
  storageBucket: "profiles-system.firebasestorage.app",
  messagingSenderId: "900022943169",
  appId: "1:900022943169:web:583b03be3f070dfe92c340",
  measurementId: "G-Q42KEXNB3L"
};

const initializeFirebase = () => {
  if (getApps().length > 0) return getApp();
  try {
    return initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
    return null;
  }
};

const app = initializeFirebase();

// تصدير الخدمات بشكل آمن
export const auth = app ? getAuth(app) : null;
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
            remoteConfigInstance = getRemoteConfig(app);
            return remoteConfigInstance;
        }
    } catch (e) { console.error(e); }
    return null;
};