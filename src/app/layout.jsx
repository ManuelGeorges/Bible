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
import { LanguageProvider } from './context/LanguageContext';
import GlobalAudioPlayer from '../components/GlobalAudioPlayer';
import LanguageWelcome from '../components/LanguageWelcome';
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
  title: 'Agios Bible',
  description: 'Multilingual Bible app supporting Arabic, English, German, and French.',
  authors: [{ name: 'Manuel Georges' }],
  robots: 'index, follow',
  keywords: ['Agios Bible, Agios , Bible, الكتاب المقدس , Bible study, دراسة الكتاب المقدس, آية اليوم, Verse of the day, خرائط الكتاب المقدس, Bible maps, خطط دراسة الكتاب المقدس, Bible study plans, مسابقات الكتاب المقدس, Bible quizzes, البحث في الكتاب المقدس, Bible search, كتب مسيحية, Christian books'],

  // Smart App Banner for iOS (Safari)
  itunes: {
    appId: '6773141320',
    appArgument: 'https://agios-bible.vercel.app/',
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Agios Bible',
  },
  openGraph: {
    title: 'Agios Bible',
    description: 'Multilingual Bible app supporting Arabic, English, German, and French.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/',
    siteName: 'Agios Bible',
    locale: 'en_US',
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
    // Android App Linking for Chrome
    'google-play-app': 'app-id=com.agios.bible',
    'Content-Security-Policy': "default-src 'self' capacitor-electron://* 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com https://generativelanguage.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://apis.google.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.firebaseapp.com https://*.google.com;",
  },
};

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* Additional Fallback for Android Smart App Banner */}
        <link rel="alternate" href="android-app://com.agios.bible/https/agios-bible.vercel.app/" />
      </head>
      <body>
        <LanguageProvider>
          <LanguageWelcome />
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
        </LanguageProvider>
      </body>
    </html>
  );
}
