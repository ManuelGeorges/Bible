'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Share2, Download, Loader2 } from 'lucide-react';
import styles from './ShareVerseCard.module.css';

const ShareVerseCard = ({ verse, reference }) => {
  const templateRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const generateImage = async () => {
    if (!templateRef.current) return null;
    return await toPng(templateRef.current, { 
      cacheBust: true,
      pixelRatio: 3, // دقة عالية جداً للطباعة أو الشير
      style: { opacity: '1' } // التأكد إن العنصر مرئي أثناء التصوير
    });
  };

  const handleAction = async (type) => {
    setIsProcessing(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;

      if (type === 'share') {
        if (Capacitor.isNativePlatform()) {
          // مشاركة مباشرة من موبايل (Capacitor)
          await Share.share({
            title: 'آية اليوم',
            text: 'مشاركة من تطبيق أجيوس',
            url: dataUrl,
            dialogTitle: 'مشاركة كصورة',
          });
        } else if (navigator.share) {
          // مشاركة من متصفح يدعم الـ Web Share API (زي كروم موبايل)
          const blob = await fetch(dataUrl).then(res => res.blob());
          const file = new File([blob], 'verse.png', { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: 'آية اليوم',
          });
        } else {
          alert('المشاركة غير مدعومة في متصفحك، استخدم زر التحميل');
        }
      } else {
        // عملية التحميل (Download) للويب أو الموبايل كملف
        const link = document.createElement('a');
        link.download = `Agios-${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Operation failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* التيمبلت المخفي للتصوير */}
      <div className={styles.offscreen}>
        <div ref={templateRef} className={styles.cardTemplate}>
           <div className={styles.innerContent}>
             <h2 className={styles.appLogo}>AGIOS BIBLE</h2>
             <p className={styles.mainVerse}>"{verse}"</p>
             <p className={styles.mainRef}>{reference}</p>
           </div>
        </div>
      </div>

      {/* أزرار التحكم */}
      <div className={styles.actionGrid}>
        <button 
          onClick={() => handleAction('share')} 
          className={styles.actionBtn}
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className={styles.spin} /> : <Share2 size={18} />}
          <span>مشاركة الآية</span>
        </button>

        <button 
          onClick={() => handleAction('download')} 
          className={`${styles.actionBtn} ${styles.downloadBtn}`}
          disabled={isProcessing}
        >
          <Download size={18} />
          <span>حفظ الصورة</span>
        </button>
      </div>
    </div>
  );
};

export default ShareVerseCard;