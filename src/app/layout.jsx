import './globals.css';
import styles from './layout.module.css';
import BibleNavbar from '../components/BibleNavbar';
import Footer from '../components/Footer';
import Script from 'next/script';
import SEOlinks from '../components/SEOlinks';
import NativeWrapper from '../components/NativeWrapper'; 
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export const metadata = {
  publisher: 'Agios Bible',
  title: 'الموقع الرسمي | Agios Bible ',
  description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات',
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
    description: 'موقع متكامل للكتاب المقدس يشمل خصائص فريدة مثل البحث المتطور وخرائط تفاعلية وخطط دراسة ومسابقات',
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></meta>
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          const theme = localStorage.getItem('theme') || 'dark';
          document.body.classList.add(theme === 'light' ? 'light-theme' : 'dark-theme');
          const fontSize = localStorage.getItem('bibleFontSize') || '18';
          document.documentElement.style.setProperty('--main-font-size', fontSize + 'px');
        } catch (e) { console.log('Theme script error'); }
      })();
    `,
  }}
/>
<script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
<script>
  var vConsole = new window.VConsole();
</script>
      </head>
      <body>
          <NativeWrapper>
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
          </NativeWrapper>
      </body>
    </html>
  );
}