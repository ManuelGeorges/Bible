'use client';

import styles from './contact.module.css';
import Link from 'next/link';
import { Browser } from '@capacitor/browser';

export default function ContactPage() {
  const handleExternalLink = async (e, url) => {
    if (typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      e.preventDefault();
      try {
        await Browser.open({ url });
      } catch (error) {
        console.error("Could not open browser", error);
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>تواصل معنا</h1>
        <p className={styles.tagline}>يسعدنا سماع آرائكم واقتراحاتكم لتطوير الخدمة</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>لماذا قد تحتاج للتواصل معنا؟</h2>
        <ul className={styles.reasonList}>
          <li>المشاركة باقتراحات لتطوير خصائص التطبيق.</li>
          <li>الإبلاغ عن مشكلة تقنية أو خطأ في النصوص.</li>
          <li>تقديم الدعم الفني أو التطوع في تحسين المحتوى.</li>
          <li>الاستفسارات العامة حول خدمات Agios.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>طرق التواصل الرسمية</h2>
        <div className={styles.contactMethods}>
          <Link href="mailto:agios.system@gmail.com" className={styles.contactLink}>
            إرسال بريد إلكتروني
          </Link>
          <Link
            href="https://www.facebook.com/AgiosSystem/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.contactLink}
            onClick={(e) => handleExternalLink(e, "https://www.facebook.com/AgiosSystem/")}
          >
            صفحة الفيسبوك
          </Link>
        </div>
      </section>

      <footer className={styles.contactFooter}>
        <p>نعمل على الرد على جميع الاستفسارات في أقرب وقت ممكن.</p>
      </footer>
    </div>
  );
}
