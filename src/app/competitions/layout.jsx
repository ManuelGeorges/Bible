
export const metadata = {
  title: 'Competitions | Agios Bible',
  description: 'Challenge your Bible knowledge with quizzes and scripture-based competitions.',
  keywords: ['Agios Bible, competitions, Bible quizzes, scripture challenges, Christian trivia'],
  openGraph: {
    title: 'Competitions | Agios Bible',
    description: 'Challenge your Bible knowledge with quizzes and scripture-based competitions.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/competitions',
    siteName: 'Agios Bible',
    locale: 'en_US',
  },
};

export default function MapsLayout({ children }) {
  return (
      <main>
        <div>{children}</div>
      </main>
  );
}