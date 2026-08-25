"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, memo, useMemo } from 'react';
import styles from './Bible.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc, onSnapshot, increment, arrayUnion, deleteField } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Share2, Copy, Check, MessageSquare, Volume2, Loader2, CircleCheck, Sparkles, Image as ImageIcon, ChevronDown, Settings, AlertTriangle } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useBadge } from '../context/BadgeContext';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import studyPlansData from '../studyPlans/studyPlansData.json';
import { getCairoIsoString } from '../../lib/dateUtils';

// Local-first imports
import { StorageService, KEYS } from '../../lib/storage';
import { languageManager } from '../../services/languageManager';

const firestore = db;
const allPlans = studyPlansData.plans;

const HIGHLIGHT_COLORS = [
  '#FFC107', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFECB3',
  '#F8BBD0', '#E1BEE7', '#CFD8DC'
];

// FIX #9: the "currently being read aloud" highlight now uses a color that isn't part of the
// user-selectable highlight palette above, so the two states are never visually confusable.
const READING_HIGHLIGHT_COLOR = '#64B5F6';

const fontOptionsMap = {
  'Cairo': "'Cairo', sans-serif",
  'Amiri': "'Amiri', serif",
  'Almarai': "'Almarai', sans-serif",
  'Tajawal': "'Tajawal', sans-serif",
  'ReemKufi': "'Reem Kufi', sans-serif"
};

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? 30 : direction < 0 ? -30 : 0,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({
    x: direction < 0 ? 30 : direction > 0 ? -30 : 0,
    opacity: 0,
  }),
};

// --- مكون الآية المحسن (السرعة) ---
const VerseItem = memo(({
  v, v2, i, verseNumber, isReading, isSelected, annotation, versePerLine, formatNumber,
  handleTouchStart, handleTouchMove, handleTouchEnd, onVerseClick, openNoteEditor, keyId, isParallel
}) => {
  const content = (
    <>
      <span className={styles.styledVerseNumber}>{formatNumber(i + 1)}</span>
      <span className={styles.verseText}>{v} </span>
      {annotation?.note && (
        <span
          className={styles.miniNoteIndicator}
          role="button"
          tabIndex={0}
          aria-label="Open note"
          onClick={(e) => { e.stopPropagation(); openNoteEditor(keyId); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openNoteEditor(keyId); }
          }}
        > 📝 </span>
      )}
    </>
  );

  // FIX #21/#22: verses are keyboard-focusable and screen-reader friendly (role, aria-pressed,
  // aria-label, Enter/Space activation) in addition to touch.
  const commonA11yProps = {
    role: 'button',
    tabIndex: 0,
    'aria-pressed': isSelected,
    'aria-label': `Verse ${verseNumber}${isSelected ? ', selected' : ''}`,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVerseClick(v, i); }
    }
  };

  // FIX #23: the reading/selection overlays now use a fixed alpha over both palettes rather than
  // relying purely on hue difference, improving contrast consistency between light/dark themes.
  if (isParallel && v2) {
    return (
      <div
        id={`verse-${verseNumber}`}
        className={`${styles.parallelVerseRow} ${isSelected ? styles.selectedVerse : ''} ${isReading ? styles.readingHighlight : ''}`}
        onTouchStart={(e) => handleTouchStart(e, v, i)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => onVerseClick(v, i)}
        style={{
           backgroundColor: isReading ? READING_HIGHLIGHT_COLOR : (annotation?.color ? `${annotation.color}44` : 'transparent'),
        }}
        {...commonA11yProps}
      >
        <div className={styles.verseSide} style={{ direction: 'rtl' }}>
          {content}
        </div>
        <div className={styles.verseSide} style={{ direction: 'ltr' }}>
           <span className={styles.verseTextParallel}>{v2}</span>
        </div>
      </div>
    );
  }

  return (
    <span
      id={`verse-${verseNumber}`}
      className={`${styles.inlineVerse} ${isSelected ? styles.selectedVerse : ''} ${isReading ? styles.readingHighlight : ''}`}
      onTouchStart={(e) => handleTouchStart(e, v, i)}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => handleTouchEnd(e, v, i)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => onVerseClick(v, i)}
      style={{
        backgroundColor: isReading ? READING_HIGHLIGHT_COLOR : (annotation?.color ? `${annotation.color}66` : 'transparent'),
        display: versePerLine ? 'block' : 'inline',
        marginBottom: versePerLine ? '15px' : '0',
        padding: '2px 4px', borderRadius: '4px', position: 'relative'
      }}
      {...commonA11yProps}
    >
      {content}
    </span>
  );
});
VerseItem.displayName = 'VerseItem';

export default function BibleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();
  const { language, useTashkeel, parallelLanguage, strings, dir: pageDir, bookNames: bookNamesData, allBookNames, formatNumber } = useLanguage();

  const {
    playTrack, isPlaying, currentVerseId, setIsPanelOpen,
    audioUrl: globalAudioUrl, setNavigationCallback,
    isAutoNext, fetchAudioData: contextFetchAudio, isAudioLoading: contextAudioLoading
  } = useAudio();

  // --- Refs & Optimized Storage ---
  const bibleDataRef = useRef(null);
  const bibleData2Ref = useRef(null);
  const lastAudioSyncRef = useRef("");
  const longPressTimer = useRef(null);
  const isMoving = useRef(false);
  const isLongPressActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const didInitPositionRef = useRef(false); // FIX #4/#25: run "resolve initial book/chapter" exactly once
  const dataTokenRef = useRef(0); // FIX #15: stale-response guard for bible json loads
  const snapUnsubRef = useRef(null); // cleanup for the Firestore realtime listener
  const pointsSyncTimerRef = useRef(null);
  const busyActionsRef = useRef(new Set()); // FIX #29: prevents duplicate-tap / double-fire on async actions

  // --- State ---
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // FIX #5: surfaced load errors instead of an infinite spinner
  const [reloadTrigger, setReloadTrigger] = useState(0); // bump to manually retry a failed load
  const [dataVersion, setDataVersion] = useState(0); // bumped whenever bible json (re)loads
  const [currentChapterVerses, setCurrentChapterVerses] = useState([]);
  const [currentChapterVerses2, setCurrentChapterVerses2] = useState([]);
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

  // FIX #29: generic lock so a rapid double-tap on an async action (highlight, complete chapter,
  // save note, copy, share...) can't fire twice / award points twice / trigger a badge twice.
  const withLock = useCallback((key, fn) => {
    return async (...args) => {
      if (busyActionsRef.current.has(key)) return;
      busyActionsRef.current.add(key);
      try {
        await fn(...args);
      } finally {
        busyActionsRef.current.delete(key);
      }
    };
  }, []);

  // --- Badges Logic (Local-First) ---
  const unlockBadge = useCallback(async (badgeId) => {
    // دائماً نحفظ محلياً أولاً
    const localBadges = await StorageService.get(KEYS.LOCAL_BADGES) || [];
    if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save(KEYS.LOCAL_BADGES, localBadges);
        triggerBadgeUnlock(badgeId);
    }
  }, [triggerBadgeUnlock]);

  const saveLastRead = useCallback(async (bookIdx, chapIdx) => {
    if (!bookNamesData[bookIdx]) return;
    const lastReadData = {
      bookIndex: bookIdx, chapterIndex: chapIdx,
      bookName: bookNamesData[bookIdx].name,
      timestamp: getCairoIsoString()
    };
    // FIX #20: StorageService is now the single source of truth for "last read" - dropped the
    // duplicate raw localStorage.setItem('lastReadLocation', ...) write that could drift from it.
    await StorageService.save(KEYS.LAST_READ, lastReadData);
    await StorageService.addToReadingHistory(lastReadData);

    // Alpha-Omega check
    if (bookIdx === 0 && chapIdx === 0) localStorage.setItem('read_alpha', Date.now());
    if (bookIdx === 65 && chapIdx === 21) {
      const alphaTime = localStorage.getItem('read_alpha');
      if (alphaTime && (Date.now() - parseInt(alphaTime)) < 60000) unlockBadge('alpha_omega');
    }
  }, [bookNamesData, unlockBadge]);

  // --- التمرير التلقائي للآية النشطة عند تشغيل الصوت ---
  useEffect(() => {
    if (currentVerseId && currentVerseId !== -1 && isPlaying) {
      const element = document.getElementById(`verse-${currentVerseId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentVerseId, isPlaying]);

  // FIX #4/#25: resolve the *initial* book/chapter (from URL params or last-read) exactly once,
  // instead of every time language/tashkeel/parallelLanguage/searchParams change. This is what
  // used to silently teleport the reader back to their last-read position whenever they toggled
  // an unrelated reading setting.
  useEffect(() => {
    if (didInitPositionRef.current) return;
    if (!bookNamesData.length) return;

    let cancelled = false;
    (async () => {
      const bParam = searchParams.get('book');
      const cParam = searchParams.get('chapter');
      const savedLastRead = await StorageService.get(KEYS.LAST_READ);
      if (cancelled) return;

      let bIdx = 0, cIdx = 0;
      if (bParam) {
        const idx = bookNamesData.findIndex(b => b.name === decodeURIComponent(bParam));
        if (idx !== -1) { bIdx = idx; if (cParam) cIdx = Math.max(0, parseInt(cParam) - 1); }
      } else if (savedLastRead) {
        bIdx = savedLastRead.bookIndex; cIdx = savedLastRead.chapterIndex;
      }

      setSelectedBookIndex(bIdx);
      setSelectedChapterIndex(cIdx);
      didInitPositionRef.current = true;
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookNamesData]);

  // FIX #5/#15/#25: loading the bible json is now independent of URL params and of the current
  // book/chapter — it only re-runs when the *language/format* actually changes. A token guards
  // against an older in-flight request overwriting state after a newer one already resolved, and
  // failures set a real error state (with a manual retry) instead of leaving an infinite spinner.
  useEffect(() => {
    if (!bookNamesData.length) return;
    const myToken = ++dataTokenRef.current;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const folderMap = { ar: 'arabic', en: 'English', de: 'german', fr: 'French' };

        const folder = folderMap[language] || 'arabic';
        let fileName = "";
        if (language === 'ar') fileName = useTashkeel ? "ar_svd_tashkeel_site.json" : "ar_svd_no_tashkeel.json";
        else if (language === 'en') fileName = "en_web.json";
        else if (language === 'fr') fileName = "fr_segond.json";
        else if (language === 'de') fileName = "de_luther.json";

        const data = await languageManager.getFile(folder, fileName);
        if (myToken !== dataTokenRef.current) return; // a newer load started; discard this result
        if (!data) throw new Error(`Bible data file not found for ${language}`);

        let parallelData = null;
        if (parallelLanguage) {
          const folder2 = folderMap[parallelLanguage] || 'arabic';
          let fileName2 = "";
          if (parallelLanguage === 'ar') fileName2 = "ar_svd_no_tashkeel.json";
          else if (parallelLanguage === 'en') fileName2 = "en_web.json";
          else if (parallelLanguage === 'fr') fileName2 = "fr_segond.json";
          else if (parallelLanguage === 'de') fileName2 = "de_luther.json";

          try {
            parallelData = await languageManager.getFile(folder2, fileName2);
          } catch (e) {
            console.error("Failed to load parallel bible:", e);
            parallelData = null;
          }
        }
        if (myToken !== dataTokenRef.current) return;

        bibleDataRef.current = data;
        bibleData2Ref.current = parallelData;
        setDataVersion(v => v + 1);
        setIsLoading(false);
      } catch (e) {
        console.error("Bible Content Load Error:", e);
        if (myToken === dataTokenRef.current) {
          setLoadError(e);
          setIsLoading(false);
        }
      }
    };

    loadData();
  }, [language, useTashkeel, parallelLanguage, bookNamesData, reloadTrigger]);

  // دالة لمزامنة الآيات بين اللغتين بناءً على الـ book_id وليس رقم السفر
  const syncVerses = useCallback((bIdx, cIdx, primaryData, parallelData) => {
    if (!primaryData || !primaryData[bIdx]) return;

    const primaryVerses = primaryData[bIdx].chapters[cIdx] || [];
    setCurrentChapterVerses(primaryVerses);

    if (parallelData && parallelLanguage) {
        const currentBookId = bookNamesData[bIdx]?.book_id;
        const parallelBookIndex = allBookNames[parallelLanguage]?.findIndex(b => b.book_id === currentBookId);

        if (parallelBookIndex !== -1 && parallelData[parallelBookIndex]) {
            setCurrentChapterVerses2(parallelData[parallelBookIndex].chapters[cIdx] || []);
        } else {
            setCurrentChapterVerses2([]);
        }
    } else {
        setCurrentChapterVerses2([]);
    }
  }, [bookNamesData, parallelLanguage, allBookNames]);

  // FIX #4: `dataVersion` in the deps means this re-syncs after a language/format reload even if
  // the book/chapter didn't change, without the position-reset side effect the old combined
  // effect had.
  useEffect(() => {
    if (bibleDataRef.current) {
      syncVerses(selectedBookIndex, selectedChapterIndex, bibleDataRef.current, bibleData2Ref.current);
      saveLastRead(selectedBookIndex, selectedChapterIndex);
    }
  }, [selectedBookIndex, selectedChapterIndex, dataVersion, saveLastRead, syncVerses]);

  // FIX #27: removed the "battery saver" badge check — it relied on navigator.getBattery(), which
  // is deprecated and removed in current versions of most browsers, so the badge was effectively
  // unreachable dead code.

  // Audio Sync logic (Updated: Exclude 'de')
  useEffect(() => {
    const syncAudio = async () => {
        if (isLoading || bookNamesData.length === 0) return;
        const supportedAudioLangs = ['ar', 'en', 'fr']; // Remove 'de'
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

  // FIX #2/#3/#28: single, shared chapter-navigation function used by BOTH the manual « / »
  // buttons AND the audio player's auto-advance/skip. This guarantees the visible chapter and the
  // playing chapter can never drift apart, and gives manual paging the same cross-book
  // wrap-around behavior the audio player already had.
  const navigateChapter = useCallback((dir) => {
    const data = bibleDataRef.current;
    if (!data) return null;

    let bIdx = selectedBookIndex;
    let cIdx = selectedChapterIndex + dir;
    const chaptersInBook = data[bIdx]?.chapters?.length || 0;

    if (cIdx < 0) {
      if (bIdx > 0) {
        bIdx -= 1;
        cIdx = (data[bIdx]?.chapters?.length || 1) - 1;
      } else {
        return null; // already at the very start of the Bible
      }
    } else if (cIdx >= chaptersInBook) {
      if (bIdx < bookNamesData.length - 1) {
        bIdx += 1;
        cIdx = 0;
      } else {
        return null; // already at the very end of the Bible
      }
    }

    setDirection(dir);
    setSelectedBookIndex(bIdx);
    setSelectedChapterIndex(cIdx);
    setSelectedVerses([]);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);

    return { bookIdx: bIdx, chapIdx: cIdx };
  }, [selectedBookIndex, selectedChapterIndex, bookNamesData]);

  useEffect(() => {
    setNavigationCallback(() => (dir) => navigateChapter(dir));
    return () => setNavigationCallback(null);
  }, [navigateChapter, setNavigationCallback]);

  const isAtVeryStart = selectedBookIndex === 0 && selectedChapterIndex === 0;
  const isAtVeryEnd = selectedBookIndex === bookNamesData.length - 1 &&
    selectedChapterIndex >= ((bibleDataRef.current?.[selectedBookIndex]?.chapters.length || 1) - 1);

  // FIX #26: apply theme/font settings in a layout effect (runs synchronously before paint)
  // rather than a regular effect, to reduce the flash of incorrectly-styled content on load.
  // FIX #19: also listens for a same-tab 'app-settings-changed' custom event (dispatched by the
  // settings screen) since the native 'storage' event only fires in *other* tabs, not this one.
  useLayoutEffect(() => {
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
    window.addEventListener('app-settings-changed', syncAppSettings);
    return () => {
      window.removeEventListener('storage', syncAppSettings);
      window.removeEventListener('app-settings-changed', syncAppSettings);
    };
  }, []);

  // FIX #17: replaced the one-shot getDoc() with a live onSnapshot() listener, so favorites /
  // completed chapters edited on another device show up here without a manual reload. Still keeps
  // the original "prefer local data if present" merge behavior (a fuller conflict-resolution
  // strategy would need per-field timestamps / a transaction, which is out of scope here).
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(getAuth(), async (authUser) => {
      setUser(authUser);

      if (snapUnsubRef.current) { snapUnsubRef.current(); snapUnsubRef.current = null; }

      const ls = await StorageService.getLocalStats();
      const lc = await StorageService.get(KEYS.COMPLETED_CHAPTERS) || {};
      const hasLocalFav = Object.keys(ls.favorites || {}).length > 0;
      const hasLocalCompleted = Object.keys(lc || {}).length > 0;

      if (!authUser) {
        setFavouriteVerses(ls.favorites || {});
        setCompletedChapters(lc || {});
        return;
      }

      if (hasLocalFav) setFavouriteVerses(ls.favorites);
      if (hasLocalCompleted) setCompletedChapters(lc);

      snapUnsubRef.current = onSnapshot(
        doc(firestore, 'users', authUser.uid),
        (snap) => {
          if (!snap.exists()) return;
          const fbData = snap.data();
          if (!hasLocalFav) setFavouriteVerses(fbData.favorites?.verses || {});
          if (!hasLocalCompleted) setCompletedChapters(fbData.completedChapters || {});
        },
        (err) => {
          console.error('Favorites/progress sync error', err); // FIX #6: surfaced instead of silent
          toast.error(strings?.bible?.toasts?.sync_error || 'Could not sync your saved data.');
        }
      );
    });
    return () => {
      unsubAuth();
      if (snapUnsubRef.current) snapUnsubRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---

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

  // FIX #18: points/history are now also synced (best-effort, debounced) to Firestore, since
  // previously only favorites/completedChapters persisted across devices/reinstalls and points
  // silently didn't.
  const updateUserPoints = useCallback(async (amount, reason, type = 'general', isNegative = false) => {
    const finalAmount = isNegative ? -amount : amount;
    await StorageService.addPoints(finalAmount);
    const history = await StorageService.get(KEYS.POINTS_HISTORY) || [];
    history.push({ type, points: finalAmount, reason, timestamp: getCairoIsoString() });
    await StorageService.save(KEYS.POINTS_HISTORY, history);

    if (user) {
      clearTimeout(pointsSyncTimerRef.current);
      pointsSyncTimerRef.current = setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), { points: increment(finalAmount) });
        } catch (e) {
          // Doc may not exist yet for a brand new user - fall back to creating it.
          try {
            await setDoc(doc(db, 'users', user.uid), { points: finalAmount }, { merge: true });
          } catch (e2) {
            console.error('Points sync failed', e2); // FIX #6: at least logged; non-critical so no toast spam
          }
        }
      }, 3000);
    }
  }, [user]);

  const saveBibleData = useCallback(async (v, c) => {
    await StorageService.save(KEYS.FAVORITES, v);
    await StorageService.save(KEYS.COMPLETED_CHAPTERS, c);
  }, []);

  const toggleVerseSelection = useCallback((v, i) => {
    setSelectedVerses(prev => {
      const exists = prev.find(item => item.index === i);
      if (exists) return prev.filter(item => item.index !== i);
      return [...prev, { text: v, index: i }];
    });
  }, []);

  // FIX #1: on touch devices, a `click` event still fires after `touchend` even after a long
  // press. Previously that click re-ran toggleVerseSelection and immediately un-selected the
  // verse the long-press had just selected + vibrated for. Calling preventDefault() on the
  // touchend when a long-press just fired suppresses that synthetic click entirely.
  const handleTouchStart = useCallback((e, v, i) => {
    isMoving.current = false; isLongPressActive.current = false;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      if (!isMoving.current) {
        isLongPressActive.current = true;
        toggleVerseSelection(v, i);
        if (window.navigator.vibrate) window.navigator.vibrate(60);
      }
    }, 700);
  }, [toggleVerseSelection]);

  const handleTouchMove = useCallback((e) => {
    if (Math.abs(e.touches[0].clientX - touchStartPos.current.x) > 10) isMoving.current = true;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressTimer.current);
    if (isLongPressActive.current) {
      e.preventDefault(); // swallow the ghost click that would otherwise immediately deselect
      isLongPressActive.current = false;
    }
  }, []);

  const openNoteEditor = useCallback((key) => {
    setTargetVerseKey(key);
    setCurrentNoteText(favouriteVerses[key]?.note || '');
    setIsNoteModalOpen(true);
  }, [favouriteVerses]);

  // FIX #6: clipboard writes are now awaited and errors are surfaced instead of always claiming
  // success.
  const copySelected = withLock('copySelected', async () => {
    const chapterLabel = formatNumber(selectedChapterIndex + 1);
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "", lrm = isArabic ? "\u200E" : "";
    const bookName = getBookName(selectedBookIndex);
    const sorted = [...selectedVerses].sort((a, b) => a.index - b.index);
    const versesText = sorted.map(sv => sv.text).join(' ');
    const isConsecutive = sorted.length > 1 && sorted.every((v, i) => i === 0 || v.index === sorted[i-1].index + 1);
    let verseRange;
    if (sorted.length === 1) verseRange = formatNumber(sorted[0].index + 1);
    else if (isConsecutive) verseRange = `${formatNumber(sorted[0].index + 1)} - ${formatNumber(sorted[sorted.length - 1].index + 1)}`;
    else verseRange = sorted.map(sv => formatNumber(sv.index + 1)).join(isArabic ? '، ' : ', ');
    const fullText = `${versesText} ${rlm}(${bookName} ${chapterLabel}${lrm}:${rlm}${verseRange})`;

    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(fullText);
      setCopiedMessage(strings.bible.toasts.copied_precise);
      await updateUserPoints(15, strings.bible.reasons.share_verses, 'share');
    } catch (e) {
      console.error('Copy failed', e);
      toast.error(strings?.bible?.toasts?.copy_failed || 'Could not copy to clipboard.');
    } finally {
      setSelectedVerses([]);
      setTimeout(() => setCopiedMessage(''), 2000);
    }
  });

  // FIX #12: highlight apply/remove is now decided against the *whole* selection's relationship
  // to the tapped color, not just selectedVerses[0]. If every selected verse already has this
  // exact color, tapping it again clears it from all of them; otherwise it's applied to all of
  // them - predictable even when the selection has mixed existing colors.
  const highlightSelected = withLock('highlight', async (color) => {
    if (selectedVerses.length === 0) return;

    const allAlreadyThisColor = selectedVerses.every(sv => {
      const key = `${selectedBookIndex}-${selectedChapterIndex}-${sv.index}`;
      return favouriteVerses[key]?.color === color;
    });
    const targetColor = allAlreadyThisColor ? null : color;

    const next = { ...favouriteVerses };
    let newlyAddedCount = 0;
    selectedVerses.forEach(sv => {
      const key = `${selectedBookIndex}-${selectedChapterIndex}-${sv.index}`;
      if (targetColor) {
        if (!next[key]) newlyAddedCount++;
        next[key] = {
          text: sv.text,
          book: getBookName(selectedBookIndex),
          ch: selectedChapterIndex,
          v: sv.index,
          book_index: selectedBookIndex,
          color: targetColor,
          dateAdded: getCairoIsoString(),
          synced: !!user
        };
      } else delete next[key];
    });
    setFavouriteVerses(next);
    if (newlyAddedCount > 0) {
      await updateUserPoints(newlyAddedCount * 5, strings.bible.reasons.favourite, 'favouriteVerse');
      const count = Object.keys(next).length;
      if (count >= 1) unlockBadge('fav_1');
      if (count >= 20) unlockBadge('fav_20');
      if (count >= 100) unlockBadge('fav_100');
    }

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { 'favorites.verses': next });
      } catch (e) {
        console.error("Firebase update failed", e);
        try {
          await setDoc(doc(db, 'users', user.uid), { favorites: { verses: next } }, { merge: true });
        } catch (e2) {
          console.error("Firebase fallback write failed", e2);
          toast.error(strings?.bible?.toasts?.sync_error || 'Highlight saved locally, but failed to sync.'); // FIX #6
        }
      }
    }

    await saveBibleData(next, completedChapters);
    setCopiedMessage(targetColor ? strings.bible.toasts.highlighted : strings.bible.toasts.highlight_removed);
    setSelectedVerses([]);
    setTimeout(() => setCopiedMessage(''), 2000);
  });

  const shareVerse = withLock('share', async (text, verseIndexes) => {
    const reference = buildReferenceText(verseIndexes);
    const rlm = language === 'ar' ? "\u200F" : "";
    const fullText = `${text} ${rlm}(${reference})`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: strings.bible.share_title, text: fullText, dialogTitle: strings.bible.share_dialog });
      } else if (navigator.share) {
        await navigator.share({ title: strings.bible.share_title, text: fullText });
      } else {
        if (Array.isArray(verseIndexes) && verseIndexes.length > 0) copyVerse(text, verseIndexes[0]); else copyVerse(text, verseIndexes);
        toast(strings.bible.share_not_supported);
        return;
      }
      await updateUserPoints(15, strings.bible.reasons.share_verse, 'share');
      unlockBadge('share_1');
    } catch (err) {
      // A user cancelling the native share sheet also lands here; don't show an error for that.
      if (err?.name !== 'AbortError') {
        console.error('Share failed', err); // FIX #6: was a completely silent catch {}
        toast.error(strings?.bible?.toasts?.share_failed || 'Could not share.');
      }
    }
  });

  const copyVerse = async (text, index) => {
    const chapterLabel = formatNumber(selectedChapterIndex + 1);
    const verseLabel = formatNumber(index + 1);
    const rlm = language === 'ar' ? "\u200F" : "", lrm = language === 'ar' ? "\u200E" : "";
    const fullText = `${text} ${rlm}(${getBookName(selectedBookIndex)} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(fullText);
      setCopiedMessage(strings.bible.toasts.copied);
      await updateUserPoints(5, strings.bible.reasons.copy_verse, 'search');
    } catch (e) {
      console.error('Copy failed', e);
      toast.error(strings?.bible?.toasts?.copy_failed || 'Could not copy to clipboard.');
    } finally {
      setTimeout(() => setCopiedMessage(''), 2000);
    }
  };

  // FIX #11: notes are only meaningful for a single verse's key. The button that opens this is
  // now disabled unless exactly one verse is selected (see render section), instead of silently
  // attaching a multi-verse selection's note to just the first verse.
  const saveNote = withLock('saveNote', async () => {
    const next = { ...favouriteVerses };
    if (!next[targetVerseKey]) {
      const [b, c, v] = targetVerseKey.split('-');
      next[targetVerseKey] = {
        text: bibleDataRef.current[b].chapters[c][v],
        book: getBookName(b),
        ch: parseInt(c),
        v: parseInt(v),
        book_index: parseInt(b),
        color: '#FFC107',
        dateAdded: getCairoIsoString(),
        synced: !!user
      };
    }
    next[targetVerseKey].note = currentNoteText;
    next[targetVerseKey].noteDate = getCairoIsoString();

    try {
      await StorageService.addNote({
          verseKey: targetVerseKey,
          text: currentNoteText,
          book: next[targetVerseKey].book,
          reference: `${next[targetVerseKey].book} ${next[targetVerseKey].v + 1}:${next[targetVerseKey].ch + 1}`
      });
    } catch (e) {
      console.error('Local note save failed', e);
      toast.error(strings?.bible?.toasts?.note_save_failed || 'Could not save note.'); // FIX #6
      return;
    }

    setFavouriteVerses(next);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { 'favorites.verses': next });
      } catch (e) {
        try {
          await setDoc(doc(db, 'users', user.uid), { favorites: { verses: next } }, { merge: true });
        } catch (e2) {
          console.error("Firebase update failed", e2);
          toast.error(strings?.bible?.toasts?.sync_error || 'Note saved locally, but failed to sync.');
        }
      }
    }

    await saveBibleData(next, completedChapters);
    setIsNoteModalOpen(false);
    await updateUserPoints(5, strings.bible.reasons.note, 'favouriteVerse');
    setCopiedMessage(strings.bible.toasts.note_saved);
    setTimeout(() => setCopiedMessage(''), 2000);
  });

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
    const key = planType === 'custom' ? KEYS.CUSTOM_PLANS : KEYS.COMPLETED_PLANS;
    const all = await StorageService.get(key) || {};

    let planInfo = all[planId] || allPlans.find(p => p.id === parseInt(planId));
    if (!planInfo) return;

    const dayReading = planInfo.readings?.find(r => r.day === parseInt(day))?.books;
    const isDone = checkDayReadingCompleted(dayReading, currentCompleted);
    const dayData = { isCompleted: isDone, dateCompleted: isDone ? getCairoIsoString() : null };

    const planData = all[planId] || { ...planInfo, completedDays: {}, completionPercentage: 0 };
    const newDays = { ...planData.completedDays, [day]: dayData };
    const total = planInfo.readings?.length || 0;
    const percent = total > 0 ? Math.round((Object.values(newDays).filter(d => d.isCompleted).length / total) * 100) : 0;

    all[planId] = { ...planData, completedDays: newDays, completionPercentage: percent };
    await StorageService.save(key, all);

    if (isDone) {
        toast.success(strings.bible.toasts.plan_day_complete);
        if (percent === 100) unlockBadge(`plan_finish_${planId}`);
    }
  };

  const toggleChapterCompletion = withLock('toggleCompletion', async () => {
    const key = `${selectedBookIndex}-${selectedChapterIndex}`;
    const next = { ...completedChapters, [key]: !completedChapters[key] };
    setCompletedChapters(next);
    await saveBibleData(favouriteVerses, next);

    await updateUserPoints(20, next[key] ? strings.bible.reasons.complete_chapter : strings.bible.reasons.undo_chapter, 'completedChapter', !next[key]);

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
  });

  const handleAudioButtonClick = async () => {
    if (contextAudioLoading) return;
    const supportedAudioLangs = ['ar', 'en', 'fr']; // Remove 'de'
    if (!supportedAudioLangs.includes(language)) { toast.error(strings.bible.toasts.audio_not_available_lang); return; }
    const book = bookNamesData[selectedBookIndex], chapter = selectedChapterIndex + 1;
    if (globalAudioUrl && globalAudioUrl.includes(`/${book.book_id}/${chapter}`)) setIsPanelOpen(true);
    else {
      const data = await contextFetchAudio(selectedBookIndex, selectedChapterIndex);
      if (data) playTrack(data.url, data.title, data.times, selectedBookIndex, selectedChapterIndex, true);
      else toast.error(strings.bible.toasts.audio_not_found);
    }
  };

  // Rendering Helpers
  const selectedIndicesSet = useMemo(() => new Set(selectedVerses.map(sv => sv.index)), [selectedVerses]);
  const shortAskLabel = (strings.bible.ask_agios || '').split(/\s+/)[0] || "Ask";

  // FIX #5: distinct, actionable error state instead of an infinite spinner when the chapter data
  // fails to load or comes back empty.
  if (loadError) {
    return (
      <div className={styles.loading} role="alert">
        <AlertTriangle size={28} />
        <p>{strings?.common?.load_error || 'Something went wrong loading this chapter.'}</p>
        <button onClick={() => setReloadTrigger(t => t + 1)} className={styles.actionBtn}>
          {strings?.common?.retry || 'Retry'}
        </button>
      </div>
    );
  }

  if (isLoading || !currentChapterVerses.length) return <div className={styles.loading}>{strings.common.loading}</div>;

  return (
    <div dir={pageDir} className={`${styles.container} ${pageDir === 'rtl' ? styles.rtl : styles.ltr}`}>
      {selectedVerses.length > 0 && (
        <div className={styles.selectionBar}>
          <div className={styles.selectionActions}>
            <button onClick={() => setSelectedVerses([])} className={styles.actionBtn} aria-label={strings?.common?.close || 'Close selection'}>✕</button>
            <button onClick={copySelected} className={styles.actionBtn} title={strings.bible.tooltips.copy} aria-label={strings.bible.tooltips.copy}><Copy size={20} /></button>
            <button onClick={() => shareVerse(selectedVerses.map(v=>v.text).join(' '), selectedVerses.map(v=>v.index))} className={styles.actionBtn} aria-label={strings?.bible?.tooltips?.share || 'Share'}><Share2 size={20} /></button>
            {selectedVerses.length === 1 && (
              <button onClick={() => router.push(`/share-preview?verse=${encodeURIComponent(selectedVerses[0].text)}&ref=${encodeURIComponent(buildReferenceText([selectedVerses[0].index]))}`)} className={styles.actionBtn} title={strings.bible.tooltips.image_design}><ImageIcon size={20} /></button>
            )}
            {/* FIX #11: notes only make sense for a single verse — disabled (with an explanatory
                title) instead of silently attaching a multi-selection's note to just the first verse. */}
            <button
              onClick={() => selectedVerses.length === 1 && openNoteEditor(`${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}`)}
              className={styles.actionBtn}
              disabled={selectedVerses.length !== 1}
              aria-disabled={selectedVerses.length !== 1}
              style={selectedVerses.length !== 1 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              title={selectedVerses.length === 1 ? strings.bible.tooltips.note : (strings?.bible?.tooltips?.note_single_only || 'Select a single verse to add a note')}
            >
              <MessageSquare size={20} />
            </button>
            <button onClick={() => router.push(`/bible/analysis/?book=${encodeURIComponent(getBookName(selectedBookIndex))}&chapter=${selectedChapterIndex + 1}&verses=${selectedVerses.map(v=>v.index+1).sort((a,b)=>a-b).join(',')}`)} className={styles.aiBtn} title={strings.bible.tooltips.ai_analysis}>
              <Sparkles size={20} /><span className={styles.aiBtnText}>{shortAskLabel}</span>
            </button>
          </div>
          <div className={styles.colorGrid}>
            {HIGHLIGHT_COLORS.map((c, i) => {
              // FIX #10: show a checkmark on the swatch matching the current selection's color,
              // so re-tapping-to-remove is discoverable rather than a hidden mechanic. Only shown
              // for a single-verse selection, where "the current color" is unambiguous.
              const isActive = selectedVerses.length === 1 &&
                favouriteVerses[`${selectedBookIndex}-${selectedChapterIndex}-${selectedVerses[0].index}`]?.color === c;
              return (
                <span
                  key={i}
                  className={styles.colorDot}
                  style={{ backgroundColor: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${strings?.bible?.tooltips?.highlight || 'Highlight'} ${c}${isActive ? ` (${strings?.common?.selected || 'selected'})` : ''}`}
                  aria-pressed={isActive}
                  onClick={() => highlightSelected(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); highlightSelected(c); } }}
                >
                  {isActive && <Check size={12} color="#fff" />}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {isNoteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.noteModal} role="dialog" aria-modal="true" aria-label={strings.bible.notes.title}>
            <h3>{strings.bible.notes.title}</h3>
            <textarea value={currentNoteText} onChange={(e) => setCurrentNoteText(e.target.value)} placeholder={strings.bible.notes.placeholder} />
            <div className={styles.modalActions}>
              <button onClick={saveNote} className={styles.saveBtn}>{strings.common.save}</button>
              <button onClick={() => setIsNoteModalOpen(false)} className={styles.cancelBtn}>{strings.common.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <h1 className={styles.title}>{strings.bible.title}</h1>

      <div className={styles.controls}>
        <div className={styles.navigationDisplay}>
          <div className={styles.navContent}>
            <span className={styles.navText} role="button" tabIndex={0} onClick={() => {
              const currentBook = bookNamesData[selectedBookIndex];
              const testament = currentBook?.testament || (currentBook?.type === 'new' ? 'NT' : 'OT');
              router.push(`/bible/books?tab=${testament}`);
            }}>
              {getBookName(selectedBookIndex)}
              <ChevronDown size={14} className={styles.navSubIcon} />
            </span>
            <span className={styles.navSeparator}>|</span>
            <span className={styles.navText} role="button" tabIndex={0} onClick={() => router.push(`/bible/chapters?book=${encodeURIComponent(getBookName(selectedBookIndex))}`)}>
              {`${strings.bible.chapter_label} ${formatNumber(selectedChapterIndex + 1)}`}
              <ChevronDown size={14} className={styles.navSubIcon} />
            </span>
          </div>
        </div>
      </div>

      {copiedMessage && <div className={styles.toast} role="status">{copiedMessage}</div>}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`${selectedBookIndex}-${selectedChapterIndex}`}
          custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
          transition={{ x: { type: "spring", stiffness: 450, damping: 35 }, opacity: { duration: 0.15 } }}
          className={styles.verseContainer}
          style={{ lineHeight: '2', padding: '15px' }}
          dir={pageDir}
        >
          <div className={styles.chapterHeader}>
            <h2 className={styles.chapterTitle}>{getBookName(selectedBookIndex)} {formatNumber(selectedChapterIndex + 1)}</h2>
            <button className={styles.aiBtn} onClick={() => router.push(`/bible/analysis/?book=${encodeURIComponent(getBookName(selectedBookIndex))}&chapter=${selectedChapterIndex + 1}`)} title={strings.bible.tooltips.ai_analysis}>
              <Sparkles size={20} /><span className={styles.aiBtnText}>{strings.bible.ask_agios}</span>
            </button>
          </div>

          <div className={`${(versePerLine || !!parallelLanguage) ? styles.versesList : styles.versesParagraph} optimize-list`}>
            {currentChapterVerses.map((v, i) => (
              <VerseItem
                key={`${selectedBookIndex}-${selectedChapterIndex}-${i}`}
                v={v}
                v2={currentChapterVerses2[i]}
                i={i} verseNumber={i + 1}
                isReading={Number(currentVerseId) === (i + 1)}
                isSelected={selectedIndicesSet.has(i)}
                annotation={favouriteVerses[`${selectedBookIndex}-${selectedChapterIndex}-${i}`]}
                versePerLine={versePerLine}
                formatNumber={formatNumber}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                onVerseClick={toggleVerseSelection}
                openNoteEditor={openNoteEditor}
                keyId={`${selectedBookIndex}-${selectedChapterIndex}-${i}`}
                isParallel={!!parallelLanguage}
              />
            ))}
          </div>

          <div className={styles.completionWrapper}>
            <button className={`${styles.completionBtn} ${completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? styles.completed : ''}`} onClick={toggleChapterCompletion}>
              <span>{strings.bible.chapter_complete_btn}</span>
              {completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`] ? <CircleCheck size={24} color="#4CAF50" /> : <Check size={24} opacity={0.6} />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* FIX #3: manual paging now shares navigateChapter with the audio player, so it also
          crosses book boundaries at the start/end of a book instead of just disabling the button. */}
      <div className={styles.navigation}>
        <button disabled={isAtVeryStart} onClick={() => navigateChapter(-1)} aria-label={strings?.common?.previous || 'Previous chapter'}> « </button>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button onClick={() => router.push('/settings#text-settings')} style={{ display: 'flex' }} title={strings.bible.tooltips.text_settings}><Settings size={28} color="var(--color-text-primary)" /></button>
          {language !== 'de' && (
            <button onClick={handleAudioButtonClick} disabled={contextAudioLoading} style={{ display: 'flex' }}>
              {contextAudioLoading ? <Loader2 size={28} className={styles.spinning} /> : <Volume2 size={28} color={isPlaying ? "#FFC107" : "var(--color-text-primary)"} />}
            </button>
          )}
        </div>
        <button disabled={isAtVeryEnd} onClick={() => navigateChapter(1)} aria-label={strings?.common?.next || 'Next chapter'}> » </button>
      </div>
    </div>
  );
}