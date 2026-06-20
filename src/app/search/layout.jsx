
export const metadata = {
  title: 'Bible Search | Agios Bible',
  description: 'Search Scripture using literal queries, morphological derivatives, and semantic matching.',
  keywords: ['Agios Bible, Bible search, scripture lookup, semantic search, search derivatives'],
  openGraph: {
    title: 'Bible Search | Agios Bible',
    description: 'Search Scripture using literal queries, morphological derivatives, and semantic matching.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/search',
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