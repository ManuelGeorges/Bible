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
        <meta property="og:title" content="Agios Bible"/>
        <meta property="og:description" content=" موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات"/>
        <meta property="og:type" content="website"/>
        <meta property="og:url" content="https://agios-bible.vercel.app/"/>
        <meta property="og:site_name" content="Agios Bible"/>
        <meta property="og:locale" content="ar_AR"/>
        <meta property="og:image" content="https://agios-bible.vercel.app/images/logo.png"/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>
        <meta property="og:image:type" content="image/png"/>
        <meta name ="author" content="Manuel Georges"/>
        <meta name="title" content="Agios Bible"/>
        <meta name="description" content=" موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات"/>
       <meta name="robots" content="index, follow"/>
       <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
       <meta name="charset" content="UTF-8"/>
       <link rel="canonical" href="https://agios-bible.vercel.app/"/>

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