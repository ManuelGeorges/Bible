'use client';

import React, { useState } from 'react';
import styles from './interpretations.module.css';

const ChapterCard = ({ chapter, interpretation }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // 1. تحويل العناوين الفرعية (مثل (1) أو (2) ) إلى <h4>
  let formattedInterpretation = interpretation
    // نبحث عن نمط الترقيم ونحوله إلى <h4>
    .replace(/\(\s*(\d+)\s*\) ([^:]+):/g, (match, number, title) => `<h4>(${number}) ${title}:</h4>`);
  
  // 2. تقسيم النص إلى فقرات (<p>) بناءً على وجود سطرين فارغين أو أكثر
  // هذا يساعد في تحسين قراءة النص الطويل
  formattedInterpretation = formattedInterpretation
    .split(/\n\s*\n/g) // التقسيم عند وجود سطر فارغ أو أكثر بين النصوص
    .map(p => {
        const trimmedP = p.trim();
        // تجاهل أي جزء فارغ تمامًا
        if (trimmedP === '') return '';
        
        // إذا كان الجزء الناتج هو <h4> بالفعل، نرجعه كما هو بدون <p>
        if (trimmedP.startsWith('<h4>')) {
            return trimmedP;
        }
        
        // غير ذلك، نلفه بوسم الفقرة <p>
        return `<p>${trimmedP}</p>`;
    })
    .join('');
  
  // 3. (اختياري) تنظيف المسافات الزائدة التي قد تنتج عن عملية المعالجة
  formattedInterpretation = formattedInterpretation.replace(/\s{2,}/g, ' ');


  return (
    <div className={styles.chapterCard}>
      <button
        className={styles.chapterHeader}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <h3 className={styles.chapterTitle}>
          الإصحاح رقم {chapter}
        </h3>
        <span className={styles.toggleIcon}>{isOpen ? '▲' : '▼'}</span>
      </button>
      <div
        className={`${styles.chapterContent} ${isOpen ? styles.open : ''}`}
        dangerouslySetInnerHTML={{ __html: formattedInterpretation }}
      >
      </div>
    </div>
  );
};

export default ChapterCard;