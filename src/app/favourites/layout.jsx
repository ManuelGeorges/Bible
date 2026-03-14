
export const metadata = {
  title: ' الآيات المفضلة | Agios Bible',
  description:"احفظ جميع آياتك المفضلة في مكان واحد للوصول السريع في أي وقت من أي جهاز",
  keywords: ['Agios Bible, Agios ,الآيات المفضلة , آياتي المفضلةBible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'الآيات المفضلة | Agios Bible',
     description:"احفظ جميع آياتك المفضلة في مكان واحد للوصول السريع في أي وقت من أي جهاز",

    type: 'website',
    url: 'https://agios-bible.vercel.app/favourites',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
  },
};

export default function MapsLayout({ children }) {
  return (
      <main>
        <div>{children}</div>
      </main>
  );
}