'use client';

import React, { useState } from 'react';
import styles from './interpretations.module.css';
import { useLanguage } from '../context/LanguageContext';

const ChapterCard = ({ chapter, interpretation }) => {
  const { strings } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  let formattedInterpretation = interpretation
    .replace(/\(\s*(\d+)\s*\) ([^:]+):/g, (match, number, title) => `<h4>(${number}) ${title}:</h4>`);
  
  formattedInterpretation = formattedInterpretation
    .split(/\n\s*\n/g)
    .map(p => {
        const trimmedP = p.trim();
        if (trimmedP === '') return '';
        if (trimmedP.startsWith('<h4>')) {
            return trimmedP;
        }
        return `<p>${trimmedP}</p>`;
    })
    .join('');
  
  formattedInterpretation = formattedInterpretation.replace(/\s{2,}/g, ' ');


  return (
    <div className={styles.chapterCard}>
      <button
        className={styles.chapterHeader}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <h3 className={styles.chapterTitle}>
          {strings.interpretations.chapter_title.replace('{chapter}', chapter)}
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