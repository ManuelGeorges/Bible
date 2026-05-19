"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './Bible.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, Search, Book, Hash, X,
    Sun, Compass, Flame, MapPin, Scroll, Sword, Shield, Heart, Crown,
    Landmark, History, Hammer, Star, Anchor, Music, Lightbulb, Wind,
    Eye, Feather, Sparkles, Ghost, Mountain, Lamp, Users, Cross,
    MessageCircle, BookOpen
} from 'lucide-react';

const bookIconMap = {
    // Pentateuch
    "Gen": <Sun size={24} />,
    "Exo": <Compass size={24} />,
    "LEV": <Flame size={24} />,
    "NUM": <MapPin size={24} />,
    "DEU": <Scroll size={24} />,
    // History
    "JOS": <Sword size={24} />,
    "JDG": <Shield size={24} />,
    "RUT": <Heart size={24} />,
    "1SA": <Crown size={24} />,
    "2SA": <Crown size={24} />,
    "1KI": <Landmark size={24} />,
    "2KI": <Landmark size={24} />,
    "1CH": <History size={24} />,
    "2CH": <History size={24} />,
    "EZR": <Hammer size={24} />,
    "NEH": <Hammer size={24} />,
    "EST": <Star size={24} />,
    // Poetry
    "JOB": <Anchor size={24} />,
    "PSA": <Music size={24} />,
    "PRO": <Lightbulb size={24} />,
    "ECC": <Wind size={24} />,
    "SNG": <Heart size={24} />,
    // Prophets
    "ISA": <Eye size={24} />,
    "JER": <Feather size={24} />,
    "LAM": <Feather size={24} />,
    "EZK": <Sparkles size={24} />,
    "DAN": <Ghost size={24} />,
    "HOS": <Heart size={24} />,
    "JOL": <Flame size={24} />,
    "AMO": <Mountain size={24} />,
    "OBA": <Shield size={24} />,
    "JON": <Anchor size={24} />,
    "MIC": <Landmark size={24} />,
    "NAM": <Sword size={24} />,
    "HAB": <Lamp size={24} />,
    "ZEP": <Sun size={24} />,
    "HAG": <Hammer size={24} />,
    "ZEC": <Sparkles size={24} />,
    "MAL": <Star size={24} />,
    // NT
    "MAT": <Crown size={24} />,
    "MRK": <Cross size={24} />,
    "LUK": <Star size={24} />,
    "JHN": <Sparkles size={24} />,
    "ACT": <Users size={24} />,
    "ROM": <Scroll size={24} />,
    "1CO": <MessageCircle size={24} />,
    "2CO": <MessageCircle size={24} />,
    "GAL": <Feather size={24} />,
    "EPH": <Shield size={24} />,
    "PHP": <Heart size={24} />,
    "COL": <Anchor size={24} />,
    "1TH": <Wind size={24} />,
    "2TH": <Wind size={24} />,
    "1TI": <Landmark size={24} />,
    "2TI": <Landmark size={24} />,
    "TIT": <Hammer size={24} />,
    "PHM": <Feather size={24} />,
    "HEB": <Scroll size={24} />,
    "JAS": <Hammer size={24} />,
    "1PE": <Anchor size={24} />,
    "2PE": <Anchor size={24} />,
    "1JN": <Heart size={24} />,
    "2JN": <Heart size={24} />,
    "3JN": <Heart size={24} />,
    "JUD": <Shield size={24} />,
    "REV": <Eye size={24} />,
};

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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.modalOverlay} onClick={onClose}>
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 35, stiffness: 450, mass: 0.6 }}
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
              <AnimatePresence mode="wait">
                {step === 'books' ? (
                  <motion.div
                    key="books-grid"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
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
                        <span style={{ marginBottom: '6px' }}>{book.name}</span>
                        <div className={styles.bookIconWrapper}>
                          {bookIconMap[book.book_id] || (book.testament === 'OT' ? <Scroll size={24} /> : <BookOpen size={24} />)}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="chapters-grid"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
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
      )}
    </AnimatePresence>
  );
}
