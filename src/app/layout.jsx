// app/layout.jsx
import './globals.css';
import styles from './layout.module.css';
import { LanguageProvider } from '../context/LanguageContext';
import BibleNavbar from '../components/BibleNavbar';
import Script from 'next/script';

export const metadata = {
  title: 'Agios Bible',
  description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات',
  authors: [{ name: 'Manuel Georges' }],
  robots: 'index, follow',
  viewport: 'width=device-width, initial-scale=1.0',
  openGraph: {
    title: 'Agios Bible',
    description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات',
    type: 'website',
    url: 'https://agios-bible.vercel.app/',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
    images: [
      {
        url: 'https://agios-bible.vercel.app/images/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
      },
    ],
  },
  icons: {
    icon: '/images/logo.png',
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

        {/* Google Analytics */}
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
      </body>
    </html>
  );
}
