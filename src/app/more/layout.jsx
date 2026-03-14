
export const metadata = {
  title: ' المزيد | Agios Bible',
  description:"الصفحة الجامعة التي تجمع كل الصفحات التقنية والإدارية التي ليس لها صلة بالمحتوى كالتواصل  ومعلومات التحديثات ومعلومات عننا",
  keywords: ['Agios Bible, Agios , مسابقات الكتاب المقدس, أسئلة كتابية , أسئلة الإنجيل , مسابقات كتاب مقدس,Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
   title: ' المزيد | Agios Bible',
  description:"الصفحة الجامعة التي تجمع كل الصفحات التقنية والإدارية التي ليس لها صلة بالمحتوى كالتواصل  ومعلومات التحديثات ومعلومات عننا",
  keywords: ['Agios Bible, Agios , مسابقات الكتاب المقدس, أسئلة كتابية , أسئلة الإنجيل , مسابقات كتاب مقدس,Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
    type: 'website',
    url: 'https://agios-bible.vercel.app/more',
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