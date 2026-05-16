'use client';

import { useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';
import { Share2, Download, Loader2 } from 'lucide-react';
import styles from './ShareVerseCard.module.css';

const ShareVerseCard = ({ verse, reference, onShareSuccess }) => {
  const templateRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const themeColors = {
    bg: isDarkMode ? 'linear-gradient(135deg, #020617 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f0f4f8 0%, #dbeafe 100%)',
    card: isDarkMode ? '#0f172a' : '#ffffff',
    text: isDarkMode ? '#ffffff' : '#0f172a',
    accent: isDarkMode ? '#38bdf8' : '#1e3a8a',
    secondary: isDarkMode ? '#cbd5e1' : '#475569',
    border: isDarkMode ? '#38bdf8' : '#1e3a8a'
  };

  const showToast = async (text) => {
    if (Capacitor.isNativePlatform()) {
      await Toast.show({ text, duration: 'short', position: 'bottom' });
    } else {
      console.log(text);
    }
  };

  const generateImage = async () => {
    if (!templateRef.current) return null;
    try {
      return await toPng(templateRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: false,
      });
    } catch (err) {
      console.error("Error generating image:", err);
      return null;
    }
  };

  const handleAction = async (type) => {
    setIsProcessing(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) throw new Error("Image generation failed");

      const fileName = `Agios-${Date.now()}.png`;
      const base64Data = dataUrl.split(',')[1];
      const platform = Capacitor.getPlatform();

      if (platform === 'electron' || platform === 'web') {
        if (type === 'share' && navigator.share) {
          const blob = await fetch(dataUrl).then(res => res.blob());
          const file = new File([blob], fileName, { type: 'image/png' });
          await navigator.share({ files: [file], title: 'آية اليوم' });
        } else {
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();
          await showToast('بدأ تحميل الصورة...');
        }
        if (onShareSuccess) onShareSuccess();
      } else {
        // حفظ مؤقت في الكاش للقيام بالعملية التالية
        const tempFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        if (type === 'share') {
          await Share.share({
            title: 'آية اليوم',
            files: [tempFile.uri],
            dialogTitle: 'مشاركة كصورة',
          });
          await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache });
        } else {
          // حفظ في المعرض (Gallery) لكل من iOS وأندرويد
          try {
            await Media.savePhoto({
              path: tempFile.uri,
              albumName: 'Agios Bible'
            });
            await showToast('تم حفظ الآية في المعرض بنجاح');
          } catch (mediaError) {
            console.error("Media save error:", mediaError);
            // حل بديل لو فشلت مكتبة Media (مثل نقص الصلاحيات)
            await showToast('تأكد من إعطاء التطبيق صلاحية الوصول للصور');
          }
          // تنظيف الملف المؤقت
          await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache }).catch(() => {});
        }
        if (onShareSuccess) onShareSuccess();
      }
    } catch (err) {
      console.error(err);
      await showToast('حدث خطأ أثناء معالجة الصورة');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.offscreen} aria-hidden="true">
        <div ref={templateRef} className={styles.cardTemplate} style={{ background: themeColors.bg }}>
           <div className={styles.innerContent} style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}>
             <div className={styles.header}><h2 className={styles.appLogo} style={{ color: themeColors.accent }}>AGIOS BIBLE</h2></div>
             <div className={styles.body}><p className={styles.mainVerse} style={{ color: themeColors.text }}>"{verse}"</p></div>
             <div className={styles.footer}><p className={styles.mainRef} style={{ color: themeColors.secondary }}>{reference}</p></div>
           </div>
        </div>
      </div>

      <div className={styles.actionGrid}>
        <button onClick={() => handleAction('share')} className={styles.actionBtn} disabled={isProcessing}>
          {isProcessing ? <Loader2 className={styles.spin} size={18} /> : <Share2 size={18} />}
          <span>مشاركة الآية</span>
        </button>
        <button onClick={() => handleAction('download')} className={`${styles.actionBtn} ${styles.downloadBtn}`} disabled={isProcessing}>
          {isProcessing ? <Loader2 className={styles.spin} size={18} /> : <Download size={18} />}
          <span>حفظ الصورة</span>
        </button>
      </div>
    </div>
  );
};

export default ShareVerseCard;
