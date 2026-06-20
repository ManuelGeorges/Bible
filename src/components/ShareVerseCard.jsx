'use client';

import { useRouter } from 'next/navigation';
import { ImageIcon, Sparkles } from 'lucide-react';
import styles from './ShareVerseCard.module.css';
import { useLanguage } from '../app/context/LanguageContext';

/**
 * ShareVerseCard - زر فخم يوجه المستخدم لصفحة التصميم المنفصلة
 */
const ShareVerseCard = ({ verse, reference }) => {
  const router = useRouter();
  const { strings } = useLanguage();

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
            <span className={styles.mainText}>{strings.share_preview.title}</span>
            <span className={styles.subText}>{strings.share_preview.subtitle}</span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default ShareVerseCard;
