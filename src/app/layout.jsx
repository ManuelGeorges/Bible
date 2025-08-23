// app/layout.jsx
import './globals.css';
import styles from './layout.module.css'; // تأكد من المسار الصحيح
import { LanguageProvider } from '../context/LanguageContext';
import BibleNavbar from '../components/BibleNavbar';

export const metadata = {
  title: 'Agios Bible',
  description: 'Your Bible Study Application',
};

export default function RootLayout({ children }) {
  return(
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/favicon.png" />
      </head>
      <body>
        <LanguageProvider>
          <BibleNavbar />
          <main className={styles.mainContent}>
            <div className={styles.container}>
              {children}
            </div>
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}