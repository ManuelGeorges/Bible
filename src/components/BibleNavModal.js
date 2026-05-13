"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './Bible.module.css';
import { ChevronRight, Search, Book, Hash, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d] || d).join('');
  };

  const filteredBooks = useMemo(() => {
    return bookNamesData
      .map((b, i) => ({ ...b, originalIndex: i }))
      .filter(b => {
        const matchesTab = b.testament === activeTab;
        const matchesSearch = b.name.includes(searchQuery);
        return matchesTab && matchesSearch;
      });
  }, [bookNamesData, activeTab, searchQuery]);

  const chaptersCount = bibleData[tempSelectedBook]?.chapters?.length || 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.modalOverlay} onClick={onClose}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 400, mass: 0.8 }}
          className={styles.booksSelectorModal}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.stickyHeader}>
            <div className={styles.navModalHeader}>
              <h3 className={styles.navModalTitle}>
                {step === 'books' ? 'اختر السفر' : 'اختر الإصحاح'}
              </h3>
              <button className={styles.closeBtn} onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <div className={styles.topNavTabs}>
              <button
                className={`${styles.tabBtn} ${step === 'books' ? styles.activeTabHighlight : ''}`}
                onClick={() => setStep('books')}
              >
                <Book size={18} />
                <span>{bookNamesData[tempSelectedBook]?.name || 'السفر'}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${step === 'chapters' ? styles.activeTabHighlight : ''}`}
                disabled={!tempSelectedBook && tempSelectedBook !== 0}
                onClick={() => setStep('chapters')}
              >
                <Hash size={18} />
                <span>إصحاح {convertToArabicNumber((selectedChapterIndex || 0) + 1)}</span>
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

            {step === 'chapters' && (
              <div style={{ padding: '0 24px 15px' }}>
                <button className={styles.backBtn} onClick={() => setStep('books')}>
                  <ChevronRight size={18} />
                  الرجوع للأسفار
                </button>
              </div>
            )}
          </div>

          <div className={styles.modalContentArea}>
            <AnimatePresence mode="popLayout">
              {step === 'books' ? (
                <motion.div
                  key="books-grid"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className={styles.booksGrid}
                >
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
                </motion.div>
              ) : (
                <motion.div
                  key="chapters-grid"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={styles.chaptersGrid}
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
