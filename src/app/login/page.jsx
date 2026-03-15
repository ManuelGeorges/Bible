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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  const translateError = (code) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'خطأ في البريد الإلكتروني أو كلمة المرور.';
      case 'auth/too-many-requests': return 'تم حظر المحاولات مؤقتاً لكثرة الأخطاء. حاول لاحقاً.';
      case 'auth/invalid-email': return 'البريد الإلكتروني غير صحيح.';
      default: return 'حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى.';
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(translateError(err.code));
    }
  };

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(translateError(err.code));
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>تسجيل الدخول</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button}>دخول</button>
        </form>
        <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>
        <button onClick={handleGoogleAuth} className={styles.googleButton}>
          <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
          <span>الدخول بواسطة جوجل</span>
        </button>
        <p className={styles.toggleMode}>
          ليس لديك حساب؟ <span onClick={() => router.push('/signup')} className={styles.link}>إنشاء حساب</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;