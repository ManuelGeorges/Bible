import { LanguageProvider } from './../context/LanguageContext';

export const metadata = {
  title: '   سجل دخولك| Agios Bible',
  description:"سجل الدخول او انشئ حساباً جديداً لتحصل على مزايا لا حصر لها ويصل لك كل جديد",
  keywords: ['Agios Bible, Agios ,Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'سجل دخولك| Agios Bible',
       description:"سجل الدخول او انشئ حساباً جديداً لتحصل على مزايا لا حصر لها ويصل لك كل جديد",

    type: 'website',
    url: 'https://agios-bible.vercel.app/intr',
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