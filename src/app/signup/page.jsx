'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@lib/firebase';
import styles from './signup.module.css';

const SignUpPage = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email: user.email,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // تقسيم اسم المستخدم من جوجل
      const [firstNameFromGoogle, ...lastNameParts] = user.displayName.split(' ');
      const lastNameFromGoogle = lastNameParts.join(' ');
      
      // إرسال البيانات مباشرة إلى Firestore في كل الأحوال
      await setDoc(doc(db, 'users', user.uid), {
        firstName: firstNameFromGoogle,
        lastName: lastNameFromGoogle,
        email: user.email,
      });
      
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>إنشاء حساب</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <input
            type="text"
            placeholder="الاسم الأول"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={styles.input}
          />
          <input
            type="text"
            placeholder="الاسم الأخير"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={styles.input}
          />
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
          <button type="submit" className={styles.button}>إنشاء حساب</button>
        </form>
        <div className={styles.divider}>
          <span className={styles.dividerText}>أو</span>
        </div>
        <button onClick={handleGoogleAuth} className={styles.googleButton}>
          <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
          <span>إنشاء حساب باستخدام جوجل</span>
        </button>
        <p className={styles.toggleMode}>
          {'لديك حساب بالفعل؟ '}
          <span onClick={() => router.push('/login')} className={styles.link}>
            تسجيل الدخول
          </span>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;