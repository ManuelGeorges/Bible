import './globals.css';
import styles from './layout.module.css';
import BibleNavbar from '../components/BibleNavbar';
import Footer from '../components/Footer';
import Script from 'next/script';
import SEOlinks from '../components/SEOlinks';
import CapacitorFeatures from '../components/CapacitorFeatures';
import SplashHandler from '../components/SplashHandler';
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'; // 1. استيراد المكون

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#191d34',
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
                  var savedSize = localStorage.getItem('bibleFontSize');
                  if (savedSize) {
                    document.documentElement.style.setProperty('--bible-font-size', savedSize + 'px');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { 
            background-color: #ffffff; 
            margin: 0; 
            padding: 0;
          }
          [data-theme='dark'] body {
            background-color: #191d34 !important;
          }
        `}} />
      </head>
      <body>
        <ThemeProvider 
          attribute="data-theme" 
          defaultTheme="system" 
          enableSystem={true}
        >
          {/* 2. إضافة التوستر هنا ليكون متاحاً في كل الصفحات */}
          <Toaster position="top-center" reverseOrder={false} />
          
          <SplashHandler>
            <CapacitorFeatures />
            <SEOlinks />
            <BibleNavbar />
            <main className={styles.mainContent}>
              <div className={styles.container}>{children}</div>
            </main>
            <Footer />
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
          </SplashHandler>
        </ThemeProvider>
      </body>
    </html>
  );
}