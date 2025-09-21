// app/layout.jsx
import './globals.css';
import styles from './layout.module.css';
import { LanguageProvider } from '../context/LanguageContext';
import BibleNavbar from '../components/BibleNavbar';
import Script from 'next/script';

// Correct Viewport export
export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export const metadata = {
  publisher: 'Agios Bible',
  title: 'Agios Bible',
  description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات',
  authors: [{ name: 'Manuel Georges' }],
  robots: 'index, follow',
  keywords: ['Agios Bible, Agios , Bible, الكتاب المقدس , Bible study, دراسة الكتاب المقدس, آية اليوم, Verse of the day, خرائط الكتاب المقدس, Bible maps, خطط دراسة الكتاب المقدس, Bible study plans, مسابقات الكتاب المقدس, Bible quizzes, البحث في الكتاب المقدس, Bible search, كتب مسيحية, Christian books'],
  openGraph: {
    title: 'Agios Bible',
    description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات',
    type: 'website',
    url: 'https://agios-bible.vercel.app/',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
    images: [
      {
        url: 'https://agios-bible.vercel.app/icon.png',
        width: 1200,
        height: 630,
        type: 'image/png',
      },
    ],
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  verification: {
    google: 'JTfGW-LIKZCB-BMpO_0Ziky-cRpExV_HedDEHumxLqY',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <LanguageProvider>
          <BibleNavbar />
          <main className={styles.mainContent}>
            <div className={styles.container}>{children}</div>
          </main>
        </LanguageProvider>
      </body>

      {/* Google Analytics - Correct placement for lazy load */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-J90H6JXHNG"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-J90H6JXHNG');
        `}
      </Script>
      
      {/* Schema.org Script - Correct placement */}
      <Script type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Agios Bible",
            "url": "https://agios-bible.vercel.app/"
          }
        `}
      </Script>
    </html>
  );
}