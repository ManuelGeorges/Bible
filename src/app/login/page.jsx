'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor-core';
import { auth, db } from '../../lib/firebase';
import styles from './login.module.css';
import { Apple } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const isSubmittingRef = useRef(false);
  const router = useRouter();

  const WEB_CLIENT_ID = '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com';

  useEffect(() => {
    setIsIOS(Capacitor.getPlatform() === 'ios');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !isSubmittingRef.current) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const updateSubmitting = (val) => {
    setIsSubmitting(val);
    isSubmittingRef.current = val;
  };

  const handleUserData = async (user) => {
    if (!db || !user) return;
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

  const waitForAuthSync = () => {
    return new Promise((resolve) => {
      if (auth.currentUser) return resolve(auth.currentUser);
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      });
      setTimeout(() => { unsubscribe(); resolve(auth.currentUser); }, 5000);
    });
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    updateSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signInWithGoogle({ webClientId: WEB_CLIENT_ID });
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }

      const user = await waitForAuthSync();
      if (user) {
        await handleUserData(user);
        router.replace('/');
      } else {
        throw new Error("فشل مزامنة بيانات المستخدم.");
      }
    } catch (err) {
      console.error(err);
      setError('فشل تسجيل الدخول بواسطة جوجل.');
      updateSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    updateSubmitting(true);

    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signInWithApple();
      } else {
        const provider = new OAuthProvider('apple.com');
        await signInWithPopup(auth, provider);
      }

      const user = await waitForAuthSync();
      if (user) {
        await handleUserData(user);
        router.replace('/');
      } else {
        throw new Error("فشل مزامنة بيانات المستخدم.");
      }
    } catch (err) {
      console.error("Apple Auth Error:", err);
      updateSubmitting(false);
      if (err.message?.includes('cancel') || err.code === '1' || err.code === 'auth/cancelled-popup-request') return;
      let msg = 'فشل تسجيل الدخول بواسطة آبل.';
      setError(msg);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    updateSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleUserData(userCredential.user);
      router.replace('/');
    } catch (err) {
      setError('خطأ في البريد الإلكتروني أو كلمة المرور.');
      updateSubmitting(false);
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

        {!isIOS && (
          <>
            <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>
            <div className={styles.socialButtons}>
              <button onClick={handleGoogleAuth} className={styles.googleButton} disabled={isSubmitting}>
                <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
                <span>جوجل</span>
              </button>
              <button onClick={handleAppleAuth} className={styles.appleButton} disabled={isSubmitting}>
                <Apple size={20} />
                <span>آبل</span>
              </button>
            </div>
          </>
        )}

        <p className={styles.toggleMode}>
          ليس لديك حساب؟ <span onClick={() => router.push('/signup')} className={styles.link}>إنشاء حساب</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
