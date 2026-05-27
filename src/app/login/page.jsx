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
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../lib/firebase';
import styles from './login.module.css';
import { Apple } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false); // لمنع التوجيه التلقائي قبل اكتمال العمليات
  const router = useRouter();

  const WEB_CLIENT_ID = '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // لا توجه للهوم تلقائياً إذا كانت هناك عملية يدوية جارية (جوجل أو آبل أو إيميل)
      if (user && !isSubmittingRef.current) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

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

  const updateSubmitting = (val) => {
    setIsSubmitting(val);
    isSubmittingRef.current = val;
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    updateSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ webClientId: WEB_CLIENT_ID });
        if (result.user) {
          await handleUserData(result.user);
        } else if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          const userCredential = await signInWithCredential(auth, credential);
          await handleUserData(userCredential.user);
        }
      } else {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await handleUserData(result.user);
      }
      router.replace('/'); // التوجيه يدوياً هنا بعد ضمان اكتمال handleUserData
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
        const result = await FirebaseAuthentication.signInWithApple();
        if (result.user) {
          await handleUserData(result.user);
        } else if (result.credential) {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: result.credential.idToken,
            rawNonce: result.credential.nonce,
          });
          const userCredential = await signInWithCredential(auth, credential);
          await handleUserData(userCredential.user);
        }
      } else {
        const provider = new OAuthProvider('apple.com');
        const result = await signInWithPopup(auth, provider);
        await handleUserData(result.user);
      }
      router.replace('/'); // التوجيه يدوياً هنا
    } catch (err) {
      console.error("Apple Auth Error:", err);
      updateSubmitting(false);
      if (err.message?.includes('cancel') || err.code === '1' || err.code === 'auth/cancelled-popup-request') return;
      let msg = 'فشل تسجيل الدخول بواسطة آبل.';
      if (Capacitor.getPlatform() === 'ios') {
        msg = `فشل تسجيل الدخول (iOS). كود: ${err.code || 'unknown'} - الرسالة: ${err.message || ''}. تأكد من تفعيل "Sign In with Apple" في Xcode ومن تسجيل دخولك بـ iCloud.`;
      }
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
          ليس لديك حساب؟ <span onClick={() => router.push('/signup')} className={styles.link}>إنشاء حساب</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
