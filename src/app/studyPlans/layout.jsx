import { LanguageProvider } from './../context/LanguageContext';
export const metadata = {
  title: ' خطط دراسة الكتاب | Agios Bible',
  description:"ادرس الكتاب في خطط موضوعية وسنوية تساعدك على فهمه والنمو في ايمانك",
  keywords: ['Agios Bible, Agios ,Bible,البحث الكتابي, البحث الإنجيلي, قراءة الكتاب المقدس, الكتاب المقدس, خطط قراءة الإنجيل , دراسة الكتاب Full Bible, الإنجيل, الآيات'],
  openGraph: {
  title: ' خطط دراسة الكتاب | Agios Bible',
        description:"ادرس الكتاب في خطط موضوعية وسنوية تساعدك على فهمه والنمو في ايمانك",
    type: 'website',
    url: 'https://agios-bible.vercel.app/studyPlans',
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