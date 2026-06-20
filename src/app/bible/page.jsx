// src/app/bible/page.jsx

import { Suspense } from 'react';
import BibleContent from './BibleContent'; 
import styles from './Bible.module.css'; 
export const metadata = {
  description: 'Read the Bible with a clean interface featuring easy verse copying and bookmarking.',
  keywords: ['Agios Bible, Bible reading, scripture, favorite verses, Bible study'],
  openGraph: {
    title: 'Bible | Agios Bible',
    description: 'Read the Bible with a clean interface featuring easy verse copying and bookmarking.',
    type: 'website',
    url: 'https://agios-bible.vercel.app/bible',
    siteName: 'Agios Bible',
    locale: 'en_US',
  },
};
export default function BiblePage() {
  return (
    <main className={styles.container}>
      <Suspense fallback={<div className={styles.loadingMessage}>جارٍ تحميل المحتوى...</div>}>
        <BibleContent />
      </Suspense>
    </main>
  );
}