'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
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
      if (user) router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: `${firstName} ${lastName}` });
      router.replace('/');
    } catch (err) {
      setError('حدث خطأ، حاول مرة أخرى.');
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
      setError('فشل التسجيل');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>إنشاء حساب</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <input type="text" placeholder="الاسم الأول" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          <input type="text" placeholder="الاسم الأخير" value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} disabled={isSubmitting} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.invalidPassword)} className={styles.input} disabled={isSubmitting} required />
          <button type="submit" className={styles.button} disabled={isSubmitting}>إنشاء حساب</button>
        </form>
        <button onClick={() => handleSocialAuth(new GoogleAuthProvider())} className={styles.googleButton}>جوجل</button>
        <button onClick={() => handleSocialAuth(new OAuthProvider('apple.com'))} className={styles.appleButton}>آبل</button>
      </div>
    </div>
  );
}