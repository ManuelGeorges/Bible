'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../lib/firebase';
import styles from './signup.module.css';
import { Apple } from 'lucide-react';

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const router = useRouter();

  const WEB_CLIENT_ID = '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // منع التوجيه التلقائي إذا كنا في نص عملية تسجيل دخول يدوية لضمان اكتمال المزامنة وحفظ البيانات
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
          firstName: firstName || fName || "مستخدم",
          lastName: lastName || lName.join(' ') || "جديد",
          email: user.email,
          createdAt: new Date().toISOString(),
          favorites: { verses: {} },
          completedChapters: {},
          completedPlans: {}
        }, { merge: true });
      }
    } catch (err) { console.error("Firestore Sync Error:", err); }
  };

  const syncAuthAndRedirect = async (nativeResult) => {
    let user = auth.currentUser;

    // 1. انتظار قصير للمزامنة التلقائية (Web SDK تلقط الجلسة من الـ Native)
    if (!user) {
      user = await new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (auth.currentUser || attempts > 10) {
            clearInterval(interval);
            resolve(auth.currentUser);
          }
        }, 200);
      });
    }

    // 2. مزامنة يدوية إجبارية إذا لزم الأمر لضمان الربط 100%
    if (!user && nativeResult?.credential) {
      try {
        const providerId = nativeResult.credential.nonce ? 'apple.com' : 'google.com';
        const credential = providerId === 'apple.com'
          ? new OAuthProvider('apple.com').credential({
              idToken: nativeResult.credential.idToken,
              rawNonce: nativeResult.credential.nonce
            })
          : GoogleAuthProvider.credential(nativeResult.credential.idToken);

        const userCredential = await signInWithCredential(auth, credential);
        user = userCredential.user;
      } catch (e) {
        console.warn("Sync overlap handled");
        user = auth.currentUser;
      }
    }

    const finalUser = user || nativeResult?.user;
    if (finalUser) {
      await handleUserData(finalUser);
      // تأخير بسيط لضمان ثبات الجلسة في الـ WebView قبل التوجيه
      setTimeout(() => router.replace('/'), 500);
    } else {
      throw new Error("فشل مزامنة الجلسة");
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    updateSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ webClientId: WEB_CLIENT_ID });
        await syncAuthAndRedirect(result);
      } else {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await handleUserData(result.user);
        router.replace('/');
      }
    } catch (err) {
      console.error(err);
      setError('فشل التسجيل بواسطة جوجل.');
      updateSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    updateSubmitting(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithApple();
        await syncAuthAndRedirect(result);
      } else {
        const provider = new OAuthProvider('apple.com');
        const result = await signInWithPopup(auth, provider);
        await handleUserData(result.user);
        router.replace('/');
      }
    } catch (err) {
      console.error("Apple Sign-In Error:", err);
      updateSubmitting(false);
      if (err.message?.includes('cancel') || err.code === '1' || err.code === 'auth/cancelled-popup-request') return;
      setError('فشل التسجيل بواسطة آبل.');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!firstName || !lastName) { setError('يرجى إدخال الاسم كاملًا'); return; }
    setError(null);
    updateSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await handleUserData(userCredential.user);
      router.replace('/');
    } catch (err) {
      setError('حدث خطأ في إنشاء الحساب. قد يكون البريد مستخدماً بالفعل.');
      updateSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>إنشاء حساب جديد</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <div className={styles.nameRow}>
            <input type="text" placeholder="الاسم الأول" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} disabled={isSubmitting} required />
            <input type="text" placeholder="الاسم الأخير" value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          </div>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
          </button>
        </form>
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
        <p className={styles.toggleMode}>
          لديك حساب بالفعل؟ <span onClick={() => router.push('/login')} className={styles.link}>تسجيل الدخول</span>
        </p>
      </div>
    </div>
  );
}
