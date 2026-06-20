
export const metadata = {
  title: 'More | Agios Bible',
  description: 'Explore additional resources and app sections like updates, about, and support.',
  keywords: ['Agios Bible, more, resources, updates, support, additional pages'],
  openGraph: {
    title: 'More | Agios Bible',
    description: 'Explore additional resources and app sections like updates, about, and support.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/more',
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