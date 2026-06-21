'use client';

import { useLanguage } from '../context/LanguageContext';
import styles from './Privacy.module.css';

export default function PrivacyPolicy() {
  const { strings, dir } = useLanguage();
  const s = strings.privacy;

  return (
    <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>{s.title}</h1>
          <p style={{ color: 'var(--color-text-medium)' }}>{s.subtitle}</p>
        </header>

        <section>
          <p className={styles.text}>{s.sections.desc}</p>

          <h2 className={styles.sectionTitle}>{s.sections.collection_title}</h2>
          <p className={styles.text}>{s.sections.collection_text}</p>
          <ul className={styles.list}>
            {s.sections.collection_items.map((item, i) => (
              <li key={i} className={styles.listItem}>{item}</li>
            ))}
          </ul>

          <h2 className={styles.sectionTitle}>{s.sections.ai_title}</h2>
          <p className={styles.text}>{s.sections.ai_text}</p>

          <h2 className={styles.sectionTitle}>{s.sections.third_party_title}</h2>
          <p className={styles.text}>{s.sections.third_party_text}</p>
          <ul className={styles.list}>
            <li className={styles.listItem}><a className={styles.link} href="https://www.google.com/policies/privacy/">Google Play Services</a></li>
            <li className={styles.listItem}><a className={styles.link} href="https://firebase.google.com/support/privacy">Firebase Analytics & Crashlytics</a></li>
            <li className={styles.listItem}><a className={styles.link} href="https://www.mapbox.com/legal/privacy">Mapbox</a></li>
          </ul>

          <h2 className={styles.sectionTitle}>{s.sections.children_title}</h2>
          <p className={styles.text}>{s.sections.children_text}</p>

          <h2 className={styles.sectionTitle}>{s.sections.contact_title}</h2>
          <p className={styles.text}>
            {s.sections.contact_text}
            <br />
            <a href="mailto:agios.system@gmail.com" className={styles.link} style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              agios.system@gmail.com
            </a>
          </p>
        </section>

        <footer className={styles.footer}>
          <p>{s.footer_effective}</p>
          <p>{s.footer_rights}</p>
        </footer>
      </div>
    </div>
  );
}
