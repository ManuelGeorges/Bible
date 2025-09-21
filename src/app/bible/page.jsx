// src/app/bible/page.jsx

import { Suspense } from 'react';
import BibleContent from './BibleContent'; 
import styles from './Bible.module.css'; 
export const metadata = {
  title: 'الكتاب المقدس| Agios Bible',
  description: '  اقرأ الكتاب المقدس من واجهة سلسة مريحة للعين في القراءة مع خصائص عدة مثل نسخ الآيات ووضعها في المفضلة',
  keywords: ['Agios Bible, Agios , Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'Agios Bible',
    description: 'اقرأ الكتاب المقدس من واجهة سلسة مريحة للعين في القراءة مع خصائص عدة مثل نسخ الآيات ووضعها في المفضلة',
    type: 'website',
    url: 'https://agios-bible.vercel.app/bible',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
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