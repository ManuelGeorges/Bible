"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Bible.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import BibleNavModal from '../../components/BibleNavModal';
import { toast } from 'react-hot-toast';
import { Share2 } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;

const HIGHLIGHT_COLORS = [
  '#FFC107', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFECB3',
  '#F8BBD0', '#E1BEE7', '#CFD8DC'
];

function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d]).join('');
}

export default function BibleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [bibleData, setBibleData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookNamesData, setBookNamesData] = useState([]);
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [completedChapters, setCompletedChapters] = useState({});
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  
  const [isNavModalOpen, setIsNavModalOpen] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [copiedMessage, setCopiedMessage] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [versePerLine, setVersePerLine] = useState(false);
  
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [targetVerseKey, setTargetVerseKey] = useState(null);

  const lastTap = useRef(0);
  const tapCount = useRef(0);
  const longPressTimer = useRef(null);
  const isMoving = useRef(false);
  const isLongPressActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const getBookName = useCallback((i) => bookNamesData?.[i]?.name || '', [bookNamesData]);

  const saveLastRead = useCallback(async (bookIdx, chapIdx) => {
    if (!bookNamesData[bookIdx]) return;
    
    const lastReadData = {
      bookIndex: bookIdx,
      chapterIndex: chapIdx,
      bookName: bookNamesData[bookIdx].name,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('lastReadLocation', JSON.stringify(lastReadData));

    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      try {
        await updateDoc(userRef, { lastRead: lastReadData });
      } catch (e) {
        console.error(e);
      }
    }
  }, [user, bookNamesData]);

  useEffect(() => {
    if (!isLoading && bookNamesData.length > 0) {
      saveLastRead(selectedBookIndex, selectedChapterIndex);
    }
  }, [selectedBookIndex, selectedChapterIndex, isLoading, bookNamesData, saveLastRead]);

  useEffect(() => {
    const syncAppSettings = () => {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      const savedFontSize = localStorage.getItem('bibleFontSize') || '18';
      const savedLayout = localStorage.getItem('versePerLine') === 'true';
      
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
      document.documentElement.style.setProperty('--main-font-size', savedFontSize + 'px');
      setVersePerLine(savedLayout);
    };
    syncAppSettings();
    window.addEventListener('storage', syncAppSettings);
    return () => window.removeEventListener('storage', syncAppSettings);
  }, []);

  const updateUserPoints = async (amount, reason, type = 'general', isNegative = false) => {
    if (!user) return;
    const finalAmount = isNegative ? -amount : amount;
    const userRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        totalPoints: increment(finalAmount),
        pointsHistory: arrayUnion({
          type: type,
          points: finalAmount,
          reason: reason,
          timestamp: new Date().toISOString()
        })
      });
      if (!isNegative) toast.success(`${reason}: +${amount} نقطة ✨`);
    } catch (e) {
      console.error(e);
    }
  };

  const shareVerse = async (text, index) => {
    const chapterLabel = convertToArabicNumber(selectedChapterIndex + 1);
    const verseLabel = convertToArabicNumber(index + 1);
    const bookName = getBookName(selectedBookIndex);
    const rlm = "\u200F"; 
    const fullText = `${text} ${rlm}(${bookName} ${verseLabel}:${chapterLabel})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'آية من الكتاب المقدس',
          text: fullText,
          dialogTitle: 'مشاركة الآية عبر...',
        });
        updateUserPoints(15, "مشاركة آية", 'share');
      } 
      else if (navigator.share) {
        await navigator.share({
          title: 'آية من الكتاب المقدس',
          text: fullText
        });
        updateUserPoints(15, "مشاركة آية", 'share');
      } 
      else {
        copyVerse(text, index);
        toast.info("المشاركة غير مدعومة، تم نسخ النص بدلاً من ذلك");
      }
    } catch (err) {
      console.log('Share error', err);
    }
  };

  const saveToFirestore = useCallback(async (v, c) => {
    if (!user || !firestore) return;
    const userRef = doc(firestore, 'users', user.uid);
    await updateDoc(userRef, {
      "favorites.verses": v,
      "completedChapters": c
    });
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [namesRes, bibleRes] = await Promise.all([
          fetch('/data/bookNames.json').then(r => r.json()),
          fetch('/data/bibles/ar_svd.json').then(r => r.json())
        ]);
        
        const names = namesRes.ar || [];
        setBookNamesData(names);
        setBibleData(bibleRes);

        const bParam = searchParams.get('book');
        const cParam = searchParams.get('chapter');
        const savedLastRead = localStorage.getItem('lastReadLocation');

        if (bParam) {
          const idx = names.findIndex(b => b.name === decodeURIComponent(bParam));
          if (idx !== -1) setSelectedBookIndex(idx);
          if (cParam) setSelectedChapterIndex(Math.max(0, parseInt(cParam) - 1));
        } else if (savedLastRead) {
          const parsed = JSON.parse(savedLastRead);
          setSelectedBookIndex(parsed.bookIndex);
          setSelectedChapterIndex(parsed.chapterIndex);
        }
        setIsLoading(false);
      } catch (e) { setIsLoading(false); }
    };
    loadData();
  }, [searchParams]);

  useEffect(() => {
    if (auth) {
      const unsub = auth.onAuthStateChanged((u) => {
        setUser(u);
        if (u) {
          getDoc(doc(firestore, 'users', u.uid)).then(s => {
            if (s.exists()) {
              const data = s.data();
              setFavouriteVerses(data.favorites?.verses || {});
              setCompletedChapters(data.completedChapters || {});
              if (!searchParams.get('book') && data.lastRead) {
                setSelectedBookIndex(data.lastRead.bookIndex);
                setSelectedChapterIndex(data.lastRead.chapterIndex);
              }
            }
          });
        }
      });
      return unsub;
    }
  }, [searchParams]);

  const copyVerse = (text, index) => {
    const chapterLabel = convertToArabicNumber(selectedChapterIndex + 1);
    const verseLabel = convertToArabicNumber(index + 1);
    const rlm = "\u200F"; 
    const fullText = `${text} ${rlm}(${getBookName(selectedBookIndex)} ${verseLabel}:${chapterLabel})`;
    navigator.clipboard.writeText(fullText);
    setCopiedMessage('تم النسخ');
    setActiveMenu(null);
    updateUserPoints(5, "نسخ آية", 'search');
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const copySelected = () => {
    const chapterLabel = convertToArabicNumber(selectedChapterIndex + 1);
    const rlm = "\u200F";
    const lrm = "\u200E";
    const bookName = getBookName(selectedBookIndex);
    const sortedVerses = [...selectedVerses].sort((a, b) => a.index - b.index);
    const versesText = sortedVerses.map(sv => sv.text).join(' ');
    let verseRange = sortedVerses.length === 1 
      ? convertToArabicNumber(sortedVerses[0].index + 1)
      : `${convertToArabicNumber(sortedVerses[0].index + 1)} - ${convertToArabicNumber(sortedVerses[sortedVerses.length - 1].index + 1)}`;
    
    const fullText = `${versesText} ${rlm}(${bookName} ${chapterLabel}${lrm}:${rlm}${verseRange})`;
    navigator.clipboard.writeText(fullText);
    setCopiedMessage('تم النسخ بدقة ✨');
    updateUserPoints(15, "مشاركة مجموعة آيات", 'share');
    setSelectedVerses([]);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const highlightSelected = (color) => {
    if (!user) { router.push('/intro'); return; }
    setFavouriteVerses(prev => {
      const next = { ...prev };
      let newlyAddedCount = 0;
      selectedVerses.forEach(sv => {
        const key = `${selectedBookIndex}-${selectedChapterIndex}-${sv.index}`;
        if (color) {
          if (!next[key]) newlyAddedCount++;
          next[key] = { ...next[key], text: sv.text, book: getBookName(selectedBookIndex), ch: selectedChapterIndex, v: sv.index, color: color };
        } else { delete next[key]; }
      });
      if (newlyAddedCount > 0) updateUserPoints(newlyAddedCount * 5, "إضافة آية للمفضلة", 'favouriteVerse');
      saveToFirestore(next, completedChapters);
      return next;
    });
    setCopiedMessage(color ? 'تم التظليل ✨' : 'تم حذف التظليل 🗑️');
    setSelectedVerses([]);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const openNoteEditor = (key) => {
    if (!user) { router.push('/intro'); return; }
    setTargetVerseKey(key);
    setCurrentNoteText(favouriteVerses[key]?.note || '');
    setIsNoteModalOpen(true);
    setActiveMenu(null);
  };

  const saveNote = () => {
    setFavouriteVerses(prev => {
      const next = { ...prev };
      if (!next[targetVerseKey]) {
        const [b, c, v] = targetVerseKey.split('-');
        next[targetVerseKey] = { text: bibleData[b].chapters[c][v], book: getBookName(b), ch: parseInt(c), v: parseInt(v), color: '#FFC107' };
      }
      next[targetVerseKey].note = currentNoteText;
      saveToFirestore(next, completedChapters);
      return next;
    });
    setIsNoteModalOpen(false);
    updateUserPoints(5, "كتابة تأمل شخصي", 'favouriteVerse');
    setCopiedMessage('تم حفظ ملاحظتك 📝');
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const toggleVerseSelection = (v, i) => {
    setSelectedVerses(prev => {
      const exists = prev.find(item => item.index === i);
      if (exists) return prev.filter(item => item.index !== i);
      return [...prev, { text: v, index: i }];
    });
  };

  const handleTouchStart = (e, v, i) => {
    isMoving.current = false;
    isLongPressActive.current = false;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      if (!isMoving.current) {
        isLongPressActive.current = true;
        toggleVerseSelection(v, i);
        if (window.navigator.vibrate) window.navigator.vibrate(60);
      }
    }, 700);
  };

  const handleTouchMove = (e) => {
    const diffX = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const diffY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (diffX > 10 || diffY > 10) {
      isMoving.current = true;
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchEnd = (e, v, i) => {
    clearTimeout(longPressTimer.current);
    if (isLongPressActive.current || isMoving.current) return;
    const now = Date.now();
    if (now - lastTap.current < 350) {
      tapCount.current++;
    } else {
      tapCount.current = 1;
    }
    lastTap.current = now;
    if (tapCount.current === 2) {
      setTimeout(() => { if (tapCount.current === 2) copyVerse(v, i); }, 200);
    } else if (selectedVerses.length > 0) {
      toggleVerseSelection(v, i);
    }
  };

  if (isLoading || !bibleData || !bookNamesData.length) return <div className={styles.loading}>جاري التحميل...</div>;

  const chapters = bibleData[selectedBookIndex]?.chapters || [];
  const verses = chapters[selectedChapterIndex] || [];

  return (
    <div dir="rtl" className={styles.container}>
      {selectedVerses.length > 0 && (
        <div className={styles.selectionBar}>
          <div className={styles.selectionActions}>
            <button onClick={() => setSelectedVerses([])} className={styles.actionBtn}>✕</button>
            <button onClick={copySelected} className={styles.actionBtn}>📋</button>
            <button onClick={() => {
                const combinedText = selectedVerses.map(v => v.text).join(' ');
                shareVerse(combinedText, selectedVerses[0].index);
            }} className={styles.actionBtn}><Share2 size={20} /></button>
            <button onClick={() => openNoteEditor(`${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}`)} className={styles.actionBtn}>📝</button>
            <button onClick={() => highlightSelected(null)} className={styles.actionBtn} style={{color: '#ff4d4d'}}>🗑️</button>
          </div>
          <div className={styles.colorGrid}>
            {HIGHLIGHT_COLORS.map((color, idx) => (
              <span key={idx} className={styles.colorDot} style={{ backgroundColor: color }} onClick={() => highlightSelected(color)} />
            ))}
          </div>
        </div>
      )}

      <BibleNavModal 
        isOpen={isNavModalOpen}
        onClose={() => setIsNavModalOpen(false)}
        bookNamesData={bookNamesData}
        bibleData={bibleData}
        selectedBookIndex={selectedBookIndex}
        onSelectLocation={(bookIdx, chapterIdx) => {
          setSelectedBookIndex(bookIdx);
          setSelectedChapterIndex(chapterIdx);
          setSelectedVerses([]);
        }}
      />

      {isNoteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.noteModal}>
            <h3>أضف تأملك الشخصي</h3>
            <textarea value={currentNoteText} onChange={(e) => setCurrentNoteText(e.target.value)} placeholder="اكتب هنا ما لمسه قلبك في هذه الآية..." />
            <div className={styles.modalActions}>
              <button onClick={saveNote} className={styles.saveBtn}>حفظ</button>
              <button onClick={() => setIsNoteModalOpen(false)} className={styles.cancelBtn}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <h1 className={styles.title}>الكتاب المقدس</h1>
      
      <div className={styles.controls}>
        <div className={styles.navigationDisplay} onClick={() => setIsNavModalOpen(true)}>
          <span className={styles.navText}>{getBookName(selectedBookIndex)}</span>
          <span className={styles.navSeparator}>|</span>
          <span className={styles.navText}>{`إصحاح ${convertToArabicNumber(selectedChapterIndex + 1)}`}</span>
        </div>
      </div>

      {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}

      <AnimatePresence mode="wait">
        <motion.div 
          key={`${selectedBookIndex}-${selectedChapterIndex}`} 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} 
          className={styles.verseContainer}
          style={{ textAlign: 'justify', lineHeight: '2', padding: '15px' }}
        >
          <div className={styles.chapterHeader}>
            <h2 className={styles.chapterTitle}>{getBookName(selectedBookIndex)} {convertToArabicNumber(selectedChapterIndex + 1)}</h2>

          </div>
          
          <div className={versePerLine ? styles.versesList : styles.versesParagraph}>
            {verses.map((v, i) => {
              const key = `${selectedBookIndex}-${selectedChapterIndex}-${i}`;
              const annotation = favouriteVerses[key];
              const isSelected = selectedVerses.some(sv => sv.index === i);
              return (
                <span
                  key={i} id={`verse-${i}`}
                  className={`${styles.inlineVerse} ${isSelected ? styles.selectedVerse : ''} ${activeMenu === key ? styles.active : ''}`}
                  onTouchStart={(e) => handleTouchStart(e, v, i)} onTouchMove={handleTouchMove} onTouchEnd={(e) => handleTouchEnd(e, v, i)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => { 
                    if (window.matchMedia('(pointer: fine)').matches) {
                        toggleVerseSelection(v, i);
                    }
                  }}
                  style={{
                    backgroundColor: annotation?.color ? `${annotation.color}66` : 'transparent',
                    display: versePerLine ? 'block' : 'inline',
                    marginBottom: versePerLine ? '15px' : '0',
                    padding: '2px 4px', borderRadius: '4px', position: 'relative'
                  }}
                >
                  <span className={styles.styledVerseNumber}>{convertToArabicNumber(i + 1)}</span>
                  <span className={styles.verseText}>{v} </span>
                  {annotation?.note && <span className={styles.miniNoteIndicator} onClick={(e) => { e.stopPropagation(); openNoteEditor(key); }}> 📝 </span>}
                </span>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className={styles.navigation}>
        <button disabled={selectedChapterIndex === 0} onClick={() => { setSelectedChapterIndex(p => p - 1); setSelectedVerses([]); }}> « </button>
        <button onClick={() => {
          if (!user) { router.push('/intro'); return; }
          const key = `${selectedBookIndex}-${selectedChapterIndex}`;
          if (completedChapters[key]) {
            const next = { ...completedChapters, [key]: false };
            setCompletedChapters(next);
            saveToFirestore(favouriteVerses, next);
            updateUserPoints(20, `إلغاء قراءة إصحاح`, 'completedChapter', true);
            toast.error("تم إلغاء تحديد الإصحاح"); 
          } else {
            const next = { ...completedChapters, [key]: true };
            setCompletedChapters(next);
            saveToFirestore(favouriteVerses, next);
            updateUserPoints(20, `قراءة إصحاح كامل`, 'completedChapter');
          }
        }}>
          {completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? '✅' : '✔️'}
        </button>
        <button disabled={selectedChapterIndex === chapters.length - 1} onClick={() => { setSelectedChapterIndex(p => p + 1); setSelectedVerses([]); }}> » </button>
      </div>
    </div>
  );
}