PLACEHOLDER  description: 'Explore guided Bible reading plans designed for daily, weekly, and thematic study.',
  keywords: ['Agios Bible, reading plans, Bible study plans, devotional plans, scripture reading'],
  openGraph: {
    title: 'Reading Plans | Agios Bible',
    description: 'Explore guided Bible reading plans designed for daily, weekly, and thematic study.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/studyPlans',
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