import { LanguageProvider } from './../context/LanguageContext';

export const metadata = {
  title: 'الخرائط الكتابية | Agios Bible',
  description: "استكشف الأماكن الكتابية بأسلوب جديد متطور عن طريق خرائط ثلاثية الأبعاد",
  keywords: ['Agios Bible, Agios ,Bible,خرائط الكتاب المقدس, Bible maps, الخرائط الكتابية, خرائط الإنجيل, الخرائط الإنجيلية, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'الخرائط الكتابية | Agios Bible',
    description: "استكشف الأماكن الكتابية بأسلوب جديد متطور عن طريق خرائط ثلاثية الأبعاد",
    type: 'website',
    url: 'https://agios-bible.vercel.app/maps',
    siteName: 'Agios Bible',
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