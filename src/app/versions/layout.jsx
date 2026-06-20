export const metadata = {
  title: 'Updates | Agios Bible',
  description: 'Stay updated with the latest Agios Bible release notes and feature announcements.',
  keywords: ['Agios Bible, updates, release notes, new features, app changes'],
  openGraph: {
    title: 'Updates | Agios Bible',
    description: 'Stay updated with the latest Agios Bible release notes and feature announcements.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/versions',
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