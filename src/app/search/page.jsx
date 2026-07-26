'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from './search.module.css';
import _ from 'lodash';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useBadge } from '../context/BadgeContext';
import { Type, Wand2, Sparkles, Settings2, Eye, EyeOff, Search, Copy, Heart, Image as ImageIcon, Share2, AlertCircle, Info, Sparkle } from 'lucide-react';
import { getCairoDate, getCairoIsoString } from '../../lib/dateUtils';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { kv, CACHE_KEYS } from '../../lib/kv';
import { useLanguage } from '../context/LanguageContext';
import { StorageService, KEYS } from '../../lib/storage';

const API_BASE_URL = 'https://www.agiosbible.com';

async function withRetry(fn, onRetry, maxAttempts = 5, baseDelayMs = 2000) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const errorMsg = err.message?.toLowerCase() || "";

      const isRetryable = errorMsg.includes('429') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('503') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('busy') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('network') ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('deadline');

      if (attempt < maxAttempts - 1 && isRetryable) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        let reason = "Connection issue";
        if (errorMsg.includes('429') || errorMsg.includes('quota')) reason = "Quota exceeded";
        else if (errorMsg.includes('503') || errorMsg.includes('busy')) reason = "Server busy";
        else if (errorMsg.includes('timeout')) reason = "Slow response";

        if (onRetry) onRetry(attempt + 1, maxAttempts, reason);
        await new Promise(r => setTimeout(r, delay));
      } else if (!isRetryable) {
        throw err;
      }
      lastError = err;
    }
  }
  throw lastError;
}

function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[ًٌٍَُِْ]/g, '')
    .replace(/[أآإآءئؤ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .trim();
}

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return normalizeArabicText(text).toLowerCase();
}

function CustomSelect({ label, options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedLabel = options.find(opt => opt.value.toString() === (value || "").toString())?.label || placeholder;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.customSelectWrapper} ref={selectRef} style={{ zIndex: isOpen ? 9999 : 1 }}>
      <label className={styles.label}>{label}</label>
      <div className={`${styles.selectTrigger} ${isOpen ? styles.active : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <span>{selectedLabel}</span>
        <div className={styles.arrow}></div>
      </div>
      <ul className={`${styles.dropdownMenu} ${isOpen ? styles.open : ''}`}>
        {options.map(option => (
          <li key={option.value} className={`${styles.dropdownItem} ${(value || "").toString() === option.value.toString() ? styles.selected : ''}`} onClick={() => { onChange({ target: { value: option.value } }); setIsOpen(false); }}>
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchContent() {
  const { language, strings, bookNames: bookNamesData, formatNumber, dir } = useLanguage();
  const [user, setUser] = useState(null);
  const { triggerBadgeUnlock } = useBadge();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialType = searchParams.get('type') || 'literal';

  const [inputTerm, setInputTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState(initialType);
  const [bibleData, setBibleData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [semanticResults, setSemanticResults] = useState([]);
  const [searchInfo, setSearchInfo] = useState(null);
  const [selectedDerivatives, setSelectedDerivatives] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allVerses, setAllVerses] = useState([]);
  const [selectedTestament, setSelectedTestament] = useState('');
  const [selectedBookIndex, setSelectedBookIndex] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [showDerivatives, setShowDerivatives] = useState(false);
  const [activeActionId, setActiveActionId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [aiStatus, setAiStatus] = useState('');

  const [semanticOptions, setSemanticOptions] = useState({
    showTitle: true,
    showReason: true
  });

  const searchHint = language === 'ar'
    ? 'مثال: سلام، يوسف، النعمة'
    : language === 'fr'
      ? 'Exemple : paix, Joseph, grâce'
      : language === 'de'
        ? 'Beispiel: Frieden, Josef, Gnade'
        : 'Example: peace, Joseph, grace';

  const searchModeLabels = {
    literal: language === 'ar' ? 'بحث مباشر' : language === 'fr' ? 'Recherche directe' : language === 'de' ? 'Direkte Suche' : 'Direct search',
    derivatives: language === 'ar' ? 'بحث مشتق' : language === 'fr' ? 'Recherche dérivée' : language === 'de' ? 'Wortwurzel-Suche' : 'Root search',
    semantic: language === 'ar' ? 'بحث معنوي' : language === 'fr' ? 'Recherche sémantique' : language === 'de' ? 'Semantische Suche' : 'Semantic search'
  };

  const resultsRef = useRef(null);
  const currentSearchIdRef = useRef(0);

  useEffect(() => {
    const typeFromUrl = searchParams.get('type');
    if (typeFromUrl && ['literal', 'derivatives', 'semantic'].includes(typeFromUrl)) {
      setSearchType(typeFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
          if (snapshot.exists()) {
            setFavouriteVerses(snapshot.data().favorites?.verses || {});
          }
        });
      } else {
        const localFavs = await StorageService.get(KEYS.FAVORITES) || {};
        setFavouriteVerses(localFavs);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (bookNamesData.length === 0) return;
      try {
        let bJson;
        if (language === 'ar') {
          bJson = (await import('../../../public/data/translations/arabic/ar_svd_no_tashkeel.json')).default;
        } else if (language === 'en') {
          bJson = (await import('../../../public/data/translations/English/en_web.json')).default;
        } else if (language === 'fr') {
          bJson = (await import('../../../public/data/translations/French/fr_segond.json')).default;
        } else if (language === 'de') {
          bJson = (await import('../../../public/data/translations/german/de_luther.json')).default;
        } else {
          bJson = (await import('../../../public/data/translations/arabic/ar_svd_no_tashkeel.json')).default;
        }

        setBibleData(bJson);

        const flattened = bJson.flatMap((book, bIdx) => {
          const meta = bookNamesData[bIdx];
          if (!meta) return [];
          return book.chapters.flatMap((ch, chIdx) => ch.map((v, vIdx) => ({
            text: v,
            normText: normalizeText(v),
            book: meta.name,
            book_index: bIdx,
            chapter: chIdx,
            verse: vIdx,
            testament: meta.testament
          })));
        });
        setAllVerses(flattened);
        setIsLoading(false);
      } catch (e) {
        console.error("Search Fetch Error:", e);
        setIsLoading(false);
      }
    };
    fetchData();
  }, [bookNamesData, language]);

  useEffect(() => {
    const requestTimes = JSON.parse(localStorage.getItem('aiSearchTimestamps') || '[]');
    const now = Date.now();
    const oneMinute = 60000;
    const recentRequests = requestTimes.filter(time => now - time < oneMinute);

    if (recentRequests.length >= 3) {
      const oldestInWindow = Math.min(...recentRequests);
      setTimeLeft(Math.ceil((oneMinute - (now - oldestInWindow)) / 1000));
    }
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  useEffect(() => {
    if (allVerses.length === 0) return;

    const normQuery = normalizeText(searchQuery);
    const isFilterActive = selectedTestament !== '' || selectedBookIndex !== '' || selectedChapter !== '';

    if (!normQuery && !isFilterActive && (searchType !== 'derivatives' || selectedDerivatives.length === 0)) {
      setSearchResults([]);
      return;
    }

    if (searchType === 'derivatives' && selectedDerivatives.length > 0) {
      let regex;
      if (language === 'ar') {
        const suffixes = "(ه|ها|هم|هن|ك|كما|كم|كن|نا|ي|ت|تم|تن|وا|ون|ين|ات)?";
        const pattern = `(^|\\s|\\.|\\،|\\:|\\!|\\?)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})${suffixes}(?=\\s|\\.|\\،|\\:|\\!|\\?|$)`;
        regex = new RegExp(pattern, 'i');
      } else {
        const boundary = `(^|\\s|\\.|,|:|!|\\?|\\(|\\|\\||\\[|\\]|"|'|“|”|«|»|;|/|\\\\)`;
        const pattern = `${boundary}(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})(?=${boundary}|$)`;
        regex = new RegExp(pattern, 'i');
      }

      let filtered = allVerses;
      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

      const finalFiltered = filtered.filter(v => regex.test(v.normText || normalizeText(v.text)));
      setSearchResults(finalFiltered.slice(0, 500));
    } else if (searchType === 'literal') {
      let filtered = allVerses;

      if (normQuery) {
        filtered = filtered.filter(v => (v.normText || normalizeArabicText(v.text)).includes(normQuery));
      }

      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

      setSearchResults(filtered.slice(0, 500));
    } else if (searchType === 'derivatives' && selectedDerivatives.length === 0) {
      setSearchResults([]);
    }
  }, [searchQuery, selectedDerivatives, allVerses, selectedTestament, selectedBookIndex, selectedChapter, searchType, language]);

  const displaySemanticResults = useMemo(() => {
    if (searchType !== 'semantic' || semanticResults.length === 0) return [];

    return semanticResults.filter(res => {
      if (selectedTestament && bookNamesData[res.bookIndex]?.testament !== selectedTestament) return false;
      if (selectedBookIndex !== '' && res.bookIndex !== parseInt(selectedBookIndex)) return false;
      if (selectedChapter !== '' && res.chapter !== (parseInt(selectedChapter) + 1)) return false;
      return true;
    });
  }, [semanticResults, selectedTestament, selectedBookIndex, selectedChapter, searchType, bookNamesData]);

  const unlockBadge = async (badgeId) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentBadges = userSnap.data()?.badges || [];
      if (!currentBadges.includes(badgeId)) {
        await updateDoc(userRef, { badges: arrayUnion(badgeId) });
        triggerBadgeUnlock(badgeId);
      }
    } catch (e) { console.error(e); }
  };

  const updateUserPoints = async (amount, reason) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalPoints: increment(amount),
        pointsHistory: arrayUnion({
          points: amount,
          reason,
          timestamp: getCairoIsoString()
        })
      });
    } catch (e) { console.error("Points Update Error:", e); }
  };

  const handleUpdateVerse = async (v, color = null, isDelete = false) => {
    const verseId = `${v.book_index}-${v.chapter}-${v.verse}`;
    const newFavorites = { ...favouriteVerses };

    if (isDelete) {
      delete newFavorites[verseId];
    } else {
      const isNew = !newFavorites[verseId];
      newFavorites[verseId] = {
        text: v.text,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        book_index: v.book_index,
        color: color !== null ? color : (newFavorites[verseId]?.color || "#FFC107"),
        note: noteText,
        dateAdded: getCairoIsoString()
      };
      if (isNew && user) updateUserPoints(5, strings.search.reason_highlight);
    }

    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { 'favorites.verses': newFavorites });
      } else {
        await StorageService.save(KEYS.FAVORITES, newFavorites);
        setFavouriteVerses(newFavorites);
      }
      setActiveActionId(null);
      toast.success(isDelete ? strings.search.toast_delete_success : strings.search.toast_save_success);
    } catch (e) {
      toast.error(strings.common.error_occurred);
    }
  };

  const addSelectedToFavorites = async (color = "#FFC107") => {
    if (selectedVerses.length === 0) return;

    const newFavorites = { ...favouriteVerses };
    let addedCount = 0;

    selectedVerses.forEach(v => {
      const vId = `${v.book_index}-${v.chapter}-${v.verse}`;
      if (!newFavorites[vId]) {
        newFavorites[vId] = {
          text: v.text,
          book: v.book,
          chapter: v.chapter,
          verse: v.verse,
          book_index: v.book_index,
          color: color,
          note: '',
          dateAdded: getCairoIsoString()
        };
        addedCount++;
      }
    });

    if (addedCount === 0) return toast.error(strings.search.toast_fav_exists);

    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { 'favorites.verses': newFavorites });
        updateUserPoints(addedCount * 5, strings.search.reason_highlight_multi);
      } else {
        await StorageService.save(KEYS.FAVORITES, newFavorites);
        setFavouriteVerses(newFavorites);
      }
      setSelectedVerses([]);
      toast.success(strings.search.toast_fav_added.replace('{count}', formatNumber(addedCount)));
    } catch (e) {
      toast.error(strings.common.error_occurred);
    }
  };

  const checkRateLimit = () => {
    const requestTimes = JSON.parse(localStorage.getItem('aiSearchTimestamps') || '[]');
    const now = Date.now();
    const oneMinute = 60000;
    const recentRequests = requestTimes.filter(time => now - time < oneMinute);

    if (recentRequests.length >= 2) {
      const oldestInWindow = Math.min(...recentRequests);
      const remaining = Math.ceil((oneMinute - (now - oldestInWindow)) / 1000);
      setTimeLeft(remaining);
      return false;
    }

    const updatedRequests = [...recentRequests, now];
    localStorage.setItem('aiSearchTimestamps', JSON.stringify(updatedRequests));
    return true;
  };

  const readLegacyCache = async (newKey, legacyKeys = []) => {
    try {
      const cached = await kv.get(newKey);
      if (cached) return { cached, legacy: false };
      for (const legacyKey of legacyKeys) {
        const legacyCached = await kv.get(legacyKey);
        if (legacyCached) return { cached: legacyCached, legacy: true };
      }
      return { cached: null, legacy: false };
    } catch (e) {
      console.error('Upstash Read Error:', e);
      return { cached: null, legacy: false };
    }
  };

  const handleSemanticSearch = async (term) => {
    const cacheKey = `${CACHE_KEYS.SEMANTIC}semantic:${language}:${term}`;
    const legacyKeys = [
      `${CACHE_KEYS.SEMANTIC}semantic:${term}`,
      `${CACHE_KEYS.SEMANTIC}semantic:${normalizeArabicText(term)}`
    ];
    const { cached, legacy } = await readLegacyCache(cacheKey, legacyKeys);
    if (cached) {
      if (legacy) {
        const migrationKey = `${CACHE_KEYS.SEMANTIC}semantic:ar:${term}`;
        kv.set(migrationKey, cached).catch(console.error);
      }

      if (language === 'ar' || (language !== 'ar' && !cached.some(r => r.language && r.language !== 'ar'))) {
        setSemanticResults(cached);
        return cached;
      }
    }

    if (!checkRateLimit()) return null;

    const searchId = ++currentSearchIdRef.current;

    const attemptSemantic = async (attemptIndex) => {
      const allowedBooks = bookNamesData?.map(b => b.name).join(', ') || '';
      const filterContext = `
        ${selectedTestament ? `Testament: ${selectedTestament === 'OT' ? 'Old' : 'New'}` : ''}
        ${selectedBookIndex !== '' ? `Book: ${bookNamesData[parseInt(selectedBookIndex)].name}` : ''}
      `;

      const response = await fetch(`${API_BASE_URL}/api/gemini/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'semantic',
          lang: language,
          attempt: attemptIndex,
          payload: { term, allowedBooks, filterContext }
        })
      });

      if (!response.ok) throw new Error(await response.text());
      const { text } = await response.json();

      if (currentSearchIdRef.current !== searchId) return null;

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON format from server");

      const data = JSON.parse(jsonMatch[0]);

      const enriched = data.results.map(ref => {
        const bookIdx = bookNamesData.findIndex(b => b.name === ref.book);
        if (bookIdx === -1) return null;

        const bookData = bibleData[bookIdx];
        if (!bookData || !bookData.chapters[ref.chapter - 1]) return null;

        const chapter = bookData.chapters[ref.chapter - 1];
        const versesContent = ref.verses.map(vNum => ({
          verse: vNum - 1,
          chapter: ref.chapter - 1,
          book_index: bookIdx,
          book: ref.book,
          number: vNum,
          text: chapter[vNum - 1]
        })).filter(v => v.text);

        if (versesContent.length === 0) return null;

        return {
          ...ref,
          bookIndex: bookIdx,
          versesContent,
          book: bookNamesData[bookIdx].name,
          language: language
        };
      }).filter(r => r !== null);

      if (enriched.length > 0) {
        kv.set(cacheKey, enriched).catch(console.error);
      }

      setSemanticResults(enriched);
      return enriched;
    };

    try {
      setAiStatus(strings.search.status_searching);
      const result = await withRetry(
        attemptSemantic,
        (attempt, max, reason) => setAiStatus(`Attempt (${formatNumber(attempt)}/${formatNumber(max)}): ${reason}.. Trying next key...`),
        5,
        2000
      );
      setAiStatus('');
      return result;
    } catch (e) {
      setAiStatus('');
      console.error("Semantic Search Error:", e);
      toast.error(strings.search.toast_semantic_error);
      return null;
    }
  };

  const searchWithGeminiDerivativesMultilingual = async (term) => {
    const cacheKey = `${CACHE_KEYS.SEMANTIC}deriv:${language}:${term}`;
    const legacyKeys = [
      `${CACHE_KEYS.SEMANTIC}deriv:${term}`,
      `${CACHE_KEYS.SEMANTIC}deriv:${normalizeArabicText(term)}`
    ];
    const { cached, legacy } = await readLegacyCache(cacheKey, legacyKeys);
    if (cached) {
      if (legacy) {
        const migrationKey = `${CACHE_KEYS.SEMANTIC}deriv:ar:${term}`;
        kv.set(migrationKey, cached).catch(console.error);
      }

      if (language === 'ar' || (language !== 'ar' && !cached.language)) {
        setSearchInfo(cached);
        setSelectedDerivatives(cached.derivatives);
        return cached;
      }
    }

    if (!checkRateLimit()) return null;

    const searchId = ++currentSearchIdRef.current;
    let currentInfo = { root: '...', derivatives: [], isStatic: false, explanation: '', language: language };
    setShowDerivatives(true);

    const attemptStreamInternal = async (attemptIndex) => {
      const response = await fetch(`${API_BASE_URL}/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'derivatives_stream',
          lang: language,
          attempt: attemptIndex,
          payload: { term }
        })
      });

      if (!response.ok) throw new Error(await response.text());
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (currentSearchIdRef.current !== searchId) return currentInfo;

        const chunkText = decoder.decode(value);
        fullText += chunkText;

        const rootMatch = fullText.match(/"root"\s*:\s*"([^"]+)"/);
        if (rootMatch) currentInfo.root = rootMatch[1];

        const staticMatch = fullText.match(/"isStatic"\s*:\s*(true|false)/);
        if (staticMatch) currentInfo.isStatic = staticMatch[1] === 'true';

        const explMatch = fullText.match(/"explanation"\s*:\s*"([^"]+)"/);
        if (explMatch) currentInfo.explanation = explMatch[1];

        const derivativesMatch = fullText.match(/"derivatives"\s*:\s*\[([\s\S]*?)\]/);
        if (derivativesMatch) {
          const wordsString = derivativesMatch[1];
          const words = [...wordsString.matchAll(/"([^"]+)"/g)].map(m => normalizeArabicText(m[1]));
          if (words.length > 0) {
            const allWords = _.uniq([normalizeArabicText(term), ...words]);
            currentInfo.derivatives = allWords;
            setSearchInfo({ ...currentInfo });
            setSelectedDerivatives(allWords);
          }
        }
      }

      return currentInfo;
    };

    try {
      setAiStatus(strings.search.status_analyzing);
      const result = await withRetry(
        attemptStreamInternal,
        (attempt, max, reason) => setAiStatus(`Attempt (${formatNumber(attempt)}/${formatNumber(max)}): ${reason}.. Trying next key...`),
        5,
        2000
      );

      if (result && result.derivatives.length > 0) {
        kv.set(cacheKey, result).catch(console.error);
      }

      setAiStatus('');

      const nlpCount = parseInt(localStorage.getItem('nlp_search_count') || '0') + 1;
      localStorage.setItem('nlp_search_count', nlpCount.toString());
      if (nlpCount >= 3) await unlockBadge('logic_breaker');

      return result;
    } catch (e) {
      setAiStatus('');
      console.error("Gemini Derivatives Error:", e);
      toast.error(strings.analysis.error_generic);
      const fallback = { derivatives: [term], root: 'Unknown', isStatic: false, explanation: '', language: language };
      setSearchInfo(fallback);
      setSelectedDerivatives(fallback.derivatives);
      return fallback;
    }
  };

  const handleSearchPoints = () => {
    if (!user) return;
    const today = getCairoDate();
    const storageKey = `search_points_${user.uid}`;
    const searchData = JSON.parse(localStorage.getItem(storageKey) || '{"date":"","count":0}');

    if (searchData.date !== today) {
      updateUserPoints(5, strings.search.reason_search);
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: 1 }));
    } else if (searchData.count < 5) {
      updateUserPoints(5, strings.search.reason_search);
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: searchData.count + 1 }));
    }
  };

  const performSearch = async () => {
    if (allVerses.length === 0) return;
    const currentQuery = inputTerm.trim();
    const isFilterActive = selectedTestament !== '' || selectedBookIndex !== '' || selectedChapter !== '';

    if (!currentQuery && !isFilterActive) {
      setSearchResults([]);
      setSemanticResults([]);
      setSearchQuery('');
      setAiStatus('');
      return;
    }

    if (searchType === 'derivatives') {
        if (currentQuery.split(/\s+/).length > 1) {
            toast.error(strings.search.error_derivatives_limit);
            return;
        }
    }

    setIsLoading(true);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    setShowDerivatives(false);
    setSearchQuery(currentQuery);

    if (currentQuery && currentQuery.length >= 2) {
      handleSearchPoints();
      if (searchType === 'derivatives') {
        setSemanticResults([]);
        await searchWithGeminiDerivativesMultilingual(currentQuery);
      } else if (searchType === 'semantic') {
        setSearchResults([]);
        await handleSemanticSearch(currentQuery);
      }
    } else {
      setSemanticResults([]);
    }
    setIsLoading(false);
  };

  const renderHighlightedText = (text, highlight, verseColor) => {
    if (!highlight || !text) return <span style={{ backgroundColor: verseColor ? `${verseColor} 66` : 'transparent' }}>{text}</span>;

    const normalizedHighlight = language === 'ar' ? normalizeArabicText(highlight) : normalizeText(highlight);
    let regex;

    if (searchType === 'derivatives' && selectedDerivatives.length > 0) {
      if (language === 'ar') {
        const suffixes = "(ه|ها|هم|هن|ك|كما|كم|كن|نا|ي|ت|تم|تن|وا|ون|ين|ات)?";
        const pattern = `(^|\\s|\\.|\\،|\\:|\\!|\\?)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})${suffixes}(?=\\s|\\.|\\،|\\:|\\!|\\?|$)`;
        regex = new RegExp(pattern, 'gi');
      } else {
        const pattern = `(^|\\W)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})(?=$|\\W)`;
        regex = new RegExp(pattern, 'gi');
      }
    } else {
      const tashkeelRegex = "[ًٌٍَُِْ]*";
      const fuzzyPattern = normalizedHighlight.split('').map(char => {
        if (char === 'ا') return "[اأإآءئؤ]";
        if (char === 'ي') return "[يى]";
        if (char === 'ه') return "[هة]";
        return _.escapeRegExp(char);
      }).join(tashkeelRegex);

      regex = new RegExp(`(${fuzzyPattern})`, 'gi');
    }

    const parts = text.split(regex);
    return (
      <span style={{ backgroundColor: verseColor ? `${verseColor} 66` : 'transparent', borderRadius: '4px', padding: '2px 0' }}>
        {parts.map((p, i) => {
          if (!p) return null;
          const normalizedP = language === 'ar' ? normalizeArabicText(p) : normalizeText(p);
          let isMatch = false;

          if (searchType === 'derivatives') {
            if (language === 'ar') {
              isMatch = selectedDerivatives.some(d => normalizedP.startsWith(d));
            } else {
              isMatch = selectedDerivatives.some(d => normalizedP === normalizeText(d));
            }
          } else {
            isMatch = normalizedP === normalizedHighlight;
          }

          return isMatch ? <span key={i} className={styles.highlight}>{p}</span> : p;
        })}
      </span>
    );
  };

  const handleCopy = (v) => {
    const chapterLabel = formatNumber(v.chapter + 1);
    const verseLabel = formatNumber(v.verse + 1);
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    const fullText = `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    }
    toast.success(strings.search.toast_copy_success);
    updateUserPoints(15, strings.search.reason_copy);
  };

  const handleShare = async (v) => {
    const chapterLabel = formatNumber(v.chapter + 1);
    const verseLabel = formatNumber(v.verse + 1);
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    const fullText = `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: fullText,
          dialogTitle: strings.bible.share_dialog,
        });
      } else if (navigator.share) {
        await navigator.share({
          text: fullText,
        });
      } else {
        handleCopy(v);
      }
      updateUserPoints(15, strings.search.reason_share);
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const copySelected = () => {
    if (selectedVerses.length === 0) return;
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    const sorted = [...selectedVerses].sort((a, b) => a.book_index - b.book_index || a.chapter - b.chapter || a.verse - b.verse);
    const text = sorted.map(v => v.text).join(' ');

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const sameBook = sorted.every(v => v.book_index === first.book_index);
    const sameChapter = sameBook && sorted.every(v => v.chapter === first.chapter);

    let reference;
    if (sameChapter) {
      const isConsecutive = sorted.length > 1 && (last.verse - first.verse) === (sorted.length - 1);
      let verseRange;
      if (sorted.length === 1) {
        verseRange = formatNumber(first.verse + 1);
      } else if (isConsecutive) {
        verseRange = `${formatNumber(first.verse + 1)} - ${formatNumber(last.verse + 1)}`;
      } else {
        verseRange = sorted.map(sv => formatNumber(sv.verse + 1)).join(isArabic ? '، ' : ', ');
      }
      reference = `${first.book} ${formatNumber(first.chapter + 1)}${lrm}:${rlm}${verseRange}`;
    } else if (sameBook) {
      reference = `${first.book} (${strings.search.multiple_references || 'Multiple references'})`;
    } else {
      reference = strings.search.multiple_references || "Multiple references";
    }

    const fullText = `${text} ${rlm}(${reference})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    }
    toast.success(strings.search.toast_copy_success);
    updateUserPoints(15, strings.search.reason_copy_multi);
    setSelectedVerses([]);
  };

  const shareSelected = async () => {
    if (selectedVerses.length === 0) return;
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    const sorted = [...selectedVerses].sort((a, b) => a.book_index - b.book_index || a.chapter - b.chapter || a.verse - b.verse);
    const text = sorted.map(v => v.text).join(' ');

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const sameBook = sorted.every(v => v.book_index === first.book_index);
    const sameChapter = sameBook && sorted.every(v => v.chapter === first.chapter);

    let reference;
    if (sameChapter) {
      const isConsecutive = sorted.length > 1 && (last.verse - first.verse) === (sorted.length - 1);
      let verseRange;
      if (sorted.length === 1) {
        verseRange = formatNumber(first.verse + 1);
      } else if (isConsecutive) {
        verseRange = `${formatNumber(first.verse + 1)} - ${formatNumber(last.verse + 1)}`;
      } else {
        verseRange = sorted.map(sv => formatNumber(sv.verse + 1)).join(isArabic ? '، ' : ', ');
      }
      reference = `${first.book} ${formatNumber(first.chapter + 1)}${lrm}:${rlm}${verseRange}`;
    } else if (sameBook) {
      reference = `${first.book} (${strings.search.multiple_references || 'Multiple references'})`;
    } else {
      reference = strings.search.multiple_references || "Multiple references";
    }

    const fullText = `${text} ${rlm}(${reference})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: fullText,
          dialogTitle: strings.bible.share_dialog,
        });
      } else if (navigator.share) {
        await navigator.share({
          text: fullText,
        });
      } else {
        copySelected();
      }
      updateUserPoints(15, strings.search.reason_share_multi);
      setSelectedVerses([]);
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const copyAllResults = () => {
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    let fullText = "";

    if (searchType === 'semantic') {
      if (displaySemanticResults.length === 0) return;

      fullText = displaySemanticResults.map(res => {
        let groupText = "";
        if (semanticOptions.showTitle) groupText += `Title: ${res.title}\n`;
        if (semanticOptions.showReason) groupText += `Reason: ${res.reason}\n`;

        const versesText = res.versesContent.map(v => v.text).join(' ');
        const first = res.versesContent[0];
        const last = res.versesContent[res.versesContent.length - 1];

        const verseRange = res.versesContent.length === 1
          ? formatNumber(first.number)
          : `${formatNumber(first.number)} - ${formatNumber(last.number)}`;

        groupText += `${versesText} ${rlm}(${res.book} ${formatNumber(res.chapter)}${lrm}:${rlm}${verseRange})`;
        return groupText;
      }).join('\n\n');

    } else {
      if (searchResults.length === 0) return;
      fullText = searchResults.map(v => {
        const chapterLabel = formatNumber(v.chapter + 1);
        const verseLabel = formatNumber(v.verse + 1);
        return `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
      }).join('\n');
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    }
    toast.success(strings.search.toast_copy_success);
    updateUserPoints(20, strings.search.reason_copy_all);
  };

  const shareAllResults = async () => {
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    let fullText = "";

    if (searchType === 'semantic') {
      if (displaySemanticResults.length === 0) return;

      fullText = displaySemanticResults.map(res => {
        let groupText = "";
        if (semanticOptions.showTitle) groupText += `Title: ${res.title}\n`;
        if (semanticOptions.showReason) groupText += `Reason: ${res.reason}\n`;

        const versesText = res.versesContent.map(v => v.text).join(' ');
        const first = res.versesContent[0];
        const last = res.versesContent[res.versesContent.length - 1];

        const verseRange = res.versesContent.length === 1
          ? formatNumber(first.number)
          : `${formatNumber(first.number)} - ${formatNumber(last.number)}`;

        groupText += `${versesText} ${rlm}(${res.book} ${formatNumber(res.chapter)}${lrm}:${rlm}${verseRange})`;
        return groupText;
      }).join('\n\n');

    } else {
      if (searchResults.length === 0) return;
      fullText = searchResults.map(v => {
        const chapterLabel = formatNumber(v.chapter + 1);
        const verseLabel = formatNumber(v.verse + 1);
        return `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
      }).join('\n');
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: fullText,
          dialogTitle: strings.bible.share_dialog,
        });
      } else if (navigator.share) {
        await navigator.share({
          text: fullText,
        });
      } else {
        copyAllResults();
      }
      updateUserPoints(20, strings.search.reason_share_all);
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const copySemanticGroup = (res) => {
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    let groupText = "";

    if (semanticOptions.showTitle) groupText += `Title: ${res.title}\n`;
    if (semanticOptions.showReason) groupText += `Reason: ${res.reason}\n`;

    const versesText = res.versesContent.map(v => v.text).join(' ');
    const first = res.versesContent[0];
    const last = res.versesContent[res.versesContent.length - 1];

    const verseRange = res.versesContent.length === 1
      ? formatNumber(first.number)
      : `${formatNumber(first.number)} - ${formatNumber(last.number)}`;

    groupText += `${versesText} ${rlm}(${res.book} ${formatNumber(res.chapter)}${lrm}:${rlm}${verseRange})`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(groupText);
    }
    toast.success(strings.search.toast_copy_success);
    updateUserPoints(10, strings.search.reason_copy_semantic);
  };

  const shareSemanticGroup = async (res) => {
    const isArabic = language === 'ar';
    const rlm = isArabic ? "\u200F" : "";
    const lrm = isArabic ? "\u200E" : "";
    let groupText = "";

    if (semanticOptions.showTitle) groupText += `Title: ${res.title}\n`;
    if (semanticOptions.showReason) groupText += `Reason: ${res.reason}\n`;

    const versesText = res.versesContent.map(v => v.text).join(' ');
    const first = res.versesContent[0];
    const last = res.versesContent[res.versesContent.length - 1];

    const verseRange = res.versesContent.length === 1
      ? formatNumber(first.number)
      : `${formatNumber(first.number)} - ${formatNumber(last.number)}`;

    groupText += `${versesText} ${rlm}(${res.book} ${formatNumber(res.chapter)}${lrm}:${rlm}${verseRange})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: groupText,
          dialogTitle: strings.bible.share_dialog,
        });
      } else if (navigator.share) {
        await navigator.share({
          text: groupText,
        });
      } else {
        copySemanticGroup(res);
      }
      updateUserPoints(10, strings.search.reason_share_semantic);
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const analyzeSelected = () => {
    if (selectedVerses.length === 0) return;

    const first = selectedVerses[0];
    const sameChapter = selectedVerses.every(v => v.book_index === first.book_index && v.chapter === first.chapter);

    if (!sameChapter) {
      toast.error(strings.search.toast_analyze_chapter_limit);
      return;
    }

    const verseNumbers = selectedVerses.map(v => v.verse + 1).sort((a, b) => a - b).join(',');
    router.push(`/bible/analysis/?book=${encodeURIComponent(first.book)}&chapter=${first.chapter + 1}&verses=${verseNumbers}`);
  };

  const filteredBooks = selectedTestament ? bookNamesData.filter(b => b.testament === selectedTestament) : bookNamesData;
  const chaptersCount = (selectedBookIndex !== '' && bibleData) ? bibleData[parseInt(selectedBookIndex)].chapters.length : 0;
  const shortAskLabel = (strings.bible.ask_agios || '').split(/\s+/)[0] || strings.bible.ask_agios;

  const VerseCard = ({ v }) => {
    const vId = `${v.book_index}-${v.chapter}-${v.verse}`;
    const savedVerse = favouriteVerses[vId];
    const isSelected = selectedVerses.some(sv => `${sv.book_index}-${sv.chapter}-${sv.verse}` === vId);

    return (
      <div
        className={`${styles.verseCard} ${isSelected ? styles.selectedCard : ''}`}
        style={{ borderInlineStart: savedVerse?.color ? `5px solid ${savedVerse.color}` : 'none' }}
        onClick={(e) => {
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
          setSelectedVerses(prev => isSelected ? prev.filter(sv => `${sv.book_index}-${sv.chapter}-${sv.verse}` !== vId) : [...prev, v]);
        }}
      >
        <div className={styles.verseText}>
          <span className={styles.verseNumber}>{formatNumber(v.verse + 1)}</span>
          {searchType !== 'semantic'
            ? renderHighlightedText(v.text, searchQuery, savedVerse?.color)
            : <span style={{ backgroundColor: savedVerse?.color ? `${savedVerse.color}66` : 'transparent', borderRadius: '4px', padding: '0 4px' }}>{v.text}</span>
          }
        </div>

        {savedVerse?.note && (
          <div className={styles.noteDisplay}>
            <span className={styles.noteIcon}>📝</span>
            <p>{savedVerse.note}</p>
          </div>
        )}

        <div className={styles.verseReference}>
          <Link href={`/bible?book=${encodeURIComponent(v.book)}&chapter=${v.chapter + 1}&verse=${v.verse + 1}`} className={styles.referenceLink}>
            {(() => {
              const isArabic = language === 'ar';
              const rlm = isArabic ? "\u200F" : "";
              const lrm = isArabic ? "\u200E" : "";
              const chapterLabel = formatNumber(v.chapter + 1);
              const verseLabel = formatNumber(v.verse + 1);
              return `${rlm}${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel}`;
            })()}
          </Link>
          <div className={styles.actions}>
            <button onClick={(e) => { e.stopPropagation(); handleCopy(v); }} title={strings.common.copy}>
              <Copy size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleShare(v); }} title={strings.common.share}>
              <Share2 size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/bible/analysis/?book=${encodeURIComponent(v.book)}&chapter=${v.chapter + 1}&verses=${v.verse + 1}`);
              }}
              title={strings.bible.tooltips.ai_analysis}
              className={styles.aiActionBtn}
            >
              <Sparkles size={18} />
              <span className={styles.aiActionBtnText}>{shortAskLabel}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const chapterLabel = formatNumber(v.chapter + 1);
                const verseLabel = formatNumber(v.verse + 1);
                const refText = `${v.book} ${chapterLabel}:${verseLabel}`;
                router.push(`/share-preview?verse=${encodeURIComponent(v.text)}&ref=${encodeURIComponent(refText)}`);
              }}
              title={strings.bible.tooltips.image_design}
            >
              <ImageIcon size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === vId ? null : vId); setNoteText(savedVerse?.note || ''); }} title="Favorite">
              {savedVerse ? <span style={{ color: savedVerse.color }}>💙</span> : '🤍'}
            </button>
          </div>
        </div>

        {activeActionId === vId && (
          <div className={styles.actionPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.colorPalette}>
              {highlightColors.map(c => (
                <div key={c.color} className={`${styles.colorCircle} ${savedVerse?.color === c.color ? styles.activeColor : ''} `} style={{ backgroundColor: c.color }} onClick={() => handleUpdateVerse(v, c.color)} />
              ))}
              <div className={styles.clearColor} onClick={() => handleUpdateVerse(v, null, true)}>✕</div>
            </div>
            <div className={styles.noteInputArea}>
              <textarea placeholder={strings.search.note_placeholder} value={noteText} onChange={(e) => setNoteText(e.target.value)} className={styles.noteTextArea} />
              <button className={styles.saveNoteBtn} onClick={() => handleUpdateVerse(v, savedVerse?.color || null)}>{strings.common.save}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
      <div className={styles.card}>
        <h1 className={styles.heading}>{strings.search.title}</h1>
        <p className={styles.searchIntro}>
          {language === 'ar'
            ? 'اختر طريقة البحث المناسبة لك ثم اكتب كلمة أو موضوعًا وستظهر لك الآيات مباشرة.'
            : language === 'fr'
              ? 'Choisissez la manière de chercher qui vous convient, puis saisissez un mot ou un thème.'
              : language === 'de'
                ? 'Wähle die Suchmethode aus, die zu dir passt, und gib dann ein Wort oder Thema ein.'
                : 'Choose the search method that fits you best, then enter a word or theme.'}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); performSearch(); }} className={styles.controls}>
          <div className={styles.inputGroup}>
            <input type="text" value={inputTerm} onChange={e => setInputTerm(e.target.value)} className={styles.input} placeholder={searchType === 'derivatives' ? strings.search.placeholder_derivatives : strings.search.placeholder_default} />
            <span className={styles.inputHint}>{searchHint}</span>
            <button type="submit" className={styles.searchButton}>
              <Search size={18} />
              <span>{language === 'ar' ? 'ابحث الآن' : language === 'fr' ? 'Rechercher maintenant' : language === 'de' ? 'Jetzt suchen' : 'Search now'}</span>
            </button>
          </div>
          <div className={styles.searchTypeSelector}>
            <div className={styles.originalRadioGroup}>
              <label className={searchType === 'literal' ? styles.activeLabel : ''}>
                <input type="radio" checked={searchType === 'literal'} onChange={() => setSearchType('literal')} />
                <Type size={16} />
                <span>{searchModeLabels.literal}</span>
              </label>
              <label className={`${searchType === 'derivatives' ? styles.activeLabel : ''} ${timeLeft > 0 ? styles.disabledLabel : ''} `}>
                <input type="radio" checked={searchType === 'derivatives'} onChange={() => timeLeft === 0 && setSearchType('derivatives')} disabled={timeLeft > 0 && searchType !== 'derivatives'} />
                <div className={styles.sparkleIcon}>
                    <Wand2 size={16} />
                </div>
                <span>{searchModeLabels.derivatives}</span>
              </label>
              <label className={`${searchType === 'semantic' ? styles.activeLabel : ''} ${timeLeft > 0 ? styles.disabledLabel : ''}`}>
                <input type="radio" checked={searchType === 'semantic'} onChange={() => timeLeft === 0 && setSearchType('semantic')} disabled={timeLeft > 0 && searchType !== 'semantic'} />
                <div className={styles.sparkleIcon}>
                    <Sparkles size={16} />
                </div>
                <span>{searchModeLabels.semantic}</span>
              </label>
            </div>
            {timeLeft > 0 && <div className={styles.originalCooldownBadge}><span className={styles.originalTimerText}>{strings.search.cooldown_text.replace('{time}', formatNumber(timeLeft))}</span></div>}

            {searchType === 'semantic' && (
              <div className={styles.semanticOptions}>
                <div className={styles.optionHeader}>
                  <Settings2 size={14} />
                  <span>{strings.search.display_settings}</span>
                </div>
                <div className={styles.optionControls}>
                  <button
                    type="button"
                    className={`${styles.optionToggle} ${semanticOptions.showTitle ? styles.activeOption : ''}`}
                    onClick={() => setSemanticOptions(prev => ({ ...prev, showTitle: !prev.showTitle }))}
                  >
                    {semanticOptions.showTitle ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>{strings.search.option_title}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.optionToggle} ${semanticOptions.showReason ? styles.activeOption : ''}`}
                    onClick={() => setSemanticOptions(prev => ({ ...prev, showReason: !prev.showReason }))}
                  >
                    {semanticOptions.showReason ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>{strings.search.option_reason}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className={styles.filterGrid}>
            <CustomSelect label={strings.search.label_testament} options={[{ value: '', label: strings.search.testament_all }, { value: 'OT', label: strings.search.testament_ot }, { value: 'NT', label: strings.search.testament_nt }]} value={selectedTestament} onChange={e => { setSelectedTestament(e.target.value); setSelectedBookIndex(''); setSelectedChapter(''); }} placeholder={strings.search.select_prompt.replace('{label}', strings.search.label_testament)} />
            <CustomSelect label={strings.search.label_book} options={[{ value: '', label: strings.search.book_all }, ...filteredBooks.map(b => ({ value: bookNamesData.indexOf(b).toString(), label: b.name }))]} value={selectedBookIndex} onChange={e => { setSelectedBookIndex(e.target.value); setSelectedChapter(''); }} placeholder={strings.search.select_prompt.replace('{label}', strings.search.label_book)} />
            {selectedBookIndex !== '' && <CustomSelect label={strings.search.label_chapter} options={[{ value: '', label: strings.search.chapter_all }, ...Array.from({ length: chaptersCount }, (_, i) => ({ value: i.toString(), label: formatNumber(i + 1) }))]} value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} placeholder={strings.search.select_prompt.replace('{label}', strings.search.label_chapter)} />}
          </div>
        </form>

        {aiStatus && (
          <div className={styles.loading} style={{ textAlign: 'center', padding: '12px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', marginBottom: '15px' }}>
            <span>⏳ {aiStatus}</span>
          </div>
        )}

        {searchInfo && searchType === 'derivatives' && (
          <div className={styles.derivativesWrapper}>
            {searchInfo.isStatic && (
              <div className={styles.staticWordWarning}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#856404' }}>
                  <AlertCircle size={20} />
                  <strong>{strings.search.warning_static_word}</strong>
                </div>
                <p>{searchInfo.explanation || strings.search.warning_static_word_desc}</p>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Info size={12} />
                    <span>{strings.search.ai_verified}</span>
                </div>
              </div>
            )}
            <button type="button" className={styles.toggleDerivativesBtn} onClick={() => setShowDerivatives(!showDerivatives)}>{showDerivatives ? strings.search.toggle_derivatives_hide : strings.search.toggle_derivatives_show}</button>
            {showDerivatives && (
              <div className={styles.searchInfoBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ margin: 0 }}><strong>{strings.search.extracted_root}</strong> {searchInfo.root}</p>
                  <div className={styles.selectionActionsSmall}>
                    <button type="button" onClick={() => setSelectedDerivatives(searchInfo.derivatives)}>{strings.search.select_all}</button>
                    <button type="button" onClick={() => setSelectedDerivatives([])}>{strings.search.deselect_all}</button>
                  </div>
                </div>
                <div className={styles.derivativesList}>
                  {searchInfo.derivatives.map((d, i) => (
                    <label key={i} className={`${styles.derivativeItem} ${selectedDerivatives.includes(d) ? styles.activeItem : ''}`}>
                      <input type="checkbox" checked={selectedDerivatives.includes(d)} onChange={() => setSelectedDerivatives(prev => prev.includes(d) ? prev.filter(item => item !== d) : [...prev, d])} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={resultsRef}>
          {isLoading ? <div className={styles.loading}>{strings.search.loading_wait}</div> : (
            ((searchType === 'semantic' ? displaySemanticResults.length > 0 : searchResults.length > 0) || searchQuery || selectedTestament || selectedBookIndex !== '') && (
              <div className={styles.resultsWrapper}>

                <div className={styles.resultsHeader}>
                  <div className={styles.headerInfo}>
                    <p className={styles.resultsCount}>
                      {searchType === 'semantic'
                        ? strings.search.results_count_semantic.replace('{count}', formatNumber(displaySemanticResults.reduce((acc, curr) => acc + curr.versesContent.length, 0)))
                        : strings.search.results_count_default.replace('{count}', formatNumber(searchResults.length))}
                    </p>
                    {(searchType === 'semantic' ? displaySemanticResults.length > 0 : searchResults.length > 0) && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={copyAllResults} className={styles.copyAllBtn}>
                          <Copy size={14} />
                          <span>{strings.search.copy_all}</span>
                        </button>
                        <button onClick={shareAllResults} className={styles.copyAllBtn} style={{ borderColor: '#3b82f6' }}>
                          <Share2 size={14} />
                          <span>{strings.search.share_all}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedVerses.length > 0 && (
                    <div className={styles.selectionActions}>
                      <button onClick={copySelected} className={styles.multiCopyBtn}>
                        <Copy size={16} />
                        <span>{strings.search.selection_copy.replace('{count}', formatNumber(selectedVerses.length))}</span>
                      </button>
                      <button onClick={shareSelected} className={styles.multiShareBtn}>
                        <Share2 size={16} />
                        <span>{strings.search.selection_share.replace('{count}', formatNumber(selectedVerses.length))}</span>
                      </button>
                      <button onClick={() => addSelectedToFavorites("#FFC107")} className={styles.multiFavBtn}>
                        <Heart size={16} />
                        <span>{strings.search.selection_fav}</span>
                      </button>
                      <button onClick={analyzeSelected} className={styles.multiAiBtn}>
                        <Sparkles size={16} />
                        <span>{strings.bible.ask_agios}</span>
                      </button>
                      <button onClick={() => setSelectedVerses([])} className={styles.clearSelectionBtn}>{strings.search.selection_cancel}</button>
                    </div>
                  )}
                </div>

                {searchType === 'semantic' && displaySemanticResults.length > 0 && (
                  <div className={styles.resultsContainer}>
                    {displaySemanticResults.map((res, idx) => (
                      <div key={idx} className={styles.semanticGroupWrapper}>
                        <div className={styles.semanticGroupHeader}>
                          <div className={styles.semanticHeaderTop}>
                            {semanticOptions.showTitle && <h3 className={styles.semanticTitle}>{res.title}</h3>}
                            <div className={styles.semanticGroupActions}>
                              <button
                                type="button"
                                className={styles.copyGroupBtn}
                                onClick={() => copySemanticGroup(res)}
                              >
                                <Copy size={14} />
                                <span>{strings.search.copy_group}</span>
                              </button>
                              <button
                                type="button"
                                className={styles.shareGroupBtn}
                                onClick={() => shareSemanticGroup(res)}
                              >
                                <Share2 size={14} />
                                <span>{strings.search.share_group}</span>
                              </button>

                            </div>
                          </div>
                          {semanticOptions.showReason && <p className={styles.semanticReason}>{res.reason}</p>}
                        </div>

                        <div className={styles.semanticVersesList}>
                          {res.versesContent.map((v) => (
                            <VerseCard key={`${v.book_index}-${v.chapter}-${v.verse}`} v={v} />
                          ))}
                        </div>
                      </div>
                    ))}
                    {(searchType === 'semantic' || searchType === 'derivatives') && (
                      <div className={styles.aiDisclaimer}>
                        <Sparkle className={styles.aiDisclaimerIcon} size={20} />
                        <p className={styles.aiDisclaimerText}>{strings.search.ai_disclaimer}</p>
                      </div>
                    )}
                  </div>
                )}

                {searchType !== 'semantic' && (
                  <div className={styles.resultsContainer}>
                    {searchResults.map((v, i) => (
                      <VerseCard key={`${v.book_index}-${v.chapter}-${v.verse}`} v={v} />
                    ))}
                    {(searchType === 'derivatives') && searchResults.length > 0 && (
                      <div className={styles.aiDisclaimer}>
                        <Sparkle className={styles.aiDisclaimerIcon} size={20} />
                        <p className={styles.aiDisclaimerText}>{strings.search.ai_disclaimer}</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function BibleSearchPage() {
  const { strings } = useLanguage();
  return (
    <Suspense fallback={<div>{strings.common.loading}</div>}>
      <SearchContent />
    </Suspense>
  );
}
