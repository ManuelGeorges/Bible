import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
// 1. استيراد دوال الـ Remote Config
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

// 2. إعداد الـ Remote Config مع التحقق من دعم المتصفح (مهم لـ Next.js SSR)
let remoteConfig = null;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      remoteConfig = getRemoteConfig(app);
      // إعدادات اختيارية: مدة الكاش (مثلاً ساعة واحدة)
      remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
      // قيم افتراضية (مفيدة جداً عشان الكود ميعطلش لو مفيش نت)
      remoteConfig.defaultConfig = {
        min_required_version: 0,
      };
    }
  });
}

export { app, auth, db, remoteConfig };