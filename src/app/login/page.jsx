'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  OAuthProvider
} from 'firebase/auth';
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

  const showAlert = (msg) => {
    if (typeof window !== 'undefined') alert(msg);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const translateError = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'خطأ في البريد الإلكتروني أو كلمة المرور.';
      case 'auth/too-many-requests': return 'تم حظر المحاولات مؤقتاً.';
      case 'auth/invalid-email': return 'البريد الإلكتروني غير صحيح.';
      case 'auth/popup-closed-by-user': return 'تم إغلاق نافذة التسجيل.';
      case 'auth/network-request-failed': return 'خطأ في الشبكة، تأكد من الاتصال.';
      default: return 'حدث خطأ: ' + code;
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    showAlert("بدء تسجيل الدخول بالبريد...");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showAlert("تم الدخول بنجاح!");
      window.location.replace('/');
    } catch (err) {
      const msg = translateError(err.code);
      showAlert("خطأ: " + msg);
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    showAlert("جاري فتح نافذة جوجل...");

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showAlert("تم نجاح تسجيل الدخول بجوجل!");
      window.location.replace('/');
    } catch (err) {
      const msg = "خطأ جوجل: " + err.message;
      showAlert(msg);
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    showAlert("جاري فتح نافذة آبل...");

    try {
      const provider = new OAuthProvider('apple.com');
      await signInWithPopup(auth, provider);
      showAlert("تم نجاح تسجيل الدخول بآبل!");
      window.location.replace('/');
    } catch (err) {
      const msg = "خطأ آبل: " + err.message;
      showAlert(msg);
      setError(msg);
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