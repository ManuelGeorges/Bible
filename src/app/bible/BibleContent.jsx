"use client";

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import styles from './Bible.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Share2, Copy, MessageSquare, Volume2, Loader2, CircleCheck, Sparkles, Image as ImageIcon, ChevronDown, Settings, Check } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useBadge } from '../context/BadgeContext';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import studyPlansData from '../studyPlans/studyPlansData.json';
import { getCairoIsoString } from '../../lib/dateUtils';
import { StorageService, KEYS } from '../../lib/storage';

const firestore = db;
const allPlans = studyPlansData.plans;

const HIGHLIGHT_COLORS = [
  '#FFC107', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFECB3',
  '#F8BBD0', '#E1BEE7', '#CFD8DC'
];

const fontOptionsMap = {
  'Cairo': "'Cairo', sans-serif",
  'Amiri': "'Amiri', serif",
  'Almarai': "'Almarai', sans-serif",
  'Tajawal': "'Tajawal', sans-serif",
  'ReemKufi': "'Reem Kufi', sans-serif"
};

const variants = {
  enter: (direction) => ({ x: direction > 0 ? 30 : -30, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction < 0 ? 30 : -30, opacity: 0 }),
};

// --- مكون الآية فائق الأداء (يحدث فقط عند القراءة أو الاختيار) ---
const VerseItem = memo(({
  v, i, isReading, isSelected, annotation, versePerLine, formatNumber,
  onTouchStart, onTouchMove, onTouchEnd, onClick, onNoteClick
}) => {
  const vNum = i + 1;
  return (
    <span
      id={`verse-${vNum}`}
      className={`${styles.inlineVerse} ${isSelected ? styles.selectedVerse : ''} ${isReading ? styles.readingHighlight : ''}`}
      onTouchStart={(e) => onTouchStart(e, v, i)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => onClick(v, i)}
      style={{
        backgroundColor: isReading ? '#ffd54f' : (annotation?.color ? `${annotation.color}66` : 'transparent'),
        display: versePerLine ? 'block' : 'inline',
        marginBottom: versePerLine ? '15px' : '0',
        padding: '2px 4px', borderRadius: '4px', position: 'relative'
      }}
    >
      <span className={styles.styledVerseNumber}>{formatNumber(vNum)}</span>
      <span className={styles.verseText}>{v} </span>
      {annotation?.note && (
        <span className={styles.miniNoteIndicator} onClick={(e) => onNoteClick(e, i)}> 📝 </span>
      )}
    </span>
  );
});
VerseItem.displayName = 'VerseItem';

export default function BibleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();
  const { language, useTashkeel, strings, dir: pageDir, bookNames: bookNamesData, formatNumber } = useLanguage();

  const {
    playTrack, isPlaying, currentVerseId, setIsPanelOpen,
    audioUrl: globalAudioUrl, setNavigationCallback,
    isAutoNext, fetchAudioData: contextFetchAudio, isAudioLoading: contextAudioLoading
  } = useAudio();

  // --- Refs ---
  const bibleDataRef = useRef(null);
  const lastAudioSyncRef = useRef("");
  const longPressTimer = useRef(null);
  const isMoving = useRef(false);
  const isLongPressActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // --- State ---
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVerses, setCurrentVerses] = useState([]);
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [completedChapters, setCompletedChapters] = useState({});
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [copiedMessage, setCopiedMessage] = useState('');
  const [versePerLine, setVersePerLine] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [targetVerseKey, setTargetVerseKey] = useState(null);

  const getBookName = useCallback((i) => bookNamesData?.[i]?.name || '', [bookNamesData]);

  // --- Badges Logic ---
  const unlockBadge = useCallback(async (badgeId) => {
    const authUser = getAuth().currentUser;
    if (authUser) {
      try {
        const userRef = doc(firestore, 'users', authUser.uid);
        const userSnap = await getDoc(userRef);
        const currentBadges = userSnap.data()?.badges || [];
        if (!currentBadges.includes(badgeId)) {
          await updateDoc(userRef, { badges: arrayUnion(badgeId) });
          triggerBadgeUnlock(badgeId);
        }
      } catch (e) { console.error(e); }
    } else {
      const localBadges = await StorageService.get(KEYS.LOCAL_BADGES) || [];
      if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save(KEYS.LOCAL_BADGES, localBadges);
        triggerBadgeUnlock(badgeId);
      }
    }
  }, [triggerBadgeUnlock]);

  const saveLastRead = useCallback(async (bookIdx, chapIdx) => {
    if (!bookNamesData[bookIdx]) return;
    const lastReadData = {
      bookIndex: bookIdx, chapterIndex: chapIdx,
      bookName: bookNamesData[bookIdx].name,
      timestamp: getCairoIsoString()
    };
    localStorage.setItem('lastReadLocation', JSON.stringify(lastReadData));
    await StorageService.save(KEYS.LAST_READ, lastReadData);
    const authUser = getAuth().currentUser;
    if (authUser) {
      updateDoc(doc(firestore, 'users', authUser.uid), { lastRead: lastReadData }).catch(console.error);
    }

    // Alpha-Omega Badge Logic
    if (bookIdx === 0 && chapIdx === 0) localStorage.setItem('read_alpha', Date.now());
    if (bookIdx === 65 && chapIdx === 21) {
        const alphaTime = localStorage.getItem('read_alpha');
        if (alphaTime && (Date.now() - parseInt(alphaTime)) < 60000) unlockBadge('alpha_omega');
    }
  }, [bookNamesData, unlockBadge]);

  // --- Functions ---
  const buildReferenceText = useCallback((verseIndexes) => {
    const chapterLabel = formatNumber(selectedChapterIndex + 1);
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "", lrm = isArabic ? "\u200E" : "";
    const bookName = getBookName(selectedBookIndex);
    const sorted = (Array.isArray(verseIndexes) ? [...verseIndexes] : [verseIndexes]).sort((a, b) => a - b);
    const numbers = sorted.map(i => formatNumber(i + 1));
    let vRange = numbers.length === 1 ? numbers[0] : (sorted.every((v, idx) => idx === 0 || v === sorted[idx-1] + 1) ? `${numbers[0]} - ${numbers[numbers.length-1]}` : numbers.join(isArabic ? '، ' : ', '));
    return `${bookName} ${chapterLabel}${lrm}:${rlm}${vRange}`;
  }, [selectedChapterIndex, selectedBookIndex, getBookName, formatNumber, language]);

  const updateUserPoints = useCallback(async (amount, reason, type = 'general', isNegative = false) => {
    const authUser = getAuth().currentUser;
    const finalAmount = isNegative ? -amount : amount;
    if (authUser) {
        updateDoc(doc(firestore, 'users', authUser.uid), {
            totalPoints: increment(finalAmount),
            pointsHistory: arrayUnion({ type, points: finalAmount, reason, timestamp: getCairoIsoString() })
        }).catch(console.error);
    } else {
        if (!isNegative) {
            await StorageService.addPoints(amount);
            const history = await StorageService.get(KEYS.POINTS_HISTORY) || [];
            history.push({ type, points: finalAmount, reason, timestamp: getCairoIsoString() });
            await StorageService.save(KEYS.POINTS_HISTORY, history);
        }
    }
  }, []);

  const saveBibleData = useCallback(async (v, c) => {
    await StorageService.save(KEYS.FAVORITES, v);
    await StorageService.save(KEYS.COMPLETED_CHAPTERS, c);
    const authUser = getAuth().currentUser;
    if (authUser) {
      updateDoc(doc(firestore, 'users', authUser.uid), { "favorites.verses": v, "completedChapters": c }).catch(console.error);
    }
  }, []);

  // --- Interaction Callbacks ---
  const handleVerseClick = useCallback((v, i) => {
    setSelectedVerses(prev => {
      const exists = prev.find(item => item.index === i);
      if (exists) return prev.filter(item => item.index !== i);
      return [...prev, { text: v, index: i }];
    });
  }, []);

  const onTouchStart = useCallback((e, v, i) => {
    isMoving.current = false; isLongPressActive.current = false;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      if (!isMoving.current) {
        isLongPressActive.current = true;
        handleVerseClick(v, i);
        if (window.navigator.vibrate) window.navigator.vibrate(60);
      }
    }, 700);
  }, [handleVerseClick]);

  const onTouchMove = useCallback((e) => {
    if (Math.abs(e.touches[0].clientX - touchStartPos.current.x) > 10) isMoving.current = true;
  }, []);

  const onTouchEnd = useCallback(() => clearTimeout(longPressTimer.current), []);

  const onNoteClick = useCallback((e, i) => {
    e.stopPropagation();
    const key = `${selectedBookIndex}-${selectedChapterIndex}-${i}`;
    setTargetVerseKey(key);
    setCurrentNoteText(favouriteVerses[key]?.note || '');
    setIsNoteModalOpen(true);
  }, [selectedBookIndex, selectedChapterIndex, favouriteVerses]);

  // --- Data Loader (الطلقة) ---
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        let folder = language === 'ar' ? 'arabic' : language === 'en' ? 'English' : language === 'fr' ? 'French' : 'german';
        let fileName = "";
        if (language === 'ar') fileName = useTashkeel ? "ar_svd_tashkeel_site.json" : "ar_svd_no_tashkeel.json";
        else if (language === 'en') fileName = "en_web.json";
        else if (language === 'fr') fileName = "fr_segond.json";
        else if (language === 'de') fileName = "de_luther.json";

        const res = await fetch(`/data/translations/${folder}/${fileName}`);
        const data = await res.json();
        bibleDataRef.current = data;

        const bParam = searchParams.get('book');
        const cParam = searchParams.get('chapter');
        const saved = await StorageService.get(KEYS.LAST_READ);

        let bIdx = 0, cIdx = 0;
        if (bParam && bookNamesData.length) {
          const idx = bookNamesData.findIndex(b => b.name === decodeURIComponent(bParam));
          if (idx !== -1) { bIdx = idx; if (cParam) cIdx = Math.max(0, parseInt(cParam) - 1); }
        } else if (saved) { bIdx = saved.bookIndex; cIdx = saved.chapterIndex; }

        setSelectedBookIndex(bIdx);
        setSelectedChapterIndex(cIdx);
        setCurrentVerses(data[bIdx]?.chapters[cIdx] || []);
        saveLastRead(bIdx, cIdx);
        setIsLoading(false);
      } catch (e) { console.error(e); setIsLoading(false); }
    };
    if (bookNamesData.length) init();
  }, [language, useTashkeel, bookNamesData, searchParams, saveLastRead]);

  useEffect(() => {
    if (bibleDataRef.current) {
        setCurrentVerses(bibleDataRef.current[selectedBookIndex]?.chapters[selectedChapterIndex] || []);
        saveLastRead(selectedBookIndex, selectedChapterIndex);
    }
  }, [selectedBookIndex, selectedChapterIndex, saveLastRead]);

  // Navigation Logic
  useEffect(() => {
    const handleChapterNav = (dir) => {
        const chapters = bibleDataRef.current?.[selectedBookIndex]?.chapters || [];
        const nextChapter = selectedChapterIndex + dir;
        if (nextChapter >= 0 && nextChapter < chapters.length) {
            setDirection(dir); setSelectedChapterIndex(nextChapter);
            setSelectedVerses([]); window.scrollTo(0, 0); return true;
        } else if (dir > 0 && selectedBookIndex < bookNamesData.length - 1) {
            setDirection(1); setSelectedBookIndex(prev => prev + 1);
            setSelectedChapterIndex(0); setSelectedVerses([]);
            window.scrollTo(0, 0); return true;
        } else if (dir < 0 && selectedBookIndex > 0) {
            setDirection(-1); setSelectedBookIndex(prev => prev - 1);
            const prevBookChapters = bibleDataRef.current?.[selectedBookIndex - 1]?.chapters || [];
            setSelectedChapterIndex(Math.max(0, prevBookChapters.length - 1));
            setSelectedVerses([]); window.scrollTo(0, 0); return true;
        }
        return false;
    };
    setNavigationCallback(() => handleChapterNav);
    return () => setNavigationCallback(null);
  }, [selectedBookIndex, selectedChapterIndex, bookNamesData, setNavigationCallback]);

  // Audio Sync
  useEffect(() => {
    const syncAudio = async () => {
        if (isLoading || bookNamesData.length === 0) return;
        const supportedAudioLangs = ['ar', 'en', 'fr'];
        if (!supportedAudioLangs.includes(language)) return;
        const book = bookNamesData[selectedBookIndex];
        const chapter = selectedChapterIndex + 1;
        const currentLocKey = `${book.book_id}-${chapter}`;
        if (lastAudioSyncRef.current === currentLocKey) return;
        const isPlayingThis = globalAudioUrl && globalAudioUrl.includes(`/${book.book_id}/${chapter}`);
        if (isPlayingThis) { lastAudioSyncRef.current = currentLocKey; }
        else if (isPlaying || isAutoNext) {
            const data = await contextFetchAudio(selectedBookIndex, selectedChapterIndex);
            if (data) {
                lastAudioSyncRef.current = currentLocKey;
                playTrack(data.url, data.title, data.times, selectedBookIndex, selectedChapterIndex, false);
            }
        }
    };
    syncAudio();
  }, [selectedChapterIndex, selectedBookIndex, isLoading, bookNamesData, contextFetchAudio, globalAudioUrl, isPlaying, isAutoNext, playTrack, language]);

  // Battery Check Badge
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.getBattery) {
      navigator.getBattery().then(b => { if (b.level <= 0.05) unlockBadge('battery_saver'); });
    }
  }, [selectedChapterIndex, unlockBadge]);

  // User Settings Sync
  useEffect(() => {
    const syncAppSettings = () => {
      const savedTheme = localStorage.getItem('theme') || 'system';
      const savedFontSize = localStorage.getItem('bibleFontSize') || '18';
      const savedFontId = localStorage.getItem('bibleFontFamily') || 'Cairo';
      const savedFontWeight = localStorage.getItem('bibleFontWeight') || '400';
      const savedLayout = localStorage.getItem('versePerLine') === 'true';

      const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (!isDark) document.body.classList.add('light-theme'); else document.body.classList.remove('light-theme');

      document.documentElement.style.setProperty('--main-font-size', savedFontSize + 'px');
      document.documentElement.style.setProperty('--bible-font-family', fontOptionsMap[savedFontId] || fontOptionsMap['Cairo']);
      document.documentElement.style.setProperty('--bible-font-weight', savedFontWeight);
      setVersePerLine(savedLayout);
    };
    syncAppSettings();
    window.addEventListener('storage', syncAppSettings);
    return () => window.removeEventListener('storage', syncAppSettings);
  }, []);

  // Sync Data (Firestore/Local)
  useEffect(() => {
    const authUser = getAuth().currentUser;
    setUser(authUser);
    if (authUser) {
      getDoc(doc(firestore, 'users', authUser.uid)).then(s => {
        if (s.exists()) {
          const data = s.data();
          setFavouriteVerses(data.favorites?.verses || {});
          setCompletedChapters(data.completedChapters || {});
        }
      });
    } else {
      StorageService.getLocalStats().then(ls => setFavouriteVerses(ls.favorites || {}));
      StorageService.get(KEYS.COMPLETED_CHAPTERS).then(lc => setCompletedChapters(lc || {}));
    }
  }, []);

  // --- Feature Logic (Sharing, Points, Plans) ---

  const copySelected = () => {
    const sorted = [...selectedVerses].sort((a, b) => a.index - b.index);
    const text = sorted.map(sv => sv.text).join(' ');
    const range = sorted.map(s => s.index);
    const full = `${text} ${language === 'ar' ? "\u200F" : ""}(${buildReferenceText(range)})`;
    if (navigator.clipboard) navigator.clipboard.writeText(full);
    setCopiedMessage(strings.bible.toasts.copied_precise);
    updateUserPoints(15, strings.bible.reasons.share_verses, 'share');
    setSelectedVerses([]);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const highlightSelected = async (color) => {
    const next = { ...favouriteVerses };
    let newlyAdded = 0;
    const targetColor = (selectedVerses.length > 0 && favouriteVerses[`${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}`]?.color === color) ? null : color;

    selectedVerses.forEach(sv => {
      const key = `${selectedBookIndex}-${selectedChapterIndex}-${sv.index}`;
      if (targetColor) {
        if (!next[key]) newlyAdded++;
        next[key] = { text: sv.text, b: selectedBookIndex, c: selectedChapterIndex, book: getBookName(selectedBookIndex), ch: selectedChapterIndex, v: sv.index, color: targetColor, dateAdded: getCairoIsoString() };
      } else delete next[key];
    });

    setFavouriteVerses(next);
    if (newlyAdded > 0) {
      updateUserPoints(newlyAdded * 5, strings.bible.reasons.favourite, 'favouriteVerse');
      const count = Object.keys(next).length;
      if (count >= 1) unlockBadge('fav_1');
      if (count >= 20) unlockBadge('fav_20');
      if (count >= 100) unlockBadge('fav_100');
    }
    saveBibleData(next, completedChapters);
    setCopiedMessage(targetColor ? strings.bible.toasts.highlighted : strings.bible.toasts.highlight_removed);
    setSelectedVerses([]);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const shareVerse = async (text, verseIndexes) => {
    const reference = buildReferenceText(verseIndexes);
    const rlm = language === 'ar' ? "\u200F" : "";
    const fullText = `${text} ${rlm}(${reference})`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: strings.bible.share_title, text: fullText, dialogTitle: strings.bible.share_dialog });
      } else if (navigator.share) {
        await navigator.share({ title: strings.bible.share_title, text: fullText });
      } else {
        navigator.clipboard.writeText(fullText);
        toast.info(strings.bible.share_not_supported);
      }
      updateUserPoints(15, strings.bible.reasons.share_verse, 'share');
      unlockBadge('share_1');
    } catch (err) {}
  };

  const saveNote = async () => {
    const next = { ...favouriteVerses };
    if (!next[targetVerseKey]) {
      const [b, c, v] = targetVerseKey.split('-');
      next[targetVerseKey] = { text: currentVerses[v], b: parseInt(b), c: parseInt(c), book: getBookName(b), ch: parseInt(c), v: parseInt(v), color: '#FFC107', dateAdded: getCairoIsoString() };
    }
    next[targetVerseKey].note = currentNoteText;
    next[targetVerseKey].noteDate = getCairoIsoString();

    if (!user) {
        await StorageService.addNote({
            verseKey: targetVerseKey, text: currentNoteText, book: next[targetVerseKey].book,
            reference: `${next[targetVerseKey].book} ${next[targetVerseKey].v + 1}:${next[targetVerseKey].ch + 1}`
        });
    }

    setFavouriteVerses(next);
    saveBibleData(next, completedChapters);
    setIsNoteModalOpen(false);
    updateUserPoints(5, strings.bible.reasons.note, 'favouriteVerse');
    setCopiedMessage(strings.bible.toasts.note_saved);
    setTimeout(() => setCopiedMessage(''), 2000);
  };

  const checkDayReadingCompleted = useCallback((readings, allCompleted) => {
    if (!readings) return false;
    return readings.every(reading => {
      const parts = reading.trim().split(' ');
      const chaptersPart = parts.pop();
      const bookName = parts.join(' ');
      const bIdx = bookNamesData.findIndex(b => b.name === bookName);
      if (bIdx === -1) return false;
      let chs = chaptersPart.includes('-') ? (function(){ const [s, e] = chaptersPart.split('-').map(Number); let a=[]; for(let i=s;i<=e;i++) a.push(i); return a; })() : chaptersPart.split(',').map(Number);
      return chs.every(ch => allCompleted[`${bIdx}-${ch - 1}`]);
    });
  }, [bookNamesData]);

  const updateStudyPlanProgress = async (planId, planType, day, currentCompleted) => {
    const authUser = getAuth().currentUser;
    let planInfo = planType === 'custom' ? (authUser ? (await getDoc(doc(firestore, 'users', authUser.uid))).data().customPlans?.[planId] : (await StorageService.get(KEYS.CUSTOM_PLANS))[planId]) : allPlans.find(p => p.id === parseInt(planId));
    if (!planInfo) return;
    const dayReading = planInfo.readings?.find(r => r.day === parseInt(day))?.books;
    const isDone = checkDayReadingCompleted(dayReading, currentCompleted);
    const dayData = { isCompleted: isDone, dateCompleted: isDone ? getCairoIsoString() : null };

    if (authUser) {
      const userRef = doc(firestore, 'users', authUser.uid);
      const data = (await getDoc(userRef)).data();
      const field = planType === 'custom' ? `customPlans.${planId}` : `completedPlans.${planId}`;
      const planData = (planType === 'custom' ? data.customPlans?.[planId] : data.completedPlans?.[planId]) || { completedDays: {} };
      const newDays = { ...(planData.completedDays || {}), [day]: dayData };
      const total = planInfo.readings?.length || 0;
      const percent = total > 0 ? Math.round((Object.values(newDays).filter(d => d.isCompleted).length / total) * 100) : 0;
      updateDoc(userRef, { [`${field}.completedDays`]: newDays, [`${field}.completionPercentage`]: percent });
      if (isDone) { toast.success(strings.bible.toasts.plan_day_complete); if (percent === 100) unlockBadge(`plan_finish_${planId}`); }
    } else {
      const key = planType === 'custom' ? KEYS.CUSTOM_PLANS : KEYS.COMPLETED_PLANS;
      const all = await StorageService.get(key) || {};
      const planData = all[planId] || { ...planInfo, completedDays: {}, completionPercentage: 0 };
      const newDays = { ...planData.completedDays, [day]: dayData };
      const total = planInfo.readings?.length || 0;
      const percent = total > 0 ? Math.round((Object.values(newDays).filter(d => d.isCompleted).length / total) * 100) : 0;
      all[planId] = { ...planData, completedDays: newDays, completionPercentage: percent };
      StorageService.save(key, all);
      if (isDone) toast.success(strings.bible.toasts.plan_day_complete);
    }
  };

  const toggleChapterCompletion = async () => {
    const key = `${selectedBookIndex}-${selectedChapterIndex}`;
    const next = { ...completedChapters, [key]: !completedChapters[key] };
    setCompletedChapters(next);
    saveBibleData(favouriteVerses, next);
    updateUserPoints(20, next[key] ? strings.bible.reasons.complete_chapter : strings.bible.reasons.undo_chapter, 'completedChapter', !next[key]);

    const planId = searchParams.get('planId'), planType = searchParams.get('planType'), day = searchParams.get('day');
    if (planId && day) updateStudyPlanProgress(planId, planType, parseInt(day), next);

    if (next[key]) {
      const count = Object.keys(next).filter(k => next[k]).length;
      ['10','50','100','250','500','594'].forEach(c => { if(count >= parseInt(c)) unlockBadge(`reader_${c}`); });
      if(count >= 1189) unlockBadge('bible_finisher');

      const otTotal = bookNamesData.filter(b=>b.type==='old').reduce((s,b)=>s+(b.chapters||0),0);
      const ntTotal = bookNamesData.filter(b=>b.type==='new').reduce((s,b)=>s+(b.chapters||0),0);
      if(Object.keys(next).filter(k=>next[k] && bookNamesData[k.split('-')[0]]?.type==='old').length === otTotal) unlockBadge('testament_old');
      if(Object.keys(next).filter(k=>next[k] && bookNamesData[k.split('-')[0]]?.type==='new').length === ntTotal) unlockBadge('testament_new');
    }
  };

  // --- Rendering Helpers ---
  const selectedIndicesSet = useMemo(() => new Set(selectedVerses.map(sv => sv.index)), [selectedVerses]);
  const shortAskLabel = (strings.bible.ask_agios || '').split(/\s+/)[0] || "Ask";

  if (isLoading || !currentVerses.length) return <div className={styles.loading}><Loader2 className={styles.spinning} /></div>;

  return (
    <div dir={pageDir} className={`${styles.container} ${pageDir === 'rtl' ? styles.rtl : styles.ltr}`}>
      <AnimatePresence>
        {selectedVerses.length > 0 && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }} className={styles.selectionBar}>
            <div className={styles.selectionActions}>
              <button onClick={() => setSelectedVerses([])} className={styles.actionBtn}>✕</button>
              <button onClick={copySelected} className={styles.actionBtn} title={strings.bible.tooltips.copy}><Copy size={20} /></button>
              <button onClick={async () => {
                const combined = selectedVerses.sort((a,b)=>a.index-b.index).map(v=>v.text).join(' ');
                shareVerse(combined, selectedVerses.map(v=>v.index));
              }} className={styles.actionBtn}><Share2 size={20} /></button>
              {selectedVerses.length === 1 && (
                <button onClick={() => router.push(`/share-preview?verse=${encodeURIComponent(selectedVerses[0].text)}&ref=${encodeURIComponent(buildReferenceText([selectedVerses[0].index]))}`)} className={styles.actionBtn} title={strings.bible.tooltips.image_design}><ImageIcon size={20} /></button>
              )}
              <button onClick={() => openNoteEditor(`${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}`)} className={styles.actionBtn} title={strings.bible.tooltips.note}><MessageSquare size={20} /></button>
              <button onClick={() => router.push(`/bible/analysis/?book=${encodeURIComponent(getBookName(selectedBookIndex))}&chapter=${selectedChapterIndex + 1}&verses=${selectedVerses.map(v=>v.index+1).sort((a,b)=>a-b).join(',')}`)} className={styles.aiBtn} title={strings.bible.tooltips.ai_analysis}>
                <Sparkles size={20} /><span className={styles.aiBtnText}>{shortAskLabel}</span>
              </button>
            </div>
            <div className={styles.colorGrid}>
              {HIGHLIGHT_COLORS.map((c, i) => <span key={i} className={styles.colorDot} style={{ backgroundColor: c }} onClick={() => highlightSelected(c)} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isNoteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.noteModal}>
            <h3>{strings.bible.notes.title}</h3>
            <textarea value={currentNoteText} onChange={(e) => setCurrentNoteText(e.target.value)} />
            <div className={styles.modalActions}>
              <button onClick={saveNote} className={styles.saveBtn}>{strings.common.save}</button>
              <button onClick={() => setIsNoteModalOpen(false)} className={styles.cancelBtn}>{strings.common.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <button className={styles.navigationDisplay} onClick={() => router.push('/bible/books')}>
          <span className={styles.navText}>{getBookName(selectedBookIndex)} | {formatNumber(selectedChapterIndex + 1)}</span>
          <ChevronDown size={18} />
        </button>
      </div>

      {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`${selectedBookIndex}-${selectedChapterIndex}`}
          custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
          transition={{ duration: 0.15, ease: "linear" }}
          className={styles.verseContainer}
        >
          <div className={styles.chapterHeader}>
            <h2 className={styles.chapterTitle}>{getBookName(selectedBookIndex)} {formatNumber(selectedChapterIndex + 1)}</h2>
            <button
              className={styles.aiBtn}
              onClick={() => router.push(`/bible/analysis/?book=${encodeURIComponent(getBookName(selectedBookIndex))}&chapter=${selectedChapterIndex + 1}`)}
              title={strings.bible.tooltips.ai_analysis}
            >
              <Sparkles size={20} />
              <span className={styles.aiBtnText}>{strings.bible.ask_agios}</span>
            </button>
          </div>

          <div className={versePerLine ? styles.versesList : styles.versesParagraph}>
            {currentVerses.map((v, i) => {
              const key = `${selectedBookIndex}-${selectedChapterIndex}-${i}`;
              return (
                <VerseItem
                  key={key}
                  v={v} i={i}
                  isReading={Number(currentVerseId) === (i + 1)}
                  isSelected={selectedIndicesSet.has(i)}
                  annotation={favouriteVerses[key]}
                  versePerLine={versePerLine}
                  formatNumber={formatNumber}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  onClick={handleVerseClick}
                  onNoteClick={onNoteClick}
                />
              );
            })}
          </div>

          <div className={styles.completionWrapper}>
             <button className={`${styles.completionBtn} ${completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? styles.completed : ''}`} onClick={toggleChapterCompletion}>
                <span>{strings.bible.chapter_complete_btn}</span>
                <CircleCheck size={24} color={completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? "#4CAF50" : "#ccc"} />
             </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className={styles.navigation}>
        <button disabled={selectedChapterIndex === 0} onClick={() => { setDirection(-1); setSelectedChapterIndex(p => p - 1); setSelectedVerses([]); }}> « </button>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => router.push('/settings#text-settings')} title={strings.bible.tooltips.text_settings}><Settings size={28} /></button>
          {language !== 'de' && (
            <button onClick={async () => {
                const book = bookNamesData[selectedBookIndex], chapter = selectedChapterIndex + 1;
                if (globalAudioUrl && globalAudioUrl.includes(`/${book.book_id}/${chapter}`)) setIsPanelOpen(true);
                else {
                    const data = await contextFetchAudio(selectedBookIndex, selectedChapterIndex);
                    if (data) playTrack(data.url, data.title, data.times, selectedBookIndex, selectedChapterIndex, true);
                    else toast.error(strings.bible.toasts.audio_not_found);
                }
            }}>
              {contextAudioLoading ? <Loader2 size={28} className={styles.spinning} /> : <Volume2 size={28} color={isPlaying ? "#FFC107" : "currentColor"} />}
            </button>
          )}
        </div>
        <button disabled={selectedChapterIndex >= (bibleDataRef.current?.[selectedBookIndex]?.chapters.length - 1)} onClick={() => { setDirection(1); setSelectedChapterIndex(p => p + 1); setSelectedVerses([]); }}> » </button>
      </div>
    </div>
  );
}