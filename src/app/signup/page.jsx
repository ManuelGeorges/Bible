'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../lib/firebase';
import styles from './signup.module.css';

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
      if (user) router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleUserData = async (user) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const [fName, ...lName] = (user.displayName || "مستخدم جديد").split(' ');
      await setDoc(userRef, {
        firstName: fName,
        lastName: lName.join(' ') || '',
        email: user.email,
        createdAt: new Date().toISOString(),
        favorites: { verses: {} },
        completedChapters: {},
        completedPlans: {}
      });
    }
  };

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
        const user = userCredential.user;
        await setDoc(doc(db, 'users', user.uid), {
            firstName,
            lastName,
            email: user.email,
            createdAt: new Date().toISOString(),
            favorites: { verses: {} },
            completedChapters: {},
            completedPlans: {}
        });
        router.replace('/'); // ✅ redirect manually, don't rely on onAuthStateChanged
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
          webClientId: '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com',
        });
        
        const idToken = result.credential?.idToken;

if (idToken) {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    await handleUserData(userCredential.user);
    router.replace('/'); // ✅ add this
}else {
          throw new Error("No ID Token");
        }
      } else {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        await handleUserData(result.user);
      }
    } catch (err) {
      console.error(err);
      setError('فشل التسجيل بواسطة جوجل');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>إنشاء حساب جديد</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <div className={styles.nameRow}>
            <input type="text" placeholder="الاسم الأول" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} disabled={isSubmitting} />
            <input type="text" placeholder="الاسم الأخير" value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} disabled={isSubmitting} />
          </div>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} disabled={isSubmitting} />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} disabled={isSubmitting} />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
          </button>
        </form>
        <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>
        <button onClick={handleGoogleAuth} className={styles.googleButton} disabled={isSubmitting}>
          <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
          <span>{isSubmitting ? 'جاري التحميل...' : 'التسجيل بواسطة جوجل'}</span>
        </button>
        <p className={styles.toggleMode}>
          لديك حساب بالفعل؟ <span onClick={() => router.push('/login')} className={styles.link}>تسجيل الدخول</span>
        </p>
      </div>
    </div>
  );
}