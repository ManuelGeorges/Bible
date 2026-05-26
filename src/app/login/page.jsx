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
import { Capacitor } from '@capacitor-core';
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

  // دالة توجيه آمنة خاصة بنظام iOS مع تأخير لضمان حفظ الجلسة في الذاكرة
  const safeRedirect = async (path) => {
    if (Capacitor.getPlatform() === 'ios') {
      // ننتظر نصف ثانية لضمان أن Firebase قام بكتابة الـ Token في IndexedDB
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.href = path;
    } else {
      router.replace(path);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !isSubmitting) {
        safeRedirect('/');
      }
    });
    return () => unsubscribe();
  }, [isSubmitting]);

  const translateError = (code) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return 'لا يوجد اتصال بالإنترنت.';
    }
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'خطأ في البريد الإلكتروني أو كلمة المرور.';
      case 'auth/too-many-requests': return 'تم حظر المحاولات مؤقتاً.';
      case 'auth/invalid-email': return 'البريد الإلكتروني غير صحيح.';
      case 'auth/popup-closed-by-user': return 'تم إغلاق نافذة تسجيل الدخول.';
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
      await safeRedirect('/');
    } catch (err) {
      console.error("Login Error:", err);
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
          await safeRedirect('/');
        } else {
          setIsSubmitting(false);
        }
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        await safeRedirect('/');
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      setError('فشل تسجيل الدخول');
      setIsSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithApple();
        const idToken = result.credential?.idToken;
        const rawNonce = result.credential?.rawNonce;
        if (idToken) {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({ idToken, rawNonce });
          await signInWithCredential(auth, credential);
          await safeRedirect('/');
        } else {
          setIsSubmitting(false);
        }
      } else {
        const provider = new OAuthProvider('apple.com');
        await signInWithPopup(auth, provider);
        await safeRedirect('/');
      }
    } catch (err) {
      console.error("Apple Auth Error:", err);
      setError('فشل تسجيل الدخول');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>تسجيل الدخول</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            disabled={isSubmitting}
            required
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            disabled={isSubmitting}
            required
          />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>

        <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>

        <div className={styles.socialButtons}>
          <button onClick={handleGoogleAuth} className={styles.googleButton} disabled={isSubmitting}>
            {isSubmitting ? <span>...</span> : (
              <>
                <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
                <span>جوجل</span>
              </>
            )}
          </button>

          {Capacitor.getPlatform() !== 'android' && (
            <button onClick={handleAppleAuth} className={styles.appleButton} disabled={isSubmitting}>
               {isSubmitting ? <span>...</span> : (
                <>
                  <Apple size={20} />
                  <span>آبل</span>
                </>
              )}
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
