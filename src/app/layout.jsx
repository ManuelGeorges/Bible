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
import { BadgeProvider } from './context/BadgeContext';
import { AudioProvider } from './context/AudioContext';
import GlobalAudioPlayer from '../components/GlobalAudioPlayer';
import TopHeader from '../components/TopHeader';

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
    statusBarStyle: 'default',
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
        url: 'https://agios-bible.vercel.app/agios.png',
        width: 1200,
        height: 630,
        type: 'image/png',
      },
    ],
  },
  icons: {
    icon: '/agios.png',
    shortcut: '/agios.png',
    apple: '/agios.png',
  },
  verification: {
    google: 'JTfGW-LIKZCB-BMpO_0Ziky-cRpExV_HedDEHumxLqY',
  },
  other: {
    'Content-Security-Policy': "default-src 'self' capacitor-electron://* 'unsafe-inline' 'unsafe-eval' data:; connect-src 'self' https://*.googleapis.com https://generativelanguage.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var savedTheme = localStorage.getItem('theme');
    var theme = savedTheme;
    if (!theme || theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', theme);
    var bgColor = (theme === 'dark' ? '#020617' : '#f0f4f8');
    document.documentElement.style.backgroundColor = bgColor;

    var updateThemeColor = function() {
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach(function(m) { m.setAttribute('content', bgColor); });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateThemeColor);
    } else {
      updateThemeColor();
    }
  } catch (e) {}
})();
      `,
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
          html { background-color: #f0f4f8; }
          html[data-theme='dark'] { background-color: #020617; }
          body { background-color: transparent !important; margin: 0; padding: 0; }
        `}} />
      </head>
      <body>
        <BadgeProvider>
          <AudioProvider>
            <StatsWatcher />
            <ThemeProvider
              attribute="data-theme"
              defaultTheme="system"
              enableSystem={true}
              storageKey="theme"
            >
              <Toaster position="top-center" containerStyle={{ zIndex: 1000000 }} />
              <UserTracker />
              <TopHeader />
              <BibleNavbar />

              <SplashHandler>
                <main className={styles.mainContent}>
                  <div className={styles.container}>{children}</div>
                </main>
                <GlobalAudioPlayer />
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
          </AudioProvider>
        </BadgeProvider>
      </body>
    </html>
  );
}
