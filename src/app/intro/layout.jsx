
export const metadata = {
  title: 'Welcome | Agios Bible',
  description: 'Sign in or create a new account to unlock full app features and updates.',
  keywords: ['Agios Bible, welcome, login, signup, account, Bible app'],
  openGraph: {
    title: 'Welcome | Agios Bible',
    description: 'Sign in or create a new account to unlock full app features and updates.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/intro',
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