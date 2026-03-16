'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import styles from './login.module.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

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
    } catch (err) {
      setError(translateError(err.code));
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    
    const provider = new GoogleAuthProvider();
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(translateError(err.code));
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
          />
          <input 
            type="password" 
            placeholder="كلمة المرور" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className={styles.input}
            disabled={isSubmitting}
          />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>
        <button 
          onClick={handleGoogleAuth} 
          className={styles.googleButton} 
          disabled={isSubmitting}
        >
          <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
          <span>{isSubmitting ? 'جاري التحميل...' : 'الدخول بواسطة جوجل'}</span>
        </button>
        <p className={styles.toggleMode}>
          ليس لديك حساب؟ <span onClick={() => router.push('/signup')} className={styles.link}>إنشاء حساب</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;