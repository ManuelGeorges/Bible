import { LanguageProvider } from './../context/LanguageContext';

export const metadata = {
  title: ' تواصل معنا | Agios Bible',
  description:" تواصل مع إدارة  Agios Bible لأي استفسار أو اقتراح أو دعم فني أو للانتساب لهم",
  keywords: ['Agios Bible, Agios , مسابقات الكتاب المقدس, أسئلة كتابية , أسئلة الإنجيل , مسابقات كتاب مقدس,Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'تواصل معنا | Agios Bible',
     description:" تواصل مع إدارة  Agios Bible لأي استفسار أو اقتراح أو دعم فني أو للانتساب لهم",

    type: 'website',
    url: 'https://agios-bible.vercel.app/contact',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
  },
};

export default function MapsLayout({ children }) {
  return (
    <LanguageProvider>
      <main>
        <div>{children}</div>
      </main>
    </LanguageProvider>
  );
}