'use client';

import { useState, useEffect } from 'react';
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

    try {
      if (Capacitor.isNativePlatform()) {
        // استخدام الطريقة النيتيف الخاصة بـ Capacitor (بتاع الكاباسيتور نفسه)
        const result = await FirebaseAuthentication.signInWithApple();

        if (result.credential) {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: result.credential.idToken,
            rawNonce: result.credential.nonce, // البلاجن بيولد الـ Nonce نيتيف
          });

          const userCredential = await signInWithCredential(auth, credential);
          await handleUserData(userCredential.user);
          router.replace('/');
        }
      } else {
        // طريقة الويب (شغالة معاك تمام)
        const provider = new OAuthProvider('apple.com');
        const result = await signInWithPopup(auth, provider);
        await handleUserData(result.user);
        router.replace('/');
      }
    } catch (err) {
      console.error("Apple Auth Error:", err);
      setIsSubmitting(false);

      if (err.message?.includes('cancel') || err.code === '1') return;

      // رسالة الخطأ دي بتظهر غالباً لما تكون الـ Capability ناقصة في ملفات الـ iOS
      let msg = 'فشل تسجيل الدخول بواسطة آبل.';
      if (Capacitor.getPlatform() === 'ios') {
        msg = 'فشل تسجيل الدخول. تأكد من تفعيل "Sign In with Apple" في إعدادات التطبيق وتأكد من تسجيل دخولك بـ iCloud.';
      }
      setError(msg);
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
