'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
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
      if (user) router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  const translateError = (code) => {
    switch (code) {
      case 'auth/email-already-in-use': return 'هذا البريد الإلكتروني مسجل بالفعل.';
      case 'auth/invalid-email': return 'البريد الإلكتروني غير صحيح.';
      case 'auth/weak-password': return 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).';
      case 'auth/network-request-failed': return 'خطأ في الاتصال بالإنترنت.';
      default: return 'حدث خطأ غير متوقع، حاول مرة أخرى.';
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    if (!firstName || !lastName) { setError('يرجى إدخال الاسم كاملاً'); return; }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
        email: user.email,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      setError(translateError(err.code));
    }
  };

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const [fName, ...lName] = (user.displayName || "مستخدم جديد").split(' ');
        await setDoc(userRef, {
          firstName: fName,
          lastName: lName.join(' ') || '',
          email: user.email,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      setError(translateError(err.code));
    }
  };

  return (
    <div className={`${styles.container} ${styles.rtl}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>إنشاء حساب جديد</h1>
        <form onSubmit={handleAuth} className={styles.form}>
          <div className={styles.nameRow}>
            <input type="text" placeholder="الاسم الأول" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} />
            <input type="text" placeholder="الاسم الأخير" value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} />
          </div>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.input} />
          {error && <div className={styles.errorBox}>{error}</div>}
          <button type="submit" className={styles.button}>إنشاء حساب</button>
        </form>
        <div className={styles.divider}><span className={styles.dividerText}>أو</span></div>
        <button onClick={handleGoogleAuth} className={styles.googleButton}>
          <img src="/images/google.png" alt="Google" className={styles.googleIcon} />
          <span>التسجيل بواسطة جوجل</span>
        </button>
        <p className={styles.toggleMode}>
          لديك حساب بالفعل؟ <span onClick={() => router.push('/login')} className={styles.link}>تسجيل الدخول</span>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;