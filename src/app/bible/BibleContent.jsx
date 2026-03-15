'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Bible.module.css';
import { useSearchParams } from 'next/navigation';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from '../../lib/firebase';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;

function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d]).join('');
}

export default function BibleContent() {
  const searchParams = useSearchParams();

  const [user, setUser] = useState(null);
  const [bibleData, setBibleData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookNamesData, setBookNamesData] = useState([]);
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [completedChapters, setCompletedChapters] = useState({});
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [isBookDropdownOpen, setIsBookDropdownOpen] = useState(false);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [copiedMessage, setCopiedMessage] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);

  const lastTap = useRef(0);
  const tapCount = useRef(0);
  const longPressTimer = useRef(null);
  const isMoving = useRef(false);
  const isLongPressActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const bookDropdownRef = useRef(null);
  const chapterDropdownRef = useRef(null);

  useEffect(() => {
    const syncAppSettings = () => {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      const savedFontSize = localStorage.getItem('bibleFontSize') || '18';
      
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
      document.documentElement.style.setProperty('--main-font-size', savedFontSize + 'px');
    };

    syncAppSettings();
    window.addEventListener('storage', syncAppSettings);
    return () => window.removeEventListener('storage', syncAppSettings);
  }, []);

  const getBookName = (i) => bookNamesData?.[i]?.name || '';

  const saveToFirestore = useCallback(async (v, c) => {
    if (!user || !firestore) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        "favorites.verses": v,
        "completedChapters": c
      });
    } catch (e) {
      try {
        await setDoc(doc(firestore, 'users', user.uid), {
          favorites: { verses: v },
          completedChapters: c
        }, { merge: true });
      } catch (err) {}
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bookDropdownRef.current && !bookDropdownRef.current.contains(event.target)) {
        setIsBookDropdownOpen(false);
      }
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target)) {
        setIsChapterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [namesRes, bibleRes] = await Promise.all([
          fetch('/data/bookNames.json').then(r => r.json()),
          fetch('/data/bibles/ar_svd.json').then(r => r.json())
        ]);
        const arBooks = namesRes.ar || [];
        setBookNamesData(arBooks);
        setBibleData(bibleRes);
        const bParam = searchParams.get('book');
        const cParam = searchParams.get('chapter');
        if (bParam && arBooks.length > 0) {
          const idx = arBooks.findIndex(b => b.name === decodeURIComponent(bParam));
          if (idx !== -1) setSelectedBookIndex(idx);
        }
        if (cParam) setSelectedChapterIndex(Math.max(0, parseInt(cParam) - 1));
        setIsLoading(false);
      } catch (e) { 
        setIsLoading(false); 
      }
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
              setFavouriteVerses(s.data().favorites?.verses || {});
              setCompletedChapters(s.data().completedChapters || {});
            }
          });
        }
      });
      return unsub;
    }
  }, []);

  const copyVerse = (text, index) => {
    const fullText = `${text} (${getBookName(selectedBookIndex)} ${selectedChapterIndex + 1}:${index + 1})`;
    navigator.clipboard.writeText(fullText);
    setCopiedMessage('تم النسخ');
    setActiveMenu(null);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const copyChapter = () => {
    const chapters = bibleData[selectedBookIndex]?.chapters || [];
    const verses = chapters[selectedChapterIndex] || [];
    const fullContent = verses.map((v, i) => `${i + 1}. ${v}`).join('\n') + `\n\n(${getBookName(selectedBookIndex)} ${selectedChapterIndex + 1})`;
    navigator.clipboard.writeText(fullContent);
    setCopiedMessage('تم نسخ الإصحاح كاملاً');
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const favoriteChapter = () => {
    const chapters = bibleData[selectedBookIndex]?.chapters || [];
    const versesInChapter = chapters[selectedChapterIndex] || [];
    setFavouriteVerses(prev => {
      const next = { ...prev };
      const keys = versesInChapter.map((_, i) => `${selectedBookIndex}-${selectedChapterIndex}-${i}`);
      const allExist = keys.every(k => next[k]);
      if (allExist) {
        keys.forEach(k => delete next[k]);
        setCopiedMessage('تم حذف الإصحاح من المفضلة');
      } else {
        versesInChapter.forEach((v, i) => {
          const key = `${selectedBookIndex}-${selectedChapterIndex}-${i}`;
          next[key] = { text: v, book: getBookName(selectedBookIndex), ch: selectedChapterIndex, v: i };
        });
        setCopiedMessage('تمت إضافة الإصحاح للمفضلة');
      }
      saveToFirestore(next, completedChapters);
      return next;
    });
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const toggleFav = (text, index) => {
    const key = `${selectedBookIndex}-${selectedChapterIndex}-${index}`;
    setFavouriteVerses(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { text, book: getBookName(selectedBookIndex), ch: selectedChapterIndex, v: index };
      }
      saveToFirestore(next, completedChapters);
      return next;
    });
    setActiveMenu(null);
    if (window.navigator.vibrate) window.navigator.vibrate([50]);
  };

  const copySelected = () => {
    const text = selectedVerses
      .sort((a, b) => a.index - b.index)
      .map(sv => `${sv.text} (${getBookName(selectedBookIndex)} ${selectedChapterIndex + 1}:${sv.index + 1})`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedMessage('تم نسخ الآيات المختارة');
    setSelectedVerses([]);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const favoriteSelected = () => {
    setFavouriteVerses(prev => {
      const next = { ...prev };
      selectedVerses.forEach(sv => {
        const key = `${selectedBookIndex}-${selectedChapterIndex}-${sv.index}`;
        next[key] = { text: sv.text, book: getBookName(selectedBookIndex), ch: selectedChapterIndex, v: sv.index };
      });
      saveToFirestore(next, completedChapters);
      return next;
    });
    setCopiedMessage('تمت الإضافة للمفضلة');
    setSelectedVerses([]);
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
    const timespan = now - lastTap.current;
    if (timespan < 350 && timespan > 0) {
      tapCount.current++;
    } else {
      tapCount.current = 1;
    }
    lastTap.current = now;
    if (tapCount.current === 2) {
      setTimeout(() => {
        if (tapCount.current === 2) copyVerse(v, i);
      }, 200);
    } else if (tapCount.current === 3) {
      toggleFav(v, i);
      tapCount.current = 0;
    } else if (selectedVerses.length > 0) {
      toggleVerseSelection(v, i);
    }
  };

  const handleVerseClick = (key, v, i) => {
    if (window.matchMedia('(pointer: fine)').matches && selectedVerses.length === 0) {
      setActiveMenu(activeMenu === key ? null : key);
    }
  };

  if (isLoading || !bibleData || !bookNamesData.length) return <div className={styles.loading}>جاري التحميل...</div>;

  const chapters = bibleData[selectedBookIndex]?.chapters || [];
  const verses = chapters[selectedChapterIndex] || [];

  return (
    <div dir="rtl" className={styles.container}>
      {selectedVerses.length > 0 && (
        <div className={styles.selectionBar}>
          <div className={styles.selectionInfo}>
            <span>{`تحديد ${convertToArabicNumber(selectedVerses.length)}`}</span>
          </div>
          <div className={styles.selectionActions}>
            <button onClick={copySelected} className={styles.actionBtn}>📋</button>
            <button onClick={favoriteSelected} className={styles.actionBtn}>❤️</button>
            <button onClick={() => setSelectedVerses([])} className={styles.actionBtn}>✕</button>
          </div>
        </div>
      )}

      <h1 className={styles.title}>الكتاب المقدس</h1>

      <div className={styles.controls}>
        <div className={styles.customSelectWrapper} ref={bookDropdownRef}>
          <div className={styles.selectTrigger} onClick={() => {
              setIsBookDropdownOpen(!isBookDropdownOpen);
              setIsChapterDropdownOpen(false);
          }}>
            {getBookName(selectedBookIndex)}
          </div>
          {isBookDropdownOpen && (
            <ul className={`${styles.dropdownMenu} ${styles.open}`}>
              {bookNamesData.map((b, i) => (
                <li key={i} className={styles.dropdownItem} onClick={() => { setSelectedBookIndex(i); setSelectedChapterIndex(0); setIsBookDropdownOpen(false); setSelectedVerses([]); }}>
                  {b.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.customSelectWrapper} ref={chapterDropdownRef}>
          <div className={styles.selectTrigger} onClick={() => {
              setIsChapterDropdownOpen(!isChapterDropdownOpen);
              setIsBookDropdownOpen(false);
          }}>
            {`إصحاح ${convertToArabicNumber(selectedChapterIndex + 1)}`}
          </div>
          {isChapterDropdownOpen && (
            <ul className={`${styles.dropdownMenu} ${styles.open}`}>
              {chapters.map((_, i) => (
                <li key={i} className={styles.dropdownItem} onClick={() => { setSelectedChapterIndex(i); setIsChapterDropdownOpen(false); setSelectedVerses([]); }}>
                  {`إصحاح ${convertToArabicNumber(i + 1)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}

      <div className={styles.verseContainer}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <button onClick={copyChapter} className={styles.actionBtn} style={{ fontSize: '1.1rem' }}>📋</button>
          <h2 className={styles.chapterTitle} style={{ margin: 0 }}>{getBookName(selectedBookIndex)} {convertToArabicNumber(selectedChapterIndex + 1)}</h2>
          <button onClick={favoriteChapter} className={styles.actionBtn} style={{ fontSize: '1.1rem' }}>❤️</button>
        </div>
        
        {verses.map((v, i) => {
          const key = `${selectedBookIndex}-${selectedChapterIndex}-${i}`;
          const isFav = favouriteVerses[key];
          const isSelected = selectedVerses.some(sv => sv.index === i);
          
          return (
            <div 
              key={i} 
              className={`${styles.singleVerse} ${isFav ? styles.favouriteHighlight : ''} ${isSelected ? styles.selectedVerse : ''} ${activeMenu === key ? styles.active : ''}`}
              onTouchStart={(e) => handleTouchStart(e, v, i)}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, v, i)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => handleVerseClick(key, v, i)}
              style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
            >
              <div className={styles.verseContent}>
                <span className={styles.verseNumber}>{convertToArabicNumber(i + 1)}</span>
                <span className={styles.verseText}>{v}</span>
              </div>

              {activeMenu === key && (
                <div className={styles.desktopMenu}>
                  <button onClick={(e) => { e.stopPropagation(); copyVerse(v, i); }}>📋</button>
                  <button onClick={(e) => { e.stopPropagation(); toggleFav(v, i); }}>{isFav ? '❤️' : '🤍'}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.navigation}>
        <button disabled={selectedChapterIndex === 0} onClick={() => {setSelectedChapterIndex(p => p - 1); setSelectedVerses([]);}}>«</button>
        <button onClick={() => {
           const key = `${selectedBookIndex}-${selectedChapterIndex}`;
           const next = { ...completedChapters, [key]: !completedChapters[key] };
           setCompletedChapters(next);
           saveToFirestore(favouriteVerses, next);
        }}>{completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? '✅' : '✔️'}</button>
        <button disabled={selectedChapterIndex === chapters.length - 1} onClick={() => {setSelectedChapterIndex(p => p + 1); setSelectedVerses([]);}}>»</button>
      </div>
    </div>
  );
}