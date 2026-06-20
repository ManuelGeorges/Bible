
export const metadata = {
  title: 'Maps | Agios Bible',
  description: 'Explore biblical locations with modern interactive maps.',
  keywords: ['Agios Bible, Bible maps, biblical locations, interactive maps, scripture geography'],
  openGraph: {
    title: 'Maps | Agios Bible',
    description: 'Explore biblical locations with modern interactive maps.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/maps',
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