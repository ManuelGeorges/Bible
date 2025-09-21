import styles from './contact.module.css';
import Link from 'next/link';

export const metadata = {
  title: 'تواصل معنا - Agios Bible',
  description: 'تواصل معنا للدعم الفني، الاقتراحات، الشكاوى، أو التطوع.',
};

export default function ContactPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>تواصل معنا</h1>
      <section className={styles.section}>
        <h2 className={styles.subtitle}>لماذا قد تحتاج للتواصل معنا؟</h2>
        <ul className={styles.reasonList}>
          <li>الدعم الفني</li>
          <li>الاقتراحات والآراء</li>
          <li>الشكاوى والمشكلات</li>
          <li>التطوع والمساهمة</li>
        </ul>
      </section>
      <section className={styles.section}>
        <h2 className={styles.subtitle}>طرق التواصل</h2>
        <div className={styles.contactMethods}>
          <Link href="tel:+201500082010" className={styles.contactLink}>
            الاتصال الهاتفي
          </Link>
          <Link href="mailto:manuel.georges2009@gmail.com" className={styles.contactLink}>
            البريد الإلكتروني
          </Link>
        </div>
      </section>
    </div>
  );
}