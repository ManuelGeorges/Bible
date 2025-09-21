import { LanguageProvider } from './../context/LanguageContext';

export const metadata = {
  title: ' البحث الكتابي| Agios Bible',
  description:"ابحث في نصوص الكتاب المقدس بسهولة بباحث حرفي سهل الاستخدام وبحث متقدم يستخدم المشتقات والجذور العربية",
  keywords: ['Agios Bible, Agios ,Bible,البحث الكتابي, البحث الإنجيلي, ابحث عن آية , Bible search, ابحث في الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
  title: ' البحث الكتابي| Agios Bible',
          description:"ابحث في نصوص الكتاب المقدس بسهولة بباحث حرفي سهل الاستخدام وبحث متقدم يستخدم المشتقات والجذور العربية",
    type: 'website',
    url: 'https://agios-bible.vercel.app/search',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
  },
};

export default function MapsLayout({ children }) {
  return (
    <LanguageProvider>
      <main className={styles.mainContent}>
        <div className={styles.container}>{children}</div>
      </main>
    </LanguageProvider>
  );
}