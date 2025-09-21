import { LanguageProvider } from './../context/LanguageContext';

export const metadata = {
  title: ' المسابقات | Agios Bible',
  description:"اختبر معرفتك في الكتاب المقدس وقم بحل أسئلة كتابية متدرجة الصعوبة عن إكمال الآيات والأشخاص وغيرها",
  keywords: ['Agios Bible, Agios , مسابقات الكتاب المقدس, أسئلة كتابية , أسئلة الإنجيل , مسابقات كتاب مقدس,Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'المسابقات | Agios Bible',
    description: "اختبر معرفتك في الكتاب المقدس وقم بحل أسئلة كتابية متدرجة الصعوبة عن إكمال الآيات والأشخاص وغيرها",
    type: 'website',
    url: 'https://agios-bible.vercel.app/competitions',
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