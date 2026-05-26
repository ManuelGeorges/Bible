import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence 
} from "firebase/auth";
import { 
  initializeFirestore, 
  memoryLocalCache 
} from "firebase/firestore";
import { getRemoteConfig, isSupported } from "firebase/remote-config";
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: "AIzaSyAihaAWbI0BHz6zI6Q5JGNxnMPf0JQmZho",
  authDomain: "profiles-system.firebaseapp.com",
  projectId: "profiles-system",
  storageBucket: "profiles-system.firebasestorage.app",
  messagingSenderId: "900022943169",
  appId: "1:900022943169:web:583b03be3f070dfe92c340",
  measurementId: "G-Q42KEXNB3L"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence]
});

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

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

export { app };