'use client';

import styles from './contact.module.css';
import Link from 'next/link';
import { Browser } from '@capacitor/browser';
import strings from '../data/ar.json';

export default function ContactPage() {
  const handleExternalLink = async (e, url) => {
    if (typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      e.preventDefault();
      try {
        await Browser.open({ url });
      } catch (error) {
        console.error("Could not open browser", error);
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.contact.title}</h1>
        <p className={styles.tagline}>{strings.contact.tagline}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{strings.contact.reasons_title}</h2>
        <ul className={styles.reasonList}>
          {strings.contact.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{strings.contact.methods_title}</h2>
        <div className={styles.contactMethods}>
          <Link href="mailto:agios.system@gmail.com" className={styles.contactLink}>
            {strings.contact.email_btn}
          </Link>
          <Link
            href="https://www.facebook.com/AgiosSystem/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.contactLink}
            onClick={(e) => handleExternalLink(e, "https://www.facebook.com/AgiosSystem/")}
          >
            {strings.contact.facebook_btn}
          </Link>
        </div>
      </section>

      <footer className={styles.contactFooter}>
        <p>{strings.contact.footer}</p>
      </footer>
    </div>
  );
}
