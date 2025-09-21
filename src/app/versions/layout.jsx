import { LanguageProvider } from './../context/LanguageContext';
export const metadata = {
  title: ' التحديثات| Agios Bible',
  description:"تحديثات موقع Agios Bible مع معلومات عنها لكي تطلع عليها وقتما شئت لمتابعة تاريخ الموقع",
  keywords: ['Agios Bible, Agios ,Bible,البحث الكتابي, البحث الإنجيلي, قراءة الكتاب المقدس, الكتاب المقدس, خطط قراءة الإنجيل , دراسة الكتاب Full Bible, الإنجيل, الآيات'],
  openGraph: {
title: ' التحديثات| Agios Bible',
  description:"تحديثات موقع Agios Bible مع معلومات عنها لكي تطلع عليها وقتما شئت لمتابعة تاريخ الموقع",
  keywords: ['Agios Bible, Agios ,Bible,البحث الكتابي, البحث الإنجيلي, قراءة الكتاب المقدس, الكتاب المقدس, خطط قراءة الإنجيل , دراسة الكتاب Full Bible, الإنجيل, الآيات'],
    type: 'website',
    url: 'https://agios-bible.vercel.app/versions',
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