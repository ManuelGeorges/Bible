import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache
} from "firebase/firestore";
import { Capacitor } from '@capacitor-core';

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

// إعداد Auth مع Persistence متعدد لضمان الحفظ على iOS
const getFirebaseAuth = () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // نضع browserLocalPersistence أولاً لضمان الحفظ الفوري في iOS
      return initializeAuth(app, {
        persistence: [browserLocalPersistence, indexedDBLocalPersistence]
      });
    } catch (e) {
      return getAuth(app);
    }
  }
  return getAuth(app);
};

export const auth = getFirebaseAuth();

export const db = initializeFirestore(app, {
  localCache: Capacitor.isNativePlatform()
    ? memoryLocalCache()
    : persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
});

export { app };
