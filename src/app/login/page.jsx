'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import styles from './login.module.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>تسجيل الدخول</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button}>تسجيل الدخول</button>
        </form>
        <div className={styles.divider}>
          <span className={styles.dividerText}>أو</span>
        </div>
        <button onClick={handleGoogleAuth} className={styles.googleButton}>
          <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
          <span>تسجيل الدخول باستخدام جوجل</span>
        </button>
        <p className={styles.toggleMode}>
          {'ليس لديك حساب؟ '}
          <span onClick={() => router.push('/signup')} className={styles.link}>
            إنشاء حساب
          </span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;