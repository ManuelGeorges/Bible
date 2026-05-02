import './globals.css';
import styles from './layout.module.css';
import BibleNavbar from '../components/BibleNavbar';
import Footer from '../components/Footer';
import Script from 'next/script';
import SEOlinks from '../components/SEOlinks';
import CapacitorFeatures from '../components/CapacitorFeatures';
import SplashHandler from '../components/SplashHandler';
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast';
import UserTracker from '../components/UserTracker';
import StatsWatcher from '../components/StatsWatcher';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0f4f8' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export const metadata = {
  publisher: 'Agios Bible',
  title: 'الموقع الرسمي | Agios Bible ',
  description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث متطور وخرائط تفاعلية وخطط دراسة ومسابقات',
  authors: [{ name: 'Manuel Georges' }],
  robots: 'index, follow',
  keywords: ['Agios Bible, Agios , Bible, الكتاب المقدس , Bible study, دراسة الكتاب المقدس, آية اليوم, Verse of the day, خرائط الكتاب المقدس, Bible maps, خطط دراسة الكتاب المقدس, Bible study plans, مسابقات الكتاب المقدس, Bible quizzes, البحث في الكتاب المقدس, Bible search, كتب مسيحية, Christian books'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Agios Bible',
  },
  openGraph: {
    title: 'Agios Bible',
    description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث متطور وخرائط تفاعلية وخطط دراسة ومسابقات',
    type: 'website',
    url: 'https://agios-bible.vercel.app/',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
    images: [
      {
        url: 'https://agios-bible.vercel.app/web-app-manifest-512x512-v2.png',
        width: 1200,
        height: 630,
        type: 'image/png',
      },
    ],
  },
  icons: {
    icon: '/web-app-manifest-192x192-v2.png',
    shortcut: '/web-app-manifest-192x192-v2.png',
    apple: '/web-app-manifest-192x192-v2.png',
  },
  verification: {
    google: 'JTfGW-LIKZCB-BMpO_0Ziky-cRpExV_HedDEHumxLqY',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
             __html: `
               (function() {
                 try {
                   var savedTheme = localStorage.getItem('theme');
                   var savedSize = localStorage.getItem('bibleFontSize');

                   if (savedSize) {
                     document.documentElement.style.setProperty('--bible-font-size', savedSize + 'px');
                   }

                   // إذا كانت القيمة "undefined" أو غير موجودة، اجعلها تتبع النظام
                   if (!savedTheme || savedTheme === 'undefined') {
                     localStorage.setItem('theme', 'system');
                   }

                   // تطبيق الثيم فوراً لتجنب الـ Flash
                   const theme = savedTheme === 'system' || !savedTheme
                     ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                     : savedTheme;
                   document.documentElement.setAttribute('data-theme', theme);
                 } catch (e) {}
               })();
             `,
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `
          /* إجبار الخلفية البيضاء كحالة افتراضية */
          html, body {
            background-color: #f0f4f8 !important;
            margin: 0; 
            padding: 0;
          }
          /* تطبيق الداكن فقط إذا كان النظام يطلب ذلك أو المستخدم اختاره */
          @media (prefers-color-scheme: dark) {
            html:not([data-theme='light']) body {
              background-color: #020617 !important;
            }
          }
          html[data-theme='dark'] body {
            background-color: #020617 !important;
          }
        `}} />
      </head>
      <body>
        <StatsWatcher />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem={true}
        >
          <Toaster position="top-center" />
          <UserTracker />
          <BibleNavbar />

          <SplashHandler>
            <main className={styles.mainContent}>
              <div className={styles.container}>{children}</div>
            </main>
            <Footer />
            <CapacitorFeatures />
            <SEOlinks />
          </SplashHandler>

          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-J90H6JXHNG"
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-J90H6JXHNG');
            `}
          </Script>
        </ThemeProvider>
      </body>
    </html>
  );
}
