"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useRef, useState, Suspense, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { motion } from 'framer-motion'; 
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';
import { 
  Share2, Download, Loader2, Check, 
  Sparkles, Move, Type, Maximize2, AlignCenter, ArrowUpDown
} from 'lucide-react';
import styles from './SharePreview.module.css';

const TEMPLATES = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  url: `/templates/${i + 1}.webp`
}));

const FONTS = [
  { name: 'القاهرة', family: "'Cairo', sans-serif" },
  { name: 'الأميري', family: "'Amiri', serif" },
  { name: 'تجول', family: "'Tajawal', sans-serif" },
  { name: 'المسيري', family: "'El Messiri', sans-serif" },
  { name: 'لطيف', family: "'Lateef', cursive" }
];

const CACHE_KEY = 'agios_share_vFinal_prod_vfinal_v4';

function PreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateRef = useRef(null);
  const constraintsRef = useRef(null);

  const verse = searchParams.get('verse');
  const reference = searchParams.get('ref');

  // States
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [fontSize, setFontSize] = useState(32);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [containerWidth, setContainerWidth] = useState(85);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. تحميل الإعدادات من الكاش عند البداية
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        if (config.templateId) {
          const t = TEMPLATES.find(temp => temp.id === config.templateId);
          if (t) setSelectedTemplate(t);
        }
        if (config.fontSize) setFontSize(config.fontSize);
        if (config.fontName) {
          const f = FONTS.find(font => font.name === config.fontName);
          if (f) setSelectedFont(f);
        }
        if (config.containerWidth) setContainerWidth(config.containerWidth);
        if (config.lineHeight) setLineHeight(config.lineHeight);
      }
    } catch (e) {
      console.error("Cache load error:", e);
    }
    setIsInitialized(true);
  }, []);

  // 2. حفظ الإعدادات في الكاش عند أي تغيير
  useEffect(() => {
    if (!isInitialized) return;
    const config = {
      templateId: selectedTemplate.id,
      fontSize,
      fontName: selectedFont.name,
      containerWidth,
      lineHeight
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  }, [selectedTemplate, fontSize, selectedFont, containerWidth, lineHeight, isInitialized]);

  const handleAction = async (type) => {
    if (!templateRef.current) return;
    setIsProcessing(true);
    try {
      // إعدادات لضمان أعلى جودة ممكنة
      const dataUrl = await toPng(templateRef.current, {
        pixelRatio: 4,
        cacheBust: true,
        style: {
          transform: 'scale(1)',
        }
      });
      const fileName = `Agios-Verse-${Date.now()}.png`;
      const base64Data = dataUrl.split(',')[1];

      // استخدام منطق مشابه لـ BibleContent لضمان التوافق مع كل الأجهزة
      if (Capacitor.isNativePlatform()) {
        const cacheFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        if (type === 'share') {
          await Share.share({
            files: [cacheFile.uri],
            title: 'آية من تطبيق أجيوس',
            dialogTitle: 'مشاركة التصميم عبر...',
          });
          await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache });
        } else {
          // حفظ الصورة في المعرض بناءً على النظام
          const platform = Capacitor.getPlatform();
          if (platform === 'ios') {
            await Media.savePhoto({ path: cacheFile.uri, album: 'Agios Bible' });
          } else {
            await Filesystem.writeFile({
              path: `Pictures/${fileName}`,
              data: base64Data,
              directory: Directory.ExternalStorage,
              recursive: true
            });
          }
          await Toast.show({ text: 'تم حفظ الآية بنجاح ✨' });
        }
      } else {
        // الويب (Web/Electron)
        if (type === 'share' && navigator.share) {
          try {
            const blob = await fetch(dataUrl).then(res => res.blob());
            const file = new File([blob], fileName, { type: 'image/png' });
            await navigator.share({
              files: [file],
              title: 'آية من تطبيق أجيوس',
              text: `"${verse}" (${reference})`
            });
          } catch (err) {
            // في حالة خطأ الـ gesture أو عدم دعم الملفات، نقوم بالتحميل كبديل
            console.warn("Share failed, falling back to download:", err);
            const link = document.createElement('a');
            link.download = fileName; link.href = dataUrl; link.click();
          }
        } else {
          // التحميل العادي
          const link = document.createElement('a');
          link.download = fileName; link.href = dataUrl; link.click();
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء معالجة الطلب");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container} dir="rtl">
      {/* استيراد الخطوط */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700;900&family=El+Messiri:wght@400;700&family=Lateef&family=Tajawal:wght@400;700&display=swap');
      `}</style>

      <div className={styles.header}>
        <div className={styles.headerTitle}>
           <h1>استوديو التصميم</h1>
           <p>خصص الآية وحركها كما تشاء</p>
        </div>
      </div>

      <div className={styles.mainLayout}>
        {/* منطقة المعاينة */}
        <div className={styles.previewContainer} ref={constraintsRef}>
          <div
            ref={templateRef}
            className={styles.previewCard}
            style={{ backgroundImage: `url(${selectedTemplate.url})` }}
          >
            <div className={styles.cardOverlay}></div>
            
            {/* النص القابل للسحب - تم إيقاف المومنتوم (الزحلقة) */}
            <motion.div
              drag 
              dragConstraints={constraintsRef}
              dragElastic={0.05}
              dragMomentum={false}
              initial={{ x: 0, y: 0 }}
              className={styles.draggableArea}
              style={{ width: `${containerWidth}%` }}
            >
              <div className={styles.textContent} style={{ lineHeight: lineHeight }}>
                <p className={styles.verseText} style={{ fontSize: `${fontSize}px`, fontFamily: selectedFont.family }}>
                  {verse}
                </p>
                <p className={styles.refText} style={{ fontSize: `${Math.max(14, fontSize * 0.55)}px`, fontFamily: selectedFont.family }}>
                  {reference}
                </p>
              </div>
            </motion.div>

            {/* براند التطبيق - أسفل اليمين (أصغر وأكثر طرفية) */}
            <div className={styles.brandTag}>
               <Sparkles size={10} color="#38bdf8" />
               <span className={styles.brandName}>AGIOS BIBLE</span>
            </div>
          </div>
        </div>

        {/* لوحة التحكم */}
        <div className={styles.editorPanel}>
          <div className={styles.controlRow}>
            <label><Type size={18} /> نوع الخط</label>
            <div className={styles.fontScroll}>
              {FONTS.map(f => (
                <button 
                  key={f.name} 
                  className={`${styles.fontOption} ${selectedFont.name === f.name ? styles.activeFont : ''}`}
                  onClick={() => setSelectedFont(f)}
                  style={{ fontFamily: f.family }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlRow}>
            <label><Maximize2 size={18} /> حجم الخط: {fontSize}px</label>
            <input
              type="range"
              min="16"
              max="64"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>

          <div className={styles.controlRow}>
            <label><AlignCenter size={18} /> عرض الصندوق: {containerWidth}%</label>
            <input
              type="range"
              min="40"
              max="100"
              value={containerWidth}
              onChange={(e) => setContainerWidth(parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>

          <div className={styles.controlRow}>
            <label><ArrowUpDown size={18} /> تباعد الأسطر: {lineHeight}</label>
            <input
              type="range"
              min="1"
              max="2.5"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(parseFloat(e.target.value))}
              className={styles.slider}
            />
          </div>

          <div className={styles.controlRow}>
            <label><Move size={18} /> اختر الخلفية</label>
            <div className={styles.templatesGrid}>
              {TEMPLATES.map(t => (
                <div
                  key={t.id}
                  className={`${styles.thumb} ${selectedTemplate.id === t.id ? styles.activeThumb : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  <img src={t.url} alt="" />
                  {selectedTemplate.id === t.id && (
                    <div className={styles.activeCheck}>
                      <Check size={12} color="white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionFooter}>
        <button onClick={() => handleAction('share')} className={styles.shareBtn} disabled={isProcessing}>
          <Share2 size={20} /> مشاركة
        </button>
        <button onClick={() => handleAction('download')} className={styles.saveBtn} disabled={isProcessing}>
          {isProcessing ? <Loader2 className={styles.spin} /> : <Download size={20} />} حفظ الصورة
        </button>
      </div>
    </div>
  );
}

export default function SharePreviewPage() {
  return <Suspense fallback={null}><PreviewContent /></Suspense>;
}
