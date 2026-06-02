'use client';

import { useRouter } from 'next/navigation';
import { ImageIcon, Sparkles } from 'lucide-react';
import styles from './ShareVerseCard.module.css';

/**
 * ShareVerseCard - زر فخم يوجه المستخدم لصفحة التصميم المنفصلة
 */
const ShareVerseCard = ({ verse, reference }) => {
  const router = useRouter();

  const handleNavigateToDesign = () => {
    if (!verse || !reference) return;

    const params = new URLSearchParams({
      verse: verse,
      ref: reference
    });

    router.push(`/share-preview?${params.toString()}`);
  };

  return (
    <div className={styles.shareActionWrapper}>
      <button
        onClick={handleNavigateToDesign}
        className={styles.premiumDesignBtn}
      >
        <div className={styles.btnContent}>
          <div className={styles.iconBox}>
            <ImageIcon size={22} />
            <Sparkles size={12} className={styles.sparkleOverlay} />
          </div>
          <div className={styles.textBox}>
            <span className={styles.mainText}>تصميم ومشاركة كصورة</span>
            <span className={styles.subText}>أنشئ صورة لآية اليوم وشاركها</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default ShareVerseCard;
