
export const metadata = {
  title: ' من نحن | Agios Bible',
  description:"اعرف المزيد عن موقع Agios Bible وأهدافه والمطورين والإداريين القائمين عليه",
  keywords: ['Agios Bible, Agios , مسابقات الكتاب المقدس, أسئلة كتابية , أسئلة الإنجيل , مسابقات كتاب مقدس,Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'من نحن | Agios Bible',
     description:"اعرف المزيد عن موقع Agios Bible وأهدافه والمطورين والإداريين القائمين عليه",

    type: 'website',
    url: 'https://agios-bible.vercel.app/about',
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