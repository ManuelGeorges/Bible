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
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth } from '../../lib/firebase';
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

  const translateError = (code) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return 'لا يوجد اتصال بالإنترنت. يرجى الاتصال ثم المحاولة.';
    }
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'خطأ في البريد الإلكتروني أو كلمة المرور.';
      case 'auth/too-many-requests': return 'تم حظر المحاولات مؤقتاً. حاول لاحقاً.';
      case 'auth/invalid-email': return 'البريد الإلكتروني غير صحيح.';
      case 'auth/popup-closed-by-user': return 'تم إغلاق نافذة تسجيل الدخول.';
      case 'auth/operation-not-allowed': return 'طريقة تسجيل الدخول هذه غير مفعلة في الإعدادات.';
      default: return 'حدث خطأ، حاول مرة أخرى.';
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
      setError(translateError(err.code));
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({
          webClientId: WEB_CLIENT_ID,
        });
        const idToken = result.credential?.idToken;
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        }
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      router.replace('/');
    } catch (err) {
      console.error("Google Auth Error:", err);
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
        // محاولة تسجيل الدخول الأصلي (Native)
        const result = await FirebaseAuthentication.signInWithApple();

        // إذا نجح الـ Plugin في تسجيل الدخول للـ Firebase تلقائياً
        if (result.user) {
          router.replace('/');
          return;
        }

        const idToken = result.credential?.idToken;
        const rawNonce = result.credential?.rawNonce;

        if (idToken) {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: idToken,
            rawNonce: rawNonce,
          });
          await signInWithCredential(auth, credential);
          router.replace('/');
        } else {
            throw new Error("No ID Token");
        }
      } else {
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        await signInWithPopup(auth, provider);
        router.replace('/');
      }
    } catch (err) {
      console.error("Apple Auth Error:", err);
      // تنبيه المستخدم بالخطأ بشكل أوضح
      setError('فشل تسجيل الدخول بواسطة آبل. قد يحتاج التطبيق لتحديث من المتجر لتفعيل هذه الخاصية.');
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