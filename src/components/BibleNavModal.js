"use client";

import React, { useState, useEffect } from 'react';
import styles from './Bible.module.css';
import { ChevronRight, Search } from 'lucide-react';

export default function BibleNavModal({ 
  isOpen, 
  onClose, 
  bookNamesData, 
  bibleData,
  selectedBookIndex, 
  selectedChapterIndex,
  onSelectLocation 
}) {
  const [step, setStep] = useState('books'); 
  const [tempSelectedBook, setTempSelectedBook] = useState(selectedBookIndex);
  const [activeTab, setActiveTab] = useState(selectedBookIndex < 39 ? 'OT' : 'NT');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('books');
      setTempSelectedBook(selectedBookIndex);
      setSearchQuery('');
      setActiveTab(selectedBookIndex < 39 ? 'OT' : 'NT');
    }
  }, [isOpen, selectedBookIndex]);

  if (!isOpen) return null;

  const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d]).join('');
  };

  const filteredBooks = bookNamesData
    .map((b, i) => ({ ...b, originalIndex: i }))
    .filter(b => b.testament === activeTab && (b.name.includes(searchQuery) || searchQuery === ''));

  const chaptersCount = bibleData[tempSelectedBook]?.chapters?.length || 0;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.booksSelectorModal} onClick={e => e.stopPropagation()}>
        
        <div className={styles.stickyHeader}>
          <div className={styles.navModalHeader}>
            <h3 className={styles.navModalTitle}>
              {step === 'books' ? 'اختر السفر' : 'اختر الإصحاح'}
            </h3>
            {step === 'chapters' && (
              <button className={styles.backBtn} onClick={() => setStep('books')}>
                <ChevronRight size={18} /> السفر
              </button>
            )}
          </div>

          <div className={styles.topNavTabs}>
            <button 
              className={`${styles.tabBtn} ${step === 'books' ? styles.activeTabHighlight : ''}`}
              onClick={() => setStep('books')}
            >
              {bookNamesData[tempSelectedBook]?.name || 'السفر'}
            </button>
            <button 
              className={`${styles.tabBtn} ${step === 'chapters' ? styles.activeTabHighlight : ''}`}
              disabled={step === 'books' && !tempSelectedBook && tempSelectedBook !== 0}
              onClick={() => setStep('chapters')}
            >
              إصحاح {convertToArabicNumber((selectedChapterIndex || 0) + 1)}
            </button>
          </div>

          {step === 'books' && (
            <div className={styles.subHeaderControls}>
              <div className={styles.modalHeader}>
                <button
                  className={activeTab === 'OT' ? styles.activeTab : ''}
                  onClick={() => setActiveTab('OT')}
                >
                  العهد القديم
                </button>
                <button
                  className={activeTab === 'NT' ? styles.activeTab : ''}
                  onClick={() => setActiveTab('NT')}
                >
                  العهد الجديد
                </button>
              </div>
              <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.bookSearchInput}
                  placeholder="ابحث عن سفر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalContentArea}>
          {step === 'books' ? (
            <div className={styles.booksGrid}>
              {filteredBooks.map((book) => (
                <button 
                  key={book.originalIndex}
                  className={`${styles.bookGridItem} ${tempSelectedBook === book.originalIndex ? styles.selectedBook : ''}`}
                  onClick={() => {
                    setTempSelectedBook(book.originalIndex);
                    setStep('chapters');
                  }}
                >
                  {book.name}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.chaptersGrid}>
              {Array.from({ length: chaptersCount }).map((_, i) => (
                <button 
                  key={i}
                  className={`${styles.chapterGridItem} ${i === selectedChapterIndex && tempSelectedBook === selectedBookIndex ? styles.selectedChapter : ''}`}
                  onClick={() => {
                    onSelectLocation(tempSelectedBook, i);
                    onClose();
                  }}
                >
                  {convertToArabicNumber(i + 1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}