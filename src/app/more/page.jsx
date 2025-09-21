import Link from 'next/link';
import styles from './more.module.css';



export default function MorePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>المزيد</h1>
      <div className={styles.buttonContainer}>
        <Link href="/about" className={styles.linkButton}>
          من نحن
        </Link>
        <Link href="/contact" className={styles.linkButton}>
          تواصل معنا
        </Link>
        <Link href="/versions" className={styles.linkButton}>
          معلومات التحديثات
        </Link>
      </div>
    </div>
  );
}