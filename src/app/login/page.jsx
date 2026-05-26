'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import styles from './login.module.css';
import { Apple } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/');
      }
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

  const handleSocialAuth = async (provider) => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithPopup(auth, provider);
      router.replace('/');
    } catch (err) {
      setError('فشل تسجيل الدخول');
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
          <button onClick={() => handleSocialAuth(new GoogleAuthProvider())} className={styles.googleButton} disabled={isSubmitting}>
            <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
            <span>جوجل</span>
          </button>
          <button onClick={() => handleSocialAuth(new OAuthProvider('apple.com'))} className={styles.appleButton} disabled={isSubmitting}>
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