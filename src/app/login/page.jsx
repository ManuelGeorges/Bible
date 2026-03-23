'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
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

    const checkInitialNetwork = async () => {
      const status = await Network.getStatus();
      if (!status.connected) router.push('/offline');
    };
    checkInitialNetwork();

    const networkListener = Network.addListener('networkStatusChange', status => {
      if (!status.connected) router.push('/offline');
    });

    return () => {
      unsubscribe();
      networkListener.remove();
    };
  }, [router]);

  const checkConnection = async () => {
    const status = await Network.getStatus();
    if (!status.connected) {
      router.push('/offline');
      return false;
    }
    return true;
  };

  const translateError = (code) => {
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
    
    const isOnline = await checkConnection();
    if (!isOnline) return;

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

    const isOnline = await checkConnection();
    if (!isOnline) return;

    setError(null);
    setIsSubmitting(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({
          webClientId: '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com',
        });
        
        const idToken = result.credential?.idToken;

        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error("No ID Token");
        }
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err) {
      console.error(err);
      setError('فشل تسجيل الدخول بواسطة جوجل');
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