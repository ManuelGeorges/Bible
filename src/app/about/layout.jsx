
PLACEHOLDER  description: 'Learn more about Agios Bible, the team, and the mission behind the app.',
  keywords: ['Agios Bible, Agios, Bible app, Christian resources, Bible study, About Agios Bible'],
  openGraph: {
    title: 'About | Agios Bible',
    description: 'Learn more about Agios Bible, the team, and the mission behind the app.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/about',
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