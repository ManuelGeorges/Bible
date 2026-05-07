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
import { Share2, Copy, Check, MessageSquare, Volume2, Loader2, CircleCheck } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useBadge } from '../context/BadgeContext';
import { useAudio } from '../context/AudioContext';

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
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
}

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? 50 : direction < 0 ? -50 : 0,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({
    x: direction < 0 ? 50 : direction > 0 ? -50 : 0,
    opacity: 0,
  }),
};

export default function BibleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();

  // Audio Context integration
  const {
    playTrack, isPlaying, currentVerseId, setIsPanelOpen,
    audioUrl: globalAudioUrl, setTimestamps, setNavigationCallback,
    isAutoNext
  } = useAudio();

  const [user, setUser] = useState(null);
  const [bibleData, setBibleData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookNamesData, setBookNamesData] = useState([]);
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [completedChapters, setCompletedChapters] = useState({});
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const [isNavModalOpen, setIsNavModalOpen] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [copiedMessage, setCopiedMessage] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [versePerLine, setVersePerLine] = useState(false);
  
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [targetVerseKey, setTargetVerseKey] = useState(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const lastTap = useRef(0);
  const tapCount = useRef(0);
  const longPressTimer = useRef(null);
  const isMoving = useRef(false);
  const isLongPressActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const getBookName = useCallback((i) => bookNamesData?.[i]?.name || '', [bookNamesData]);

  const unlockBadge = async (badgeId) => {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentBadges = userSnap.data()?.badges || [];
      if (!currentBadges.includes(badgeId)) {
        await updateDoc(userRef, { badges: arrayUnion(badgeId) });
        triggerBadgeUnlock(badgeId);
      }
    } catch (e) { console.error(e); }
  };

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

  // Audio: Register navigation callback for Global Player
  useEffect(() => {
    const handleChapterNav = (dir) => {
        const chapters = bibleData?.[selectedBookIndex]?.chapters || [];
        const nextChapter = selectedChapterIndex + dir;

        if (nextChapter >= 0 && nextChapter < chapters.length) {
            setDirection(dir);
            setSelectedChapterIndex(nextChapter);
            return true;
        } else if (dir > 0 && selectedBookIndex < bookNamesData.length - 1) {
            setDirection(1);
            setSelectedBookIndex(prev => prev + 1);
            setSelectedChapterIndex(0);
            return true;
        } else if (dir < 0 && selectedBookIndex > 0) {
            setDirection(-1);
            setSelectedBookIndex(prev => prev - 1);
            const prevBookChapters = bibleData?.[selectedBookIndex - 1]?.chapters || [];
            setSelectedChapterIndex(Math.max(0, prevBookChapters.length - 1));
            return true;
        }
        return false;
    };

    setNavigationCallback(() => handleChapterNav);
    return () => setNavigationCallback(null);
  }, [bibleData, selectedBookIndex, selectedChapterIndex, bookNamesData, setNavigationCallback]);

  // Audio: Sync Highlight Scrolling
  useEffect(() => {
    if (currentVerseId !== -1) {
      const element = document.getElementById(`verse-${currentVerseId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentVerseId]);

  const fetchAudioData = useCallback(async (bookIdx, chapIdx) => {
    const book = bookNamesData[bookIdx];
    if (!book || !book.book_id || !bibleData) return;

    setIsAudioLoading(true);
    const chapter = chapIdx + 1;
    const audioFilesetId = book.type === 'new' ? 'ARZVDVN1DA' : 'ARZVDVO1DA';
    const timingFilesetId = book.type === 'new' ? 'ARZVDVN1DA' : 'ARZVDVO1DA';
    const key = '5e4b1535-5f2b-4f13-9032-9db0297664a6';

    const audioUrlRequest = `https://4.dbt.io/api/bibles/filesets/${audioFilesetId}/${book.book_id}/${chapter}?v=4&key=${key}`;
    const timestampUrl = `https://4.dbt.io/api/timestamps/${timingFilesetId}/${book.book_id}/${chapter}?v=4&key=${key}`;

    try {
      const [audioRes, timeRes] = await Promise.allSettled([
        fetch(audioUrlRequest),
        fetch(timestampUrl)
      ]);

      let url = null;
      let times = [];

      if (audioRes.status === 'fulfilled' && audioRes.value.ok) {
        const audioData = await audioRes.value.json();
        url = audioData.data?.[0]?.path;
      }

      if (timeRes.status === 'fulfilled' && timeRes.value.ok) {
        const timeData = await timeRes.value.json();
        times = timeData.data || (Array.isArray(timeData) ? timeData : []);
      }

      if (url) {
        const title = `عادل نصحي - ${book.name} ${convertToArabicNumber(chapter)}`;
        return { url, title, times };
      }
    } catch (error) {
      console.error("Fetch error", error);
    } finally {
      setIsAudioLoading(false);
    }
    return null;
  }, [bookNamesData, bibleData]);

  // Audio: Handle automatic audio update when chapter changes
  useEffect(() => {
    const syncAudio = async () => {
        if (!isLoading && bookNamesData.length > 0) {
            const book = bookNamesData[selectedBookIndex];
            const chapter = selectedChapterIndex + 1;

            const isCurrentlyPlayingThis = globalAudioUrl && globalAudioUrl.includes(`/${book.book_id}/${chapter}`);

            if (isCurrentlyPlayingThis) {
                const data = await fetchAudioData(selectedBookIndex, selectedChapterIndex);
                if (data) setTimestamps(data.times);
            } else if (isPlaying || isAutoNext) {
                const data = await fetchAudioData(selectedBookIndex, selectedChapterIndex);
                if (data) {
                    playTrack(data.url, data.title, data.times, selectedBookIndex, selectedChapterIndex);
                }
            }
        }
    };
    syncAudio();
  }, [selectedChapterIndex, selectedBookIndex, isLoading, bookNamesData, fetchAudioData, globalAudioUrl, isPlaying, isAutoNext, playTrack, setTimestamps]);

  const handleAudioButtonClick = async () => {
    if (isAudioLoading) return;

    const book = bookNamesData[selectedBookIndex];
    const chapter = selectedChapterIndex + 1;

    if (globalAudioUrl && globalAudioUrl.includes(`/${book.book_id}/${chapter}`)) {
      setIsPanelOpen(true);
    } else {
      const data = await fetchAudioData(selectedBookIndex, selectedChapterIndex);
      if (data) {
        playTrack(data.url, data.title, data.times, selectedBookIndex, selectedChapterIndex);
      } else {
        toast.error("الأوديو غير متوفر لهذا الإصحاح");
      }
    }
  };

  useEffect(() => {
    if (!isLoading && bookNamesData.length > 0) {
      saveLastRead(selectedBookIndex, selectedChapterIndex);

      if (selectedBookIndex === 0 && selectedChapterIndex === 0) {
        localStorage.setItem('read_alpha', Date.now());
      }
      if (selectedBookIndex === 65 && selectedChapterIndex === 21) {
        const alphaTime = localStorage.getItem('read_alpha');
        if (alphaTime && (Date.now() - parseInt(alphaTime)) < 60000) {
          unlockBadge('alpha_omega');
        }
      }
    }
  }, [selectedBookIndex, selectedChapterIndex, isLoading, bookNamesData, saveLastRead]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then(battery => {
        if (battery.level <= 0.05) unlockBadge('battery_saver');
      });
    }
  }, [selectedChapterIndex]);

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
      }
      else if (navigator.share) {
        await navigator.share({
          title: 'آية من الكتاب المقدس',
          text: fullText
        });
      }
      else {
        copyVerse(text, index);
        toast.info("المشاركة غير مدعومة، تم نسخ النص بدلاً من ذلك");
        return;
      }

      updateUserPoints(15, "مشاركة آية", 'share');
      unlockBadge('share_1');
      const userSnap = await getDoc(doc(firestore, 'users', user.uid));
      const shares = (userSnap.data()?.pointsHistory || []).filter(h => h.type === 'share').length;
      if (shares >= 50) unlockBadge('social_influencer');

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

    const firstVerseKey = selectedVerses.length > 0 ? `${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}` : null;
    const isAlreadyThisColor = firstVerseKey && favouriteVerses[firstVerseKey]?.color === color;
    const targetColor = isAlreadyThisColor ? null : color;

    setFavouriteVerses(prev => {
      const next = { ...prev };
      let newlyAddedCount = 0;
      selectedVerses.forEach(sv => {
        const key = `${selectedBookIndex}-${selectedChapterIndex}-${sv.index}`;
        if (targetColor) {
          if (!next[key]) newlyAddedCount++;
          next[key] = { ...next[key], text: sv.text, book: getBookName(selectedBookIndex), ch: selectedChapterIndex, v: sv.index, color: targetColor };
        } else { delete next[key]; }
      });
      if (newlyAddedCount > 0) {
        updateUserPoints(newlyAddedCount * 5, "إضافة آية للمفضلة", 'favouriteVerse');
        const count = Object.keys(next).length;
        if (count >= 1) unlockBadge('fav_1');
        if (count >= 20) unlockBadge('fav_20');
        if (count >= 100) unlockBadge('fav_100');
      }
      saveToFirestore(next, completedChapters);
      return next;
    });
    setCopiedMessage(targetColor ? 'تم التظليل ✨' : 'تم حذف التظليل 🗑️');
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
            <button onClick={copySelected} className={styles.actionBtn} title="نسخ"><Copy size={20} /></button>
            <button onClick={() => {
                const combinedText = selectedVerses.map(v => v.text).join(' ');
                shareVerse(combinedText, selectedVerses[0].index);
            }} className={styles.actionBtn}><Share2 size={20} /></button>
            <button onClick={() => openNoteEditor(`${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}`)} className={styles.actionBtn} title="ملاحظة"><MessageSquare size={20} /></button>
          </div>
          <div className={styles.colorGrid}>
            {HIGHLIGHT_COLORS.map((color, idx) => {
              const firstVerseKey = selectedVerses.length > 0 ? `${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}` : null;
              const isCurrentColor = firstVerseKey && favouriteVerses[firstVerseKey]?.color === color;
              return (
                <span
                  key={idx}
                  className={styles.colorDot}
                  style={{ backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => highlightSelected(color)}
                >
                  {isCurrentColor && <Check size={16} color="white" />}
                </span>
              );
            })}
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
          const isForward = (bookIdx > selectedBookIndex) || (bookIdx === selectedBookIndex && chapterIdx > selectedChapterIndex);
          setDirection(isForward ? 1 : -1);
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
        <button className={styles.navigationDisplay} onClick={() => setIsNavModalOpen(true)}>
          <span className={styles.navText}>{getBookName(selectedBookIndex)}</span>
          <span className={styles.navSeparator}>|</span>
          <span className={styles.navText}>{`إصحاح ${convertToArabicNumber(selectedChapterIndex + 1)}`}</span>
        </button>
      </div>

      {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div 
          key={`${selectedBookIndex}-${selectedChapterIndex}`}
          custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
          transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
          className={styles.verseContainer}
          style={{ textAlign: 'justify', lineHeight: '2', padding: '15px' }}
        >
          <div className={styles.chapterHeader}>
            <h2 className={styles.chapterTitle}>{getBookName(selectedBookIndex)} {convertToArabicNumber(selectedChapterIndex + 1)}</h2>
          </div>

          <div className={versePerLine ? styles.versesList : styles.versesParagraph}>
            {verses.map((v, i) => {
              const verseNumber = (i + 1).toString();
              const key = `${selectedBookIndex}-${selectedChapterIndex}-${i}`;
              const annotation = favouriteVerses[key];
              const isSelected = selectedVerses.some(sv => sv.index === i);
              const isReading = String(currentVerseId) === verseNumber;
              return (
                <span
                  key={i} id={`verse-${verseNumber}`}
                  className={`${styles.inlineVerse} ${isSelected ? styles.selectedVerse : ''} ${isReading ? styles.readingHighlight : ''} ${activeMenu === key ? styles.active : ''}`}
                  onTouchStart={(e) => handleTouchStart(e, v, i)} onTouchMove={handleTouchMove} onTouchEnd={(e) => handleTouchEnd(e, v, i)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
                        toggleVerseSelection(v, i);
                    }
                  }}
                  style={{
                    backgroundColor: isReading ? '#ffd54f' : (annotation?.color ? `${annotation.color}66` : 'transparent'),
                    display: versePerLine ? 'block' : 'inline',
                    marginBottom: versePerLine ? '15px' : '0',
                    padding: '2px 4px', borderRadius: '4px', position: 'relative',
                    transition: 'background-color 0.3s ease'
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
        <button disabled={selectedChapterIndex === 0} onClick={() => { setDirection(-1); setSelectedChapterIndex(p => p - 1); setSelectedVerses([]); }}> « </button>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button
            onClick={handleAudioButtonClick}
            disabled={isAudioLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isAudioLoading ? (
              <Loader2 size={28} className={styles.spinning} />
            ) : (
              <Volume2 size={28} color={isPlaying ? "#FFC107" : "var(--color-text-primary)"} />
            )}
          </button>

          <button onClick={async () => {
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

              const completedCount = Object.keys(next).filter(k => next[k]).length;
              if (completedCount >= 10) unlockBadge('reader_10');
              if (completedCount >= 50) unlockBadge('reader_50');
              if (completedCount >= 100) unlockBadge('reader_100');
              if (completedCount >= 250) unlockBadge('reader_250');
              if (completedCount >= 500) unlockBadge('reader_500');
              if (completedCount >= 594) unlockBadge('reader_594');
              if (completedCount >= 1189) unlockBadge('bible_finisher');

              const otChapters = bookNamesData.filter(b => b.type === 'old').reduce((sum, b) => sum + (b.chapters || 0), 0);
              const ntChapters = bookNamesData.filter(b => b.type === 'new').reduce((sum, b) => sum + (b.chapters || 0), 0);

              const otCompleted = Object.keys(next).filter(k => {
                const bookIdx = parseInt(k.split('-')[0]);
                return next[k] && bookNamesData[bookIdx]?.type === 'old';
              }).length;
              const ntCompleted = Object.keys(next).filter(k => {
                const bookIdx = parseInt(k.split('-')[0]);
                return next[k] && bookNamesData[bookIdx]?.type === 'new';
              }).length;

              if (otCompleted === otChapters && otChapters > 0) unlockBadge('testament_old');
              if (ntCompleted === ntChapters && ntChapters > 0) unlockBadge('testament_new');
            }
          }}>
            {completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? <CircleCheck size={28} color="#4CAF50" /> : <Check size={28} opacity={0.6} />}
          </button>
        </div>

        <button disabled={selectedChapterIndex === chapters.length - 1} onClick={() => { setDirection(1); setSelectedChapterIndex(p => p + 1); setSelectedVerses([]); }}> » </button>
      </div>
    </div>
  );
}
