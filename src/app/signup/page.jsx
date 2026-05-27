'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../lib/firebase';
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

  const WEB_CLIENT_ID = '900022943169-p5r8tqgfb603vqtfdthh1hv7vr94eqrr.apps.googleusercontent.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleUserData = async (user) => {
    if (!db) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const [fName, ...lName] = (user.displayName || "").split(' ');
        await setDoc(userRef, {
          firstName: firstName || fName || "مستخدم",
          lastName: lastName || lName.join(' ') || "جديد",
          email: user.email,
          createdAt: new Date().toISOString(),
          favorites: { verses: {} },
          completedChapters: {},
          completedPlans: {}
        }, { merge: true });
      }
    } catch (err) { console.error("Firestore Sync Error:", err); }
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({ webClientId: WEB_CLIENT_ID });
        const idToken = result.credential?.idToken;
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          await handleUserData(userCredential.user);
        }
      } else {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        await handleUserData(result.user);
      }
      router.replace('/');
    } catch (err) {
      console.error(err);
      setError('فشل التسجيل بواسطة جوجل.');
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
        if (result.credential) {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: result.credential.idToken,
            rawNonce: result.credential.nonce,
          });
          const userCredential = await signInWithCredential(auth, credential);
          await handleUserData(userCredential.user);
          router.replace('/');
        }
      } else {
        const provider = new OAuthProvider('apple.com');
        const result = await signInWithPopup(auth, provider);
        await handleUserData(result.user);
        router.replace('/');
      }
    } catch (err) {
      console.error("Apple Sign-In Error:", err);
      setIsSubmitting(false);

      // تجاهل الإغلاق اليدوي
      if (err.message?.includes('cancel') || err.code === '1' || err.code === 'auth/cancelled-popup-request') return;

      let errorMsg = 'فشل التسجيل بواسطة آبل.';
      if (Capacitor.getPlatform() === 'ios') {
          // إظهار الخطأ التقني لمساعدتنا في تشخيص المشكلة
          errorMsg = `فشل التسجيل (iOS). كود: ${err.code || 'unknown'} - الرسالة: ${err.message || ''}. تأكد من تفعيل "Sign In with Apple" في Xcode ومن تسجيل دخولك بـ iCloud.`;
      }
      setError(errorMsg);
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
      await handleUserData(userCredential.user);
      router.replace('/');
    } catch (err) {
      setError('حدث خطأ في إنشاء الحساب. قد يكون البريد مستخدماً بالفعل.');
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

        <div className={styles.divider}>
          <span className={styles.dividerText}>أو</span>
        </div>

        <div className={styles.socialButtons}>
          <button onClick={handleGoogleAuth} className={styles.googleButton} disabled={isSubmitting}>
            <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
            <span>جوجل</span>
          </button>
          <button onClick={handleAppleAuth} className={styles.appleButton} disabled={isSubmitting}>
            <Apple size={20} />
            <span>آبل</span>
          </button>
        </div>

        <p className={styles.toggleMode}>
          لديك حساب بالفعل؟ <span onClick={() => router.push('/login')} className={styles.link}>تسجيل الدخول</span>
        </p>
      </div>
    </div>
  );
}
