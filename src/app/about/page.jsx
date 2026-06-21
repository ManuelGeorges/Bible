'use client';

import { useLanguage } from '../context/LanguageContext';
import styles from './about.module.css';
import Image from 'next/image';

export default function AboutPage() {
  const { strings, dir } = useLanguage();
  return (
    <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
      <header className={styles.header}>
        <h1 className={styles.title}>{strings.about.title}</h1>
        <p className={styles.tagline}>{strings.about.tagline}</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{strings.about.story.title}</h2>
        <p className={styles.paragraph}>
          {strings.about.story.p1}
        </p>
        <p className={styles.paragraph}>
          {strings.about.story.p2}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{strings.about.vision.title}</h2>
        <p className={styles.paragraph}>
          {strings.about.vision.desc}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>{strings.about.thanks.title}</h2>
        
        <div className={styles.honorableMention}>
          <div className={styles.priestImageWrapper}>
            <Image 
              src="/images/fr-athanasius.jpg" 
              alt={strings.about.thanks.priest_name}
              width={140} 
              height={140} 
              className={styles.priestImage}
            />
          </div>
          <div className={styles.priestText}>
            <p className={styles.paragraph}>
              {strings.about.thanks.priest_desc.replace('{name}', strings.about.thanks.priest_name)}
            </p>
          </div>
        </div>

        <hr className={styles.dividerLine} />

        <p className={styles.paragraph}>
          {strings.about.thanks.fcbh}
        </p>

        {strings.about.thanks.translations && (
          <p className={styles.paragraph} style={{ fontWeight: '500', color: 'var(--color-primary)' }}>
            {strings.about.thanks.translations}
          </p>
        )}

        <p className={styles.paragraph}> 
          {strings.about.thanks.church}
        </p>

        <p className={styles.paragraph}>
          {strings.about.thanks.general}
        </p>
      </section>

      <footer className={styles.footer}>
        <p>{strings.about.footer}</p>
      </footer>
    </div>
  );
}