'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import styles from './intro.module.css';
import { useLanguage } from '../context/LanguageContext';

export default function IntroPage() {
  const router = useRouter();
  const { strings } = useLanguage();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      if (user) {
        router.replace('/');
      } else {
        setLoading(false);
      }
    }, (error) => {
      console.error("Auth State Error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  if (loading) {
    return (
      <div className={styles.container} style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <div className={styles.loading}>{strings.common.loading}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.intro.title}</h1>
        <p className={styles.subtitle}>
          {strings.intro.subtitle}
        </p>
      </header>
      <main className={styles.mainContent}>
        <section className={styles.features}>
          <h2 className={styles.featuresTitle}>{strings.intro.features_title}</h2>
          <div className={styles.featuresGrid}>
            {strings.intro.features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.callToAction}>
          <p className={styles.ctaText}>{strings.intro.cta_text}</p>
          <button onClick={() => router.push('/signup')} className={styles.button}>
            {strings.intro.signup_btn}
          </button>
          <button onClick={() => router.push('/login')} className={styles.button}>
            {strings.intro.login_btn}
          </button>
        </section>
      </main>
    </div>
  );
}
