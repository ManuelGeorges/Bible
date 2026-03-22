import styles from './Privacy.module.css';

export default function PrivacyPolicy() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p style={{ color: 'var(--color-text-medium)' }}>Agios Bible Application</p>
        </header>

        <section>
          <p className={styles.text}>
            This privacy policy applies to the <strong>Agios Bible</strong> app (Application) for mobile devices created by <strong>Agios System</strong> (Service Provider) as a Free service. This service is intended for use "AS IS".
          </p>

          <h2 className={styles.sectionTitle}>Information Collection and Use</h2>
          <p className={styles.text}>The Application collects information when you download and use it. This may include:</p>
          <ul className={styles.list}>
            <li className={styles.listItem}>Your device's IP address.</li>
            <li className={styles.listItem}>Pages visited and time spent within the Application.</li>
            <li className={styles.listItem}>Operating system version of your mobile device.</li>
          </ul>

          <h2 className={styles.sectionTitle}>Artificial Intelligence (AI)</h2>
          <p className={styles.text}>
            The Application uses AI technologies to enhance user experience. These components may process user data to deliver personalized content or automated functionalities in accordance with this policy.
          </p>

          <h2 className={styles.sectionTitle}>Third Party Access</h2>
          <p className={styles.text}>We utilize trusted third-party services to improve our service:</p>
          <ul className={styles.list}>
            <li className={styles.listItem}><a className={styles.link} href="https://www.google.com/policies/privacy/">Google Play Services</a></li>
            <li className={styles.listItem}><a className={styles.link} href="https://firebase.google.com/support/privacy">Firebase Analytics & Crashlytics</a></li>
            <li className={styles.listItem}><a className={styles.link} href="https://www.mapbox.com/legal/privacy">Mapbox</a></li>
          </ul>

          <h2 className={styles.sectionTitle}>Children's Privacy</h2>
          <p className={styles.text}>
            The Application does not address anyone under the age of 13. We do not knowingly collect data from children under 13. If discovered, such data is immediately deleted.
          </p>

          <h2 className={styles.sectionTitle}>Contact Us</h2>
          <p className={styles.text}>
            For any questions regarding privacy, please contact the Service Provider at:
            <br />
            <a href="mailto:agios.system@gmail.com" className={styles.link} style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              agios.system@gmail.com
            </a>
          </p>
        </section>

        <footer className={styles.footer}>
          <p>Effective Date: 2026-03-22</p>
          <p>© 2026 Agios System. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}