'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../lib/firebase';
import styles from './login.module.css';
import { Apple } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const WEB_CLIENT_ID = '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleUserData = async (user) => {
    if (!db) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const [fName, ...lName] = (user.displayName || "").split(' ');
        await setDoc(userRef, {
          firstName: fName || "مستخدم",
          lastName: lName.join(' ') || "جديد",
          email: user.email,
          createdAt: new Date().toISOString(),
          favorites: { verses: {} },
          completedChapters: {},
          completedPlans: {}
        }, { merge: true });
      }
    } catch (err) { console.error("Firestore Sync Error:", err); }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ webClientId: WEB_CLIENT_ID });
        const idToken = result.credential?.idToken;
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          await handleUserData(userCredential.user);
        }
      } else {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await handleUserData(result.user);
      }
      router.replace('/');
    } catch (err) {
      setError('فشل تسجيل الدخول بواسطة جوجل.');
      setIsSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    const provider = new OAuthProvider('apple.com');

    try {
      // 1. محاولة تسجيل الدخول النيتيف (Native) أولاً إذا كنا على تطبيق موبايل
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await FirebaseAuthentication.signInWithApple();
          const idToken = result.credential?.idToken;
          const rawNonce = result.credential?.nonce;

          if (idToken) {
            const credential = provider.credential({
              idToken: idToken,
              rawNonce: rawNonce,
            });
            const userCredential = await signInWithCredential(auth, credential);
            await handleUserData(userCredential.user);
            router.replace('/');
            return; // نجاح العملية نخرج من الدالة
          }
        } catch (nativeErr) {
          console.warn("Native Apple Auth failed, trying Web fallback:", nativeErr);
          // إذا فشل النيتيف (غالباً بسبب عدم وجود Xcode/Capabilities)، هنكمل لطريقة الويب
        }
      }

      // 2. طريقة الويب (Web Flow) كبديل يضمن العمل على كل الأجهزة
      if (Capacitor.isNativePlatform()) {
        // في الموبايل يفضل Redirect لأن الـ Popups غالباً بتتحجب
        await signInWithRedirect(auth, provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        await handleUserData(result.user);
        router.replace('/');
      }

    } catch (err) {
      console.error("Apple Sign-In Error:", err);
      if (err.message?.includes('cancel') || err.code?.includes('canceled')) {
        setIsSubmitting(false);
        return;
      }
      setError('فشل تسجيل الدخول بواسطة آبل. تأكد من إعدادات الـ iCloud.');
      setIsSubmitting(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (err) {
      setError('خطأ في البريد الإلكتروني أو كلمة المرور.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>تسجيل الدخول</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>
        <div className={styles.socialButtons}>
          <button onClick={handleGoogleAuth} className={styles.googleButton} disabled={isSubmitting}>
            <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
            <span>جوجل</span>
          </button>
          {Capacitor.getPlatform() !== 'android' && (
            <button onClick={handleAppleAuth} className={styles.appleButton} disabled={isSubmitting}>
              <Apple size={20} />
              <span>آبل</span>
            </button>
          )}
        </div>
        <p className={styles.toggleMode}>
          ليس لديك حساب؟ <span onClick={() => router.push('/signup')} className={styles.link}>إنشاء حساب</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
