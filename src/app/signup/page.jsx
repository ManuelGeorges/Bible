'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
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

  const showAlert = (msg) => {
    if (typeof window !== 'undefined') alert(msg);
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          router.replace('/');
        }
      })
      .catch((err) => {
        if (err.code !== 'auth/null-user') {
          showAlert("خطأ في نتيجة التحويل: " + err.message);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!firstName || !lastName) { alert('يرجى إدخال الاسم كاملًا'); return; }
    
    setError(null);
    setIsSubmitting(true);
    showAlert("بدء إنشاء الحساب...");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      showAlert("تم إنشاء الحساب، جاري تحديث الاسم...");
      
      await updateProfile(userCredential.user, {
        displayName: `${firstName} ${lastName}`
      });
      
      showAlert("تمت العملية بنجاح! جاري الانتقال للرئيسية...");
      router.replace('/');
    } catch (err) {
      const msg = `خطأ (${err.code}): ${err.message}`;
      showAlert(msg);
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    showAlert("جاري التحويل لصفحة جوجل...");

    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (err) {
      showAlert("خطأ جوجل: " + err.message);
      setIsSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    showAlert("جاري التحويل لصفحة آبل...");

    try {
      const provider = new OAuthProvider('apple.com');
      await signInWithRedirect(auth, provider);
    } catch (err) {
      showAlert("خطأ آبل: " + err.message);
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
            {isSubmitting ? 'جاري التنفيذ...' : 'إنشاء حساب'}
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
          لديك حساب بالفعل؟ <span onClick={() => router.push('/login')} className={styles.link}>تسجيل الدخول</span>
        </p>
      </div>
    </div>
  );
}