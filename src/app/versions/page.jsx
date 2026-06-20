import styles from './versions.module.css';
import { useLanguage } from '../context/LanguageContext';
import updates from '../data/updates.json';

export default function VersionsPage() {
  const { strings } = useLanguage();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{strings.versions.title}</h1>
      <p className={styles.introParagraph}>
        {strings.versions.intro}
      </p>

      <div className={styles.updatesGrid}>
        {updates.map((update, index) => (
          <div key={index} className={styles.updateCard} style={{ borderTop: '4px solid #D4AF37' }}>
            <div className={styles.updateHeader}>
              <span className={styles.versionNumber} style={{ color: '#D4AF37', fontWeight: 'bold' }}>
                {update.version}
              </span>
              <span className={styles.updateDate}>{update.date}</span>
            </div>
            <h2 className={styles.updateTitle}>{update.title}</h2>

            {update.features.length > 0 && (
              <>
                <h3 className={styles.listTitle}>{strings.versions.labels.features}</h3>
                <ul className={styles.featureList}>
                  {update.features.map((feature, idx) => (
                    <li key={idx} className={styles.listItem}>{feature}</li>
                  ))}
                </ul>
              </>
            )}

            {update.fixes.length > 0 && (
              <>
                <h3 className={styles.listTitle}>{strings.versions.labels.fixes}</h3>
                <ul className={styles.fixesList}>
                  {update.fixes.map((fix, idx) => (
                    <li key={idx} className={styles.listItem}>{fix}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
