'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from './search.module.css';
import { GoogleGenerativeAI } from "@google/generative-ai";
import _ from 'lodash';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useBadge } from '../context/BadgeContext';
import { Type, Wand2, Sparkles, Settings2, Eye, EyeOff, Search, Copy, Heart, Image as ImageIcon, Share2 } from 'lucide-react';
import { getCairoDate, getCairoIsoString } from '../../lib/dateUtils';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { kv, CACHE_KEYS } from '../../lib/kv';

const apiKeys = [
  "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ",
  "AIzaSyB9a0OiIJGdlwcDdna511QZTLPp14gWoic",
  "AQ.Ab8RN6J4tMmUaO2fXNoMSI3ZzAjJJzSdsonV8BJwA4hU8Qd-lg",
  "AQ.Ab8RN6LcBmsh2-JOPw2nFABcCLRDuydaBPFsAtQktLh_UB654g"
];
const getGenAI = (index) => {
  const key = apiKeys[index % apiKeys.length];
  return new GoogleGenerativeAI(key);
};

const geminiCache = {};

// ─── Retry helper المُطور والذكي ────────────────────────────────────────────────────────────
async function withRetry(fn, onRetry, maxAttempts = 5, baseDelayMs = 2000) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const errorMsg = err.message?.toLowerCase() || "";

      // تحديد ما إذا كان الخطأ يستحق إعادة المحاولة
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
        let reason = "مشكلة في الاتصال";
        if (errorMsg.includes('429') || errorMsg.includes('quota')) reason = "ضغط طلبات (Quota)";
        else if (errorMsg.includes('503') || errorMsg.includes('busy')) reason = "الخادم مشغول";
        else if (errorMsg.includes('timeout')) reason = "بطء في الاستجابة";

        if (onRetry) onRetry(attempt + 1, maxAttempts, reason);
        await new Promise(r => setTimeout(r, delay));
      } else if (!isRetryable) {
        throw err; // إذا كان خطأ برمجي لا نعيد المحاولة
      }
    }
  }
  throw lastError;
}

// ─── Stream with chunk timeout ────────────────────────────────────────────────
async function* streamWithTimeout(stream, timeoutMs = 15000) {
  for await (const chunk of stream) {
    yield await Promise.race([
      Promise.resolve(chunk),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Stream chunk timed out')), timeoutMs)
      )
    ]);
  }
}

const highlightColors = [
  { color: "#ffeb3b", label: "اصفر" }, { color: "#ffc107", label: "برتقالي" },
  { color: "#ff9800", label: "كركمي" }, { color: "#ff5722", label: "احمر" },
  { color: "#f44336", label: "قرمزي" }, { color: "#e91e63", label: "وردي" },
  { color: "#9c27b0", label: "بنفسجي" }, { color: "#673ab7", label: "نيلي" },
  { color: "#3f51b5", label: "كحلي" }, { color: "#2196f3", label: "ازرق" },
  { color: "#03a9f4", label: "سماوي" }, { color: "#00bcd4", label: "تركواز" },
  { color: "#009688", label: "جنزاري" }, { color: "#4caf50", label: "اخضر" },
  { color: "#8bc34a", label: "عشبي" }, { color: "#cddc39", label: "ليموني" },
  { color: "#795548", label: "بني" }, { color: "#607d8b", label: "رمادي" }
];

function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num?.toString().split('').map(d => arabicNums[+d] || d).join('') || '';
}

function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[ًٌٍَُِْ]/g, '')      // حذف التشكيل
    .replace(/[أآإآءئؤ]/g, 'ا')   // توحيد جميع أشكال الهمزة إلى ألف
    .replace(/[ىي]/g, 'ي')       // توحيد الياء والألف المقصورة
    .replace(/[ة]/g, 'ه')        // توحيد التاء المربوطة والهاء
    .trim();
}

function CustomSelect({ label, options, value, onChange, dir }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const selectedLabel = options.find(opt => opt.value.toString() === (value || "").toString())?.label || `اختر ${label}`;

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
      <div className={`${styles.selectTrigger} ${isOpen ? styles.active : ''}`} onClick={() => setIsOpen(!isOpen)} dir={dir}>
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
  const [user, setUser] = useState(null);
  const { triggerBadgeUnlock } = useBadge();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialType = searchParams.get('type') || 'literal';

  const [inputTerm, setInputTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState(initialType);
  const [bibleData, setBibleData] = useState(null);
  const [bookNamesData, setBookNamesData] = useState(null);
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        onSnapshot(doc(db, 'users', u.uid), (snapshot) => {
          if (snapshot.exists()) {
            setFavouriteVerses(snapshot.data().favorites?.verses || {});
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bRes, nRes] = await Promise.all([fetch('/data/bibles/ar_svd.json'), fetch('/data/bookNames.json')]);
        const bJson = await bRes.json();
        const nJson = await nRes.json();
        setBibleData(bJson);
        setBookNamesData(nJson);
        const flattened = bJson.flatMap((book, bIdx) => {
          const meta = nJson?.ar?.[bIdx];
          return book.chapters.flatMap((ch, chIdx) => ch.map((v, vIdx) => ({
            text: v,
            normText: normalizeArabicText(v),
            book: meta.name,
            book_index: bIdx,
            chapter: chIdx,
            verse: vIdx,
            testament: meta.testament
          })));
        });
        setAllVerses(flattened);
        setIsLoading(false);
      } catch (e) { setIsLoading(false); }
    };
    fetchData();
  }, []);

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

    const normQuery = normalizeArabicText(searchQuery);
    const isFilterActive = selectedTestament !== '' || selectedBookIndex !== '' || selectedChapter !== '';

    // منع عرض كل الآيات إذا لم يوجد بحث أو فلتر فعال لتجنب تهنيج المتصفح عند الفتح
    if (!normQuery && !isFilterActive && (searchType !== 'derivatives' || selectedDerivatives.length === 0)) {
      setSearchResults([]);
      return;
    }

    if (searchType === 'derivatives' && selectedDerivatives.length > 0) {
      const suffixes = "(ه|ها|هم|هن|ك|كما|كم|كن|نا|ي|ت|تم|تن|وا|ون|ين|ات)?";
      const pattern = `(^|\\s|\\.|\\،|\\:|\\!|\\?)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})${suffixes}(?=\\s|\\.|\\،|\\:|\\!|\\?|$)`;
      const regex = new RegExp(pattern, 'i');

      let filtered = allVerses;
      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

      const finalFiltered = filtered.filter(v => regex.test(v.normText || normalizeArabicText(v.text)));
      setSearchResults(finalFiltered.slice(0, 500)); // تحديد النتائج بـ 500 كحد أقصى للأداء
    } else if (searchType === 'literal') {
      let filtered = allVerses;

      if (normQuery) {
        filtered = filtered.filter(v => (v.normText || normalizeArabicText(v.text)).includes(normQuery));
      }

      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

      setSearchResults(filtered.slice(0, 500)); // تحديد النتائج بـ 500 كحد أقصى للأداء
    } else if (searchType === 'derivatives' && selectedDerivatives.length === 0) {
      setSearchResults([]);
    }
  }, [searchQuery, selectedDerivatives, allVerses, selectedTestament, selectedBookIndex, selectedChapter, searchType]);

  // فلترة فورية لنتائج البحث الذكي
  const displaySemanticResults = useMemo(() => {
    if (searchType !== 'semantic' || semanticResults.length === 0) return [];

    return semanticResults.filter(res => {
      if (selectedTestament && bookNamesData?.ar[res.bookIndex]?.testament !== selectedTestament) return false;
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
    if (!user) return toast.error("سجل دخولك أولاً");
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
        color: color !== null ? color : (newFavorites[verseId]?.color || "#ffeb3b"),
        note: noteText,
        dateAdded: getCairoIsoString()
      };
      if (isNew) updateUserPoints(5, "تظليل آية من البحث");
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), { 'favorites.verses': newFavorites });
      setActiveActionId(null);
      toast.success(isDelete ? "تم حذف التظليل" : "تم الحفظ بنجاح");
    } catch (e) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const addSelectedToFavorites = async (color = "#ffeb3b") => {
    if (!user) return toast.error("سجل دخولك أولاً");
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

    if (addedCount === 0) return toast.error("الآيات المختارة موجودة بالفعل في المفضلة");

    try {
      await updateDoc(doc(db, 'users', user.uid), { 'favorites.verses': newFavorites });
      updateUserPoints(addedCount * 5, "تظليل مجموعة آيات");
      setSelectedVerses([]);
      toast.success(`تم إضافة ${convertToArabicNumber(addedCount)} آيات للمفضلة`);
    } catch (e) {
      toast.error("حدث خطأ أثناء الحفظ");
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

  const searchWithGeminiDerivatives = async (term) => {
    if (geminiCache[term]) {
      setSearchInfo(geminiCache[term]);
      setSelectedDerivatives(geminiCache[term].derivatives);
      return geminiCache[term];
    }

    const normalizedTerm = normalizeArabicText(term);
    const cacheKey = `${CACHE_KEYS.SEMANTIC}deriv:${normalizedTerm}`;
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        setSearchInfo(cached);
        setSelectedDerivatives(cached.derivatives);
        geminiCache[term] = cached;
        return cached;
      }
    } catch (e) { console.error("Upstash Read Error:", e); }

    if (!checkRateLimit()) return null;

    const searchId = ++currentSearchIdRef.current;
    let currentInfo = { root: '...', derivatives: [] };
    setShowDerivatives(true);

    const attemptStream = async (attemptIndex) => {
      const genAIInstance = getGenAI(attemptIndex);
      const model = genAIInstance.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
      const prompt = `أنت عالم لغوي متخصص في فقه اللغة العربية والصرف المعمق.
الكلمة المستهدفة: "${term}".
المطلوب: تحليل صرفي شامل يستخرج "كل صورة ممكنة" للكلمة في النص.
يجب أن تتضمن قائمة المشتقات (derivatives) ما يلي:
1. الجذر اللغوي الصحيح. "تنبيه": إذا كانت الكلمة (اسم علم أعجمي)، يمنع تماماً اشتقاق أفعال منها، وبدلاً من ذلك يتم التركيز على صور ورودها المختلفة بالسوابق واللواحق.
2. الأفعال: في حالات (الرفع، النصب، الجزم) بما يشمل حذف النون وحروف العلة، وتصريفها في الماضي والمضارع والأمر مع كافة الضمائر.
3. الضمائر المتصلة: شمول الأفعال المتصلة بضمائر المفعول به نون الوقاية.
4. الأسماء المشتقة: (فاعل، مفعول، مصدر، مبالغة، تفضيل).
5. السوابق واللواحق لأسماء الأعلام والأفعال.
يجب أن يكون الرد بصيغة JSON فقط:
{
  "root": "الجذر أو 'اسم علم'",
  "derivatives": ["كلمة1", "كلمة2", "..."]
}`;

      const result = await model.generateContentStream(prompt);
      let fullText = '';

      for await (const chunk of streamWithTimeout(result.stream, 15000)) {
        if (currentSearchIdRef.current !== searchId) return currentInfo;

        const chunkText = chunk.text();
        fullText += chunkText;

        const rootMatch = fullText.match(/"root"\s*:\s*"([^"]+)"/);
        if (rootMatch) currentInfo.root = rootMatch[1];

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
      setAiStatus('جاري تحليل الكلمة...');
      const result = await withRetry(
        attemptStream,
        (attempt, max, reason) => setAiStatus(`محاولة (${convertToArabicNumber(attempt)}/${convertToArabicNumber(max)}): ${reason}.. جاري تجربة مفتاح بديل...`),
        5,
        2000
      );

      geminiCache[term] = result;
      if (result && result.derivatives.length > 0) {
        kv.set(cacheKey, result, { ex: 604800 }).catch(console.error);
      }

      setAiStatus('');

      const nlpCount = parseInt(localStorage.getItem('nlp_search_count') || '0') + 1;
      localStorage.setItem('nlp_search_count', nlpCount.toString());
      if (nlpCount >= 3) await unlockBadge('logic_breaker');

      return result;
    } catch (e) {
      setAiStatus('');
      console.error("Gemini Derivatives Error (all retries exhausted):", e);
      toast.error(navigator.onLine ? "تعذّر الوصول للذكاء الاصطناعي، حاول مجدداً" : "تأكد من اتصالك بالإنترنت");
      const fallback = { derivatives: [normalizeArabicText(term)], root: 'غير معروف' };
      setSearchInfo(fallback);
      setSelectedDerivatives(fallback.derivatives);
      return fallback;
    }
  };

  const handleSemanticSearch = async (term) => {
    const normalizedTerm = normalizeArabicText(term);
    const cacheKey = `${CACHE_KEYS.SEMANTIC}${normalizedTerm}`;
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        setSemanticResults(cached);
        return cached;
      }
    } catch (e) { console.error("Upstash Read Error:", e); }

    if (!checkRateLimit()) return null;

    const searchId = ++currentSearchIdRef.current;

    const attemptSemantic = async (attemptIndex) => {
      const allowedBooks = bookNamesData?.ar?.map(b => b.name).join(', ') || '';
      const filterContext = `
        ${selectedTestament ? `العهد المطلوب البحث فيه: ${selectedTestament === 'OT' ? 'العهد القديم' : 'العهد الجديد'}` : ''}
        ${selectedBookIndex !== '' ? `السفر المطلوب البحث فيه: ${bookNamesData.ar[parseInt(selectedBookIndex)].name}` : ''}
      `;

      const genAIInstance = getGenAI(attemptIndex);
      const model = genAIInstance.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
      const prompt = `أنت محرك بحث لاهوتي لتطبيق "أجيوس".
استخرج 5-7 مراجع مرتبطة بـ: "${term}"
السياق: ${filterContext}

القواعد:
1. الرد JSON فقط بهذا التنسيق:
{
  "results": [{"book": "اسم السفر", "chapter": 1, "verses": [1], "title": "...", "reason": "..."}]
}
2. الالتزام بأسماء الأسفار حصراً: [${allowedBooks}]
3. للصفات: ابحث عن آيات مباشرة وقصص تجسدها.
4. دقة عالية في الأرقام.`;
      const responsePromise = model.generateContent(prompt);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Semantic search timed out after 25s')), 25000)
      );

      const result = await Promise.race([responsePromise, timeoutPromise]);

      if (currentSearchIdRef.current !== searchId) return null;

      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON format from model");

      const data = JSON.parse(jsonMatch[0]);

      const enriched = data.results.map(ref => {
        const bookIdx = bookNamesData.ar.findIndex(b => b.name === ref.book);
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
          book: bookNamesData.ar[bookIdx].name
        };
      }).filter(r => r !== null);

      if (enriched.length > 0) {
        kv.set(cacheKey, enriched, { ex: 604800 }).catch(console.error);
      }

      setSemanticResults(enriched);
      return enriched;
    };

    try {
      setAiStatus('جاري البحث في الكتاب المقدس...');
      const result = await withRetry(
        attemptSemantic,
        (attempt, max, reason) => setAiStatus(`محاولة (${convertToArabicNumber(attempt)}/${convertToArabicNumber(max)}): ${reason}.. جاري تجربة مفتاح احتياطي...`),
        5,
        2000
      );
      setAiStatus('');
      return result;
    } catch (e) {
      setAiStatus('');
      console.error("Semantic Search Error (all retries exhausted):", e);
      toast.error("عذراً، الخادم مضغوط حالياً. يرجى المحاولة مرة أخرى بعد دقيقة.");
      return null;
    }
  };

  const handleSearchPoints = () => {
    if (!user) return;
    const today = getCairoDate();
    const storageKey = `search_points_${user.uid}`;
    const searchData = JSON.parse(localStorage.getItem(storageKey) || '{"date":"","count":0}');

    if (searchData.date !== today) {
      updateUserPoints(5, "البحث عن آية/كلمة");
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: 1 }));
    } else if (searchData.count < 5) {
      updateUserPoints(5, "البحث عن آية/كلمة");
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
        await searchWithGeminiDerivatives(currentQuery);
      } else if (searchType === 'semantic') {
        setSearchResults([]);
        await handleSemanticSearch(currentQuery);
      } else {
        // Just local filtering via useEffect
      }
    } else {
      setSemanticResults([]);
      // الفلترة تتم الآن تلقائياً عبر useEffect
    }
    setIsLoading(false);
  };

  const renderHighlightedText = (text, highlight, verseColor) => {
    if (!highlight || !text) return <span style={{ backgroundColor: verseColor ? `${verseColor} 66` : 'transparent' }}>{text}</span>;

    const normalizedHighlight = normalizeArabicText(highlight);
    let regex;

    if (searchType === 'derivatives' && selectedDerivatives.length > 0) {
      const suffixes = "(ه|ها|هم|هن|ك|كما|كم|كن|نا|ي|ت|تم|تن|وا|ون|ين|ات)?";
      const pattern = `(^|\\s|\\.|\\،|\\:|\\!|\\?)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})${suffixes}(?=\\s|\\.|\\،|\\:|\\!|\\?|$)`;
      regex = new RegExp(pattern, 'gi');
    } else {
      // نظام تظليل مرن يتجاهل التشكيل ويوحد الهمزات
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
          const normalizedP = normalizeArabicText(p);
          let isMatch = false;

          if (searchType === 'derivatives') {
            isMatch = selectedDerivatives.some(d => normalizedP.startsWith(d));
          } else {
            isMatch = normalizedP === normalizedHighlight;
          }

          return isMatch ? <span key={i} className={styles.highlight}>{p}</span> : p;
        })}
      </span>
    );
  };

  const handleCopy = (v) => {
    const chapterLabel = convertToArabicNumber(v.chapter + 1);
    const verseLabel = convertToArabicNumber(v.verse + 1);
    const rlm = "\u200F";
    const lrm = "\u200E";
    const fullText = `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
    navigator.clipboard.writeText(fullText);
    toast.success("تم نسخ الآية ✨");
    updateUserPoints(15, "نسخ آية من البحث");
  };

  const handleShare = async (v) => {
    const chapterLabel = convertToArabicNumber(v.chapter + 1);
    const verseLabel = convertToArabicNumber(v.verse + 1);
    const rlm = "\u200F";
    const lrm = "\u200E";
    const fullText = `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: fullText,
          dialogTitle: 'مشاركة الآية عبر...',
        });
      } else if (navigator.share) {
        await navigator.share({
          text: fullText,
        });
      } else {
        handleCopy(v);
      }
      updateUserPoints(15, "مشاركة آية من البحث");
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const copySelected = () => {
    if (selectedVerses.length === 0) return;
    const rlm = "\u200F";
    const lrm = "\u200E";
    const sorted = [...selectedVerses].sort((a, b) => a.book_index - b.book_index || a.chapter - b.chapter || a.verse - b.verse);
    const text = sorted.map(v => v.text).join(' ');

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const sameBook = sorted.every(v => v.book_index === first.book_index);
    const sameChapter = sameBook && sorted.every(v => v.chapter === first.chapter);

    let reference;
    if (sameChapter) {
      const isConsecutive = (last.verse - first.verse) === (sorted.length - 1);
      const verseRange = isConsecutive
        ? `${convertToArabicNumber(first.verse + 1)} - ${convertToArabicNumber(last.verse + 1)}`
        : sorted.map(sv => convertToArabicNumber(sv.verse + 1)).join('، ');
      reference = `${first.book} ${convertToArabicNumber(first.chapter + 1)}${lrm}:${rlm}${verseRange}`;
    } else if (sameBook) {
      reference = `${first.book} (شواهد متعددة)`;
    } else {
      reference = "شواهد متعددة";
    }

    const fullText = `${text} ${rlm}(${reference})`;
    navigator.clipboard.writeText(fullText);
    toast.success("تم نسخ الآيات المختارة ✨");
    updateUserPoints(15, "نسخ مجموعة آيات");
    setSelectedVerses([]);
  };

  const shareSelected = async () => {
    if (selectedVerses.length === 0) return;
    const rlm = "\u200F";
    const lrm = "\u200E";
    const sorted = [...selectedVerses].sort((a, b) => a.book_index - b.book_index || a.chapter - b.chapter || a.verse - b.verse);
    const text = sorted.map(v => v.text).join(' ');

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const sameBook = sorted.every(v => v.book_index === first.book_index);
    const sameChapter = sameBook && sorted.every(v => v.chapter === first.chapter);

    let reference;
    if (sameChapter) {
      const isConsecutive = (last.verse - first.verse) === (sorted.length - 1);
      const verseRange = isConsecutive
        ? `${convertToArabicNumber(first.verse + 1)} - ${convertToArabicNumber(last.verse + 1)}`
        : sorted.map(sv => convertToArabicNumber(sv.verse + 1)).join('، ');
      reference = `${first.book} ${convertToArabicNumber(first.chapter + 1)}${lrm}:${rlm}${verseRange}`;
    } else if (sameBook) {
      reference = `${first.book} (شواهد متعددة)`;
    } else {
      reference = "شواهد متعددة";
    }

    const fullText = `${text} ${rlm}(${reference})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: fullText,
          dialogTitle: 'مشاركة الآيات عبر...',
        });
      } else if (navigator.share) {
        await navigator.share({
          text: fullText,
        });
      } else {
        copySelected();
      }
      updateUserPoints(15, "مشاركة مجموعة آيات");
      setSelectedVerses([]);
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const copyAllResults = () => {
    const rlm = "\u200F";
    const lrm = "\u200E";
    let fullText = "";

    if (searchType === 'semantic') {
      if (displaySemanticResults.length === 0) return;

      fullText = displaySemanticResults.map(res => {
        let groupText = "";
        if (semanticOptions.showTitle) groupText += `العنوان: ${res.title}\n`;
        if (semanticOptions.showReason) groupText += `الشرح: ${res.reason}\n`;

        const versesText = res.versesContent.map(v => v.text).join(' ');
        const first = res.versesContent[0];
        const last = res.versesContent[res.versesContent.length - 1];

        const verseRange = res.versesContent.length === 1
          ? convertToArabicNumber(first.number)
          : `${convertToArabicNumber(first.number)} - ${convertToArabicNumber(last.number)}`;

        groupText += `${versesText} ${rlm}(${res.book} ${convertToArabicNumber(res.chapter + 1)}${lrm}:${rlm}${verseRange})`;
        return groupText;
      }).join('\n\n');

    } else {
      if (searchResults.length === 0) return;
      fullText = searchResults.map(v => {
        const chapterLabel = convertToArabicNumber(v.chapter + 1);
        const verseLabel = convertToArabicNumber(v.verse + 1);
        return `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
      }).join('\n');
    }

    navigator.clipboard.writeText(fullText);
    toast.success("تم نسخ جميع النتائج ✨");
    updateUserPoints(20, "نسخ جميع نتائج البحث");
  };

  const shareAllResults = async () => {
    const rlm = "\u200F";
    const lrm = "\u200E";
    let fullText = "";

    if (searchType === 'semantic') {
      if (displaySemanticResults.length === 0) return;

      fullText = displaySemanticResults.map(res => {
        let groupText = "";
        if (semanticOptions.showTitle) groupText += `العنوان: ${res.title}\n`;
        if (semanticOptions.showReason) groupText += `الشرح: ${res.reason}\n`;

        const versesText = res.versesContent.map(v => v.text).join(' ');
        const first = res.versesContent[0];
        const last = res.versesContent[res.versesContent.length - 1];

        const verseRange = res.versesContent.length === 1
          ? convertToArabicNumber(first.number)
          : `${convertToArabicNumber(first.number)} - ${convertToArabicNumber(last.number)}`;

        groupText += `${versesText} ${rlm}(${res.book} ${convertToArabicNumber(res.chapter + 1)}${lrm}:${rlm}${verseRange})`;
        return groupText;
      }).join('\n\n');

    } else {
      if (searchResults.length === 0) return;
      fullText = searchResults.map(v => {
        const chapterLabel = convertToArabicNumber(v.chapter + 1);
        const verseLabel = convertToArabicNumber(v.verse + 1);
        return `${v.text} ${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
      }).join('\n');
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: fullText,
          dialogTitle: 'مشاركة جميع النتائج عبر...',
        });
      } else if (navigator.share) {
        await navigator.share({
          text: fullText,
        });
      } else {
        copyAllResults();
      }
      updateUserPoints(20, "مشاركة جميع نتائج البحث");
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const copySemanticGroup = (res) => {
    const rlm = "\u200F";
    const lrm = "\u200E";
    let groupText = "";

    if (semanticOptions.showTitle) groupText += `العنوان: ${res.title}\n`;
    if (semanticOptions.showReason) groupText += `الشرح: ${res.reason}\n`;

    const versesText = res.versesContent.map(v => v.text).join(' ');
    const first = res.versesContent[0];
    const last = res.versesContent[res.versesContent.length - 1];

    const verseRange = res.versesContent.length === 1
      ? convertToArabicNumber(first.number)
      : `${convertToArabicNumber(first.number)} - ${convertToArabicNumber(last.number)}`;

    groupText += `${versesText} ${rlm}(${res.book} ${convertToArabicNumber(res.chapter + 1)}${lrm}:${rlm}${verseRange})`;

    navigator.clipboard.writeText(groupText);
    toast.success("تم نسخ المقطع بنجاح ✨");
    updateUserPoints(10, "نسخ مقطع من البحث الذكي");
  };

  const shareSemanticGroup = async (res) => {
    const rlm = "\u200F";
    const lrm = "\u200E";
    let groupText = "";

    if (semanticOptions.showTitle) groupText += `العنوان: ${res.title}\n`;
    if (semanticOptions.showReason) groupText += `الشرح: ${res.reason}\n`;

    const versesText = res.versesContent.map(v => v.text).join(' ');
    const first = res.versesContent[0];
    const last = res.versesContent[res.versesContent.length - 1];

    const verseRange = res.versesContent.length === 1
      ? convertToArabicNumber(first.number)
      : `${convertToArabicNumber(first.number)} - ${convertToArabicNumber(last.number)}`;

    groupText += `${versesText} ${rlm}(${res.book} ${convertToArabicNumber(res.chapter + 1)}${lrm}:${rlm}${verseRange})`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: groupText,
          dialogTitle: 'مشاركة المقطع عبر...',
        });
      } else if (navigator.share) {
        await navigator.share({
          text: groupText,
        });
      } else {
        copySemanticGroup(res);
      }
      updateUserPoints(10, "مشاركة مقطع من البحث الذكي");
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const analyzeSelected = () => {
    if (selectedVerses.length === 0) return;

    const first = selectedVerses[0];
    const sameChapter = selectedVerses.every(v => v.book_index === first.book_index && v.chapter === first.chapter);

    if (!sameChapter) {
      toast.error("التحليل متاح للآيات من نفس الإصحاح فقط");
      return;
    }

    const verseNumbers = selectedVerses.map(v => v.verse + 1).sort((a, b) => a - b).join(',');
    router.push(`/bible/analysis/?book=${encodeURIComponent(first.book)}&chapter=${first.chapter + 1}&verses=${verseNumbers}`);
  };

  const booksList = bookNamesData?.ar || [];
  const filteredBooks = selectedTestament ? booksList.filter(b => b.testament === selectedTestament) : booksList;
  const chaptersCount = (selectedBookIndex !== '' && bibleData) ? bibleData[parseInt(selectedBookIndex)].chapters.length : 0;

  const VerseCard = ({ v }) => {
    const vId = `${v.book_index}-${v.chapter}-${v.verse}`;
    const savedVerse = favouriteVerses[vId];
    const isSelected = selectedVerses.some(sv => `${sv.book_index}-${sv.chapter}-${sv.verse}` === vId);

    return (
      <div
        className={`${styles.verseCard} ${isSelected ? styles.selectedCard : ''}`}
        style={{ borderRight: savedVerse?.color ? `5px solid ${savedVerse.color}` : 'none' }}
        onClick={(e) => {
          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
          setSelectedVerses(prev => isSelected ? prev.filter(sv => `${sv.book_index}-${sv.chapter}-${sv.verse}` !== vId) : [...prev, v]);
        }}
      >
        <div className={styles.verseText}>
          <span className={styles.verseNumber}>{convertToArabicNumber(v.verse + 1)}</span>
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
              const rlm = "\u200F";
              const lrm = "\u200E";
              const chapterLabel = convertToArabicNumber(v.chapter + 1);
              const verseLabel = convertToArabicNumber(v.verse + 1);
              return `${rlm}${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel}`;
            })()}
          </Link>
          <div className={styles.actions}>
            <button onClick={(e) => { e.stopPropagation(); handleCopy(v); }} title="نسخ">
              <Copy size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleShare(v); }} title="مشاركة">
              <Share2 size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/bible/analysis/?book=${encodeURIComponent(v.book)}&chapter=${v.chapter + 1}&verses=${v.verse + 1}`);
              }}
              title="تحليل بالذكاء الاصطناعي"
              className={styles.aiActionBtn}
            >
              <Sparkles size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const chapterLabel = convertToArabicNumber(v.chapter + 1);
                const verseLabel = convertToArabicNumber(v.verse + 1);
                const refText = `${v.book} ${chapterLabel}:${verseLabel}`;
                router.push(`/share-preview?verse=${encodeURIComponent(v.text)}&ref=${encodeURIComponent(refText)}`);
              }}
              title="تصميم صورة"
            >
              <ImageIcon size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === vId ? null : vId); setNoteText(savedVerse?.note || ''); }} title="تفضيل">
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
              <textarea placeholder="اكتب تأملك الشخصي هنا..." value={noteText} onChange={(e) => setNoteText(e.target.value)} className={styles.noteTextArea} />
              <button className={styles.saveNoteBtn} onClick={() => handleUpdateVerse(v, savedVerse?.color || null)}>حفظ</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.card}>
        <h1 className={styles.heading}>الباحث الإنجيلي</h1>
        <form onSubmit={(e) => { e.preventDefault(); performSearch(); }} className={styles.controls}>
          <div className={styles.inputGroup}>
            <input type="text" value={inputTerm} onChange={e => setInputTerm(e.target.value)} className={styles.input} placeholder="أدخل كلمة البحث..." />
            <button type="submit" className={styles.searchButton}>
              <Search size={18} />
              <span>بحث الآن</span>
            </button>
          </div>
          <div className={styles.searchTypeSelector}>
            <div className={styles.originalRadioGroup}>
              <label className={searchType === 'literal' ? styles.activeLabel : ''}>
                <input type="radio" checked={searchType === 'literal'} onChange={() => setSearchType('literal')} />
                <Type size={16} />
                <span>بحث حرفي</span>
              </label>
              <label className={`${searchType === 'derivatives' ? styles.activeLabel : ''} ${timeLeft > 0 ? styles.disabledLabel : ''} `}>
                <input type="radio" checked={searchType === 'derivatives'} onChange={() => timeLeft === 0 && setSearchType('derivatives')} disabled={timeLeft > 0 && searchType !== 'derivatives'} />
                <Wand2 size={16} />
                <span>بحث بالمشتقات (AI)</span>
              </label>
              <label className={`${searchType === 'semantic' ? styles.activeLabel : ''} ${timeLeft > 0 ? styles.disabledLabel : ''}`}>
                <input type="radio" checked={searchType === 'semantic'} onChange={() => timeLeft === 0 && setSearchType('semantic')} disabled={timeLeft > 0 && searchType !== 'semantic'} />
                <Sparkles size={16} />
                <span>بحث بالمعنى (AI)</span>
              </label>
            </div>
            {timeLeft > 0 && <div className={styles.originalCooldownBadge}><span className={styles.originalTimerText}>متاح خلال <strong>{convertToArabicNumber(timeLeft)}</strong> ث</span></div>}

            {searchType === 'semantic' && (
              <div className={styles.semanticOptions}>
                <div className={styles.optionHeader}>
                  <Settings2 size={14} />
                  <span>إعدادات العرض:</span>
                </div>
                <div className={styles.optionControls}>
                  <button
                    type="button"
                    className={`${styles.optionToggle} ${semanticOptions.showTitle ? styles.activeOption : ''}`}
                    onClick={() => setSemanticOptions(prev => ({ ...prev, showTitle: !prev.showTitle }))}
                  >
                    {semanticOptions.showTitle ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>العنوان</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.optionToggle} ${semanticOptions.showReason ? styles.activeOption : ''}`}
                    onClick={() => setSemanticOptions(prev => ({ ...prev, showReason: !prev.showReason }))}
                  >
                    {semanticOptions.showReason ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>الشرح</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className={styles.filterGrid}>
            <CustomSelect label="العهد" options={[{ value: '', label: 'كل العهدين' }, { value: 'OT', label: 'العهد القديم' }, { value: 'NT', label: 'العهد الجديد' }]} value={selectedTestament} onChange={e => { setSelectedTestament(e.target.value); setSelectedBookIndex(''); setSelectedChapter(''); }} />
            <CustomSelect label="السفر" options={[{ value: '', label: 'كل الأسفار' }, ...filteredBooks.map(b => ({ value: booksList.indexOf(b).toString(), label: b.name }))]} value={selectedBookIndex} onChange={e => { setSelectedBookIndex(e.target.value); setSelectedChapter(''); }} />
            {selectedBookIndex !== '' && <CustomSelect label="الأصحاح" options={[{ value: '', label: 'الكل' }, ...Array.from({ length: chaptersCount }, (_, i) => ({ value: i.toString(), label: convertToArabicNumber(i + 1) }))]} value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} />}
          </div>
        </form>

        {aiStatus && (
          <div className={styles.loading} style={{ textAlign: 'center', padding: '12px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', marginBottom: '15px' }}>
            <span>⏳ {aiStatus}</span>
          </div>
        )}

        {searchInfo && searchType === 'derivatives' && (
          <div className={styles.derivativesWrapper}>
            <button type="button" className={styles.toggleDerivativesBtn} onClick={() => setShowDerivatives(!showDerivatives)}>{showDerivatives ? 'إخفاء خيارات المشتقات ▲' : 'تخصيص كلمات البحث ▼'}</button>
            {showDerivatives && (
              <div className={styles.searchInfoBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ margin: 0 }}><strong>الجذر المستخرج:</strong> {searchInfo.root}</p>
                  <div className={styles.selectionActionsSmall}>
                    <button type="button" onClick={() => setSelectedDerivatives(searchInfo.derivatives)}>تحديد الكل</button>
                    <button type="button" onClick={() => setSelectedDerivatives([])}>إلغاء الكل</button>
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
          {isLoading ? <div className={styles.loading}>جاري البحث، يرجى الانتظار...</div> : (
            ((searchType === 'semantic' ? displaySemanticResults.length > 0 : searchResults.length > 0) || searchQuery || selectedTestament || selectedBookIndex !== '') && (
              <div className={styles.resultsWrapper}>

                <div className={styles.resultsHeader}>
                  <div className={styles.headerInfo}>
                    <p className={styles.resultsCount}>
                      {searchType === 'semantic' ? `نتائج البحث الذكي: ${convertToArabicNumber(displaySemanticResults.reduce((acc, curr) => acc + curr.versesContent.length, 0))} آية` : `نتائج البحث: ${convertToArabicNumber(searchResults.length)} آية`}
                    </p>
                    {(searchType === 'semantic' ? displaySemanticResults.length > 0 : searchResults.length > 0) && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={copyAllResults} className={styles.copyAllBtn}>
                          <Copy size={14} />
                          <span>نسخ الكل</span>
                        </button>
                        <button onClick={shareAllResults} className={styles.copyAllBtn} style={{ borderColor: '#3b82f6' }}>
                          <Share2 size={14} />
                          <span>مشاركة الكل</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedVerses.length > 0 && (
                    <div className={styles.selectionActions}>
                      <button onClick={copySelected} className={styles.multiCopyBtn}>
                        <Copy size={16} />
                        <span>نسخ {convertToArabicNumber(selectedVerses.length)} آيات</span>
                      </button>
                      <button onClick={shareSelected} className={styles.multiShareBtn}>
                        <Share2 size={16} />
                        <span>مشاركة {convertToArabicNumber(selectedVerses.length)} آيات</span>
                      </button>
                      <button onClick={() => addSelectedToFavorites("#ffeb3b")} className={styles.multiFavBtn}>
                        <Heart size={16} />
                        <span>تفضيل الكل</span>
                      </button>
                      <button onClick={analyzeSelected} className={styles.multiAiBtn}>
                        <Sparkles size={16} />
                        <span>تحليل ذكي</span>
                      </button>
                      <button onClick={() => setSelectedVerses([])} className={styles.clearSelectionBtn}>إلغاء</button>
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
                                <span>نسخ المقطع</span>
                              </button>
                              <button
                                type="button"
                                className={styles.shareGroupBtn}
                                onClick={() => shareSemanticGroup(res)}
                              >
                                <Share2 size={14} />
                                <span>مشاركة المقطع</span>
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
                  </div>
                )}

                {searchType !== 'semantic' && (
                  <div className={styles.resultsContainer}>
                    {searchResults.map((v, i) => (
                      <VerseCard key={`${v.book_index}-${v.chapter}-${v.verse}`} v={v} />
                    ))}
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
  return (
    <Suspense fallback={<div>جاري التحميل...</div>}>
      <SearchContent />
    </Suspense>
  );
}
