'use client';

import { useLanguage } from '../context/LanguageContext';
import styles from './about.module.css';
import Image from 'next/image';
import { ExternalLink, Github, Globe, Code } from 'lucide-react';

export default function AboutPage() {
  const { strings, dir, language } = useLanguage();
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

      {/* Developer Section for SEO Boost */}
      <section className={styles.developerSection}>
        <div className={styles.devCard}>
          <div className={styles.devIcon}><Code size={32} /></div>
          <div className={styles.devInfo}>
            <h2 className={styles.subtitle}>{language === 'ar' ? 'عن المطور' : 'About the Developer'}</h2>
            <p className={styles.paragraph}>
              {language === 'ar'
                ? 'تم تطوير نظام أجيوس بواسطة مانويل جورج، مطور برمجيات متخصص في بناء تطبيقات الويب والموبايل المبتكرة.'
                : 'Agios System was developed by Manuel Georges, a software developer specialized in building innovative web and mobile applications.'}
            </p>
            <div className={styles.devLinks}>
              <a href="https://mano-dev.vercel.app/" target="_blank" rel="noopener noreferrer" className={styles.portfolioLink}>
                <Globe size={18} /> {language === 'ar' ? 'الموقع الشخصي' : 'Portfolio'}
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.agios.bible" target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
                <ExternalLink size={18} /> Google Play
              </a>
              <a href="https://apps.apple.com/eg/app/agios-bible-holy-bible/id6773141320" target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
                <ExternalLink size={18} /> App Store
              </a>
            </div>
          </div>
        </div>
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
