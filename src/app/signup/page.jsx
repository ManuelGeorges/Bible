'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  updateProfile
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor-core';
import { auth } from '../../lib/firebase';
import styles from './signup.module.css';
import { Apple } from 'lucide-react';

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !isSubmitting) {
        // توجيه كخطة احتياطية إذا كان المستخدم مسجلاً بالفعل
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router, isSubmitting]);

  const translateError = (code) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return 'لا يوجد اتصال بالإنترنت. يرجى المحاولة لاحقاً.';
    }
    switch (code) {
      case 'auth/email-already-in-use': return 'هذا البريد الإلكتروني مسجل بالفعل.';
      case 'auth/invalid-email': return 'البريد الإلكتروني غير صحيح.';
      case 'auth/weak-password': return 'كلمة المرور ضعيفة (6 أحرف على الأقل).';
      case 'auth/network-request-failed': return 'خطأ في الاتصال بالشبكة.';
      default: return 'حدث خطأ، حاول مرة أخرى.';
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!firstName || !lastName) { setError('يرجى إدخال الاسم كاملًا'); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: `${firstName} ${lastName}`
      });
      // التوجيه المباشر يحل مشكلة التعليق في iOS
      router.replace('/');
    } catch (err) {
      console.error("Signup Error:", err);
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
          webClientId: '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com',
        });
        const idToken = result.credential?.idToken;
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
          router.replace('/');
        } else {
          setIsSubmitting(false);
        }
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        router.replace('/');
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      setError('فشل التسجيل بواسطة جوجل');
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
          router.replace('/');
        } else {
          setIsSubmitting(false);
        }
      } else {
        const provider = new OAuthProvider('apple.com');
        await signInWithPopup(auth, provider);
        router.replace('/');
      }
    } catch (err) {
      console.error("Apple Auth Error:", err);
      setError('فشل التسجيل بواسطة آبل');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>إنشاء حساب جديد</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <div className={styles.nameRow}>
            <input type="text" placeholder="الاسم الأول" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} disabled={isSubmitting} required />
            <input type="text" placeholder="الاسم الأخير" value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          </div>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
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
          لديك حساب بالفعل؟ <span onClick={() => router.push('/login')} className={styles.link}>تسجيل الدخول</span>
        </p>
      </div>
    </div>
  );
}
