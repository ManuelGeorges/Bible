'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from './search.module.css';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Capacitor } from '@capacitor/core';
import _ from 'lodash';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBadge } from '../context/BadgeContext';
import { Type, Wand2, Sparkles, Settings2, Eye, EyeOff, Search, Copy, Heart } from 'lucide-react';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "AIzaSyAihaAWbI0BHz6zI6Q5JGNxnMPf0JQmZho";
const genAI = new GoogleGenerativeAI(API_KEY);
const geminiCache = {};

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
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
}

function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[ًٌٍَُِْ]/g, '')
    .replace(/[أآإ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ءئؤ]/g, '')
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

  const [semanticOptions, setSemanticOptions] = useState({
    showTitle: true,
    showReason: true
  });

  const resultsRef = useRef(null);

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
        const [bRes, nRes] = await Promise.all([fetch('./data/bibles/ar_svd.json'), fetch('./data/bookNames.json')]);
        const bJson = await bRes.json();
        const nJson = await nRes.json();
        setBibleData(bJson);
        setBookNamesData(nJson);
        const flattened = bJson.flatMap((book, bIdx) => {
          const meta = nJson?.ar?.[bIdx];
          return book.chapters.flatMap((ch, chIdx) => ch.map((v, vIdx) => ({
            text: v, book: meta.name, book_index: bIdx, chapter: chIdx, verse: vIdx, testament: meta.testament
          })));
        });
        setAllVerses(flattened);
        setIsLoading(false);
      } catch (e) { setIsLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const lastSearch = localStorage.getItem('last_gemini_search');
    if (lastSearch) {
      const diff = Date.now() - parseInt(lastSearch);
      if (diff < 60000) setTimeLeft(Math.ceil((60000 - diff) / 1000));
    }
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  useEffect(() => {
    if (searchType === 'derivatives' && selectedDerivatives.length > 0) {
      const suffixes = "(ه|ها|هم|هن|ك|كما|كم|كن|نا|ي|ت|تم|تن|وا|ون|ين|ات)?";
      const pattern = `(^|\\s|\\.|\\،|\\:|\\!|\\?)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})${suffixes}(?=\\s|\\.|\\،|\\:|\\!|\\?|$)`;
      const regex = new RegExp(pattern, 'i');

      let filtered = allVerses;
      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

      const finalFiltered = filtered.filter(v => regex.test(normalizeArabicText(v.text)));
      setSearchResults(finalFiltered);
    } else if (searchType === 'derivatives' && selectedDerivatives.length === 0) {
        setSearchResults([]);
    }
  }, [selectedDerivatives, allVerses, selectedTestament, selectedBookIndex, selectedChapter, searchType]);

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
          timestamp: new Date().toISOString()
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
        timestamp: Date.now()
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
          timestamp: Date.now()
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

  const searchWithGeminiDerivatives = async (term) => {
    if (geminiCache[term]) {
      setSearchInfo(geminiCache[term]);
      setSelectedDerivatives(geminiCache[term].derivatives);
      return geminiCache[term];
    }

    const lastSearch = localStorage.getItem('last_gemini_search');
    const now = Date.now();
    if (lastSearch && now - parseInt(lastSearch) < 60000) return null;

    let currentInfo = { root: '...', derivatives: [] };
    setShowDerivatives(true);

    try {
      const prompt = `أنت عالم لغوي متخصص في فقه اللغة العربية والصرف المعمق.
الكلمة المستهدفة: "${term}".
المطلوب: تحليل صرفي شامل يستخرج "كل صورة ممكنة" للكلمة في النص.
يجب أن تتضمن قائمة المشتقات (derivatives) ما يلي:
1. الجذر اللغوي الصحيح. "تنبيه": إذا كانت الكلمة (اسم علم أعجمي)، يمنع تماماً اشتقاق أفعال منها، وبدلاً من ذلك يتم التركيز على صور ورودها المختلفة بالسوابق واللواحق.
2. الأفعال: في حالات (الرفع، النصب، الجزم) بما يشمل حذف النون وحروف العلة، وتصريفها في الماضي والمضارع والأمر مع كافة الضمائر.
3. الضمائر المتصلة: شمول الأفعال المتصلة بضمائر المفعول به ونون الوقاية.
4. الأسماء المشتقة: (فاعل، مفعول، مصدر، مبالغة، تفضيل).
5. السوابق واللواحق لأسماء الأعلام والأفعال.
يجب أن يكون الرد بصيغة JSON فقط:
{
  "root": "الجذر أو 'اسم علم'",
  "derivatives": ["كلمة1", "كلمة2", "..."]
}`;

      let responseText = "";
      if (Capacitor.isNativePlatform()) {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
          const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }]
              })
          });
          const resultData = await res.json();
          responseText = resultData.candidates[0].content.parts[0].text;
      } else {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(prompt);
          responseText = result.response.text();
      }

      localStorage.setItem('last_gemini_search', Date.now().toString());
      setTimeLeft(60);

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          currentInfo.root = data.root;
          currentInfo.derivatives = _.uniq([normalizeArabicText(term), ...data.derivatives.map(d => normalizeArabicText(d))]);
          setSearchInfo(currentInfo);
          setSelectedDerivatives(currentInfo.derivatives);
      }

      geminiCache[term] = currentInfo;
      const nlpCount = parseInt(localStorage.getItem('nlp_search_count') || '0') + 1;
      localStorage.setItem('nlp_search_count', nlpCount.toString());
      if (nlpCount >= 3) await unlockBadge('logic_breaker');

      return currentInfo;
    } catch (e) {
      console.error("Gemini Error:", e);
      toast.error("حدث خطأ في الاتصال بالذكاء الاصطناعي");
      return null;
    }
  };

  const handleSemanticSearch = async (term) => {
    const lastSearch = localStorage.getItem('last_gemini_search');
    const now = Date.now();
    if (lastSearch && now - parseInt(lastSearch) < 60000) return null;

    try {
      const allowedBooks = bookNamesData?.ar?.map(b => b.name).join(', ') || '';
      const filterContext = `
        ${selectedTestament ? `العهد المطلوب البحث فيه: ${selectedTestament === 'OT' ? 'العهد القديم' : 'العهد الجديد'}` : ''}
        ${selectedBookIndex !== '' ? `السفر المطلوب البحث فيه: ${bookNamesData.ar[parseInt(selectedBookIndex)].name}` : ''}
      `;

      const prompt = `أنت محرك بحث لاهوتي ذكي ومفسر للكتاب المقدس لتطبيق "أجيوس". مهمتك هي فهم "المعنى" العميق وراء بحث المستخدم واستخراج شواهد مرتبطة به.

### [سؤال المستخدم]
"${term}"

### [سياق الفلترة]
${filterContext}

### [المطلوب]
استخراج أهم 5-7 مراجع دقيقة جداً (قصص، أمثال، أو آيات مباشرة) تشرح أو ترتبط بالمعنى المطلوب.

### [قواعد الاستجابة]
1. الرد JSON فقط بهذا التنسيق:
{
  "results": [
    {
      "book": "اسم السفر",
      "chapter": رقم الأصحاح,
      "verses": [رقم الآية, رقم الآية],
      "title": "عنوان قصير للمقطع (مثلاً: مثل السامري الصالح)",
      "reason": "لماذا هذا شاهد مرتبط ببحث المستخدم؟ (جملة واحدة ملهمة)"
    }
  ]
}

2. الالتزام بأسماء الأسفار من القائمة المتاحة حصراً: [${allowedBooks}]
3. إذا كان البحث عن صفة (مثل التواضع)، ابحث عن آيات مباشرة وعن قصص تجسد الصفة (مثل غسل الأرجل، ميلاد المسيح).
4. تأكد تماماً من صحة أرقام الآيات والأصحاحات ومناسبتها للسفر.`;

      let responseText = "";
      if (Capacitor.isNativePlatform()) {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
          const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }]
              })
          });
          const resultData = await res.json();
          responseText = resultData.candidates[0].content.parts[0].text;
      } else {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(prompt);
          responseText = result.response.text();
      }

      localStorage.setItem('last_gemini_search', Date.now().toString());
      setTimeLeft(60);

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid Format");

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

      setSemanticResults(enriched);
      return enriched;
    } catch (e) {
      console.error("Semantic Error:", e);
      toast.error("حدث خطأ في البحث الذكي، حاول مرة أخرى.");
      return null;
    }
  };

  const handleSearchPoints = () => {
    if (!user) return;
    const today = new Date().toLocaleDateString();
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
        setSemanticResults([]);
        const normQuery = normalizeArabicText(currentQuery);
        let filtered = allVerses;
        if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
        if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
        if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));

        filtered = filtered.filter(v => normalizeArabicText(v.text).includes(normQuery));
        setSearchResults(filtered);
        setSearchInfo(null);
        setSelectedDerivatives([]);
      }
    } else {
      setSemanticResults([]);
      let filtered = allVerses;
      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index === parseInt(selectedBookIndex));
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter === parseInt(selectedChapter));
      setSearchResults(filtered);
    }
    setIsLoading(false);
  };

  const renderHighlightedText = (text, highlight, verseColor) => {
    if (!highlight || !text) return <span style={{ backgroundColor: verseColor ? `${verseColor} 66` : 'transparent' }}>{text}</span>;
    let regex;
    if (searchType === 'derivatives' && selectedDerivatives.length > 0) {
      const suffixes = "(ه|ها|هم|هن|ك|كما|كم|كن|نا|ي|ت|تم|تن|وا|ون|ين|ات)?";
      const pattern = `(^|\\s|\\.|\\،|\\:|\\!|\\?)(${selectedDerivatives.map(d => _.escapeRegExp(d)).join('|')})${suffixes}(?=\\s|\\.|\\،|\\:|\\!|\\?|$)`;
      regex = new RegExp(pattern, 'gi');
    } else {
      regex = new RegExp(`(${_.escapeRegExp(normalizeArabicText(highlight))})`, 'gi');
    }
    const parts = text.split(regex);
    return (
      <span style={{ backgroundColor: verseColor ? `${verseColor} 66` : 'transparent', borderRadius: '4px', padding: '2px 0' }}>
        {parts.map((p, i) => {
          if (!p) return null;
          const normalizedP = normalizeArabicText(p);
          const isMatch = searchType === 'derivatives'
            ? selectedDerivatives.some(d => normalizedP.startsWith(d))
            : normalizedP === normalizeArabicText(highlight);
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
    updateUserPoints(15, "مشاركة آية (Native Share)");
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
    updateUserPoints(15, "مشاركة آية (Native Share)");
    setSelectedVerses([]);
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
            <button onClick={(e) => { e.stopPropagation(); handleCopy(v); }}>
              <Copy size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === vId ? null : vId); setNoteText(savedVerse?.note || ''); }}>
              {savedVerse ? <span style={{color: savedVerse.color}}>💙</span> : '🤍'}
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
            (searchQuery || selectedTestament || selectedBookIndex !== '') && (
              <div className={styles.resultsWrapper}>

                <div className={styles.resultsHeader}>
                    <p className={styles.resultsCount}>
                      {searchType === 'semantic' ? `نتائج البحث الذكي: ${convertToArabicNumber(semanticResults.reduce((acc, curr) => acc + curr.versesContent.length, 0))} آية` : `نتائج البحث: ${convertToArabicNumber(searchResults.length)} آية`}
                    </p>
                    {selectedVerses.length > 0 && (
                     <div className={styles.selectionActions}>
                       <button onClick={copySelected} className={styles.multiCopyBtn}>
                         <Copy size={16} />
                         <span>نسخ {convertToArabicNumber(selectedVerses.length)} آيات</span>
                       </button>
                       <button onClick={() => addSelectedToFavorites("#ffeb3b")} className={styles.multiFavBtn}>
                         <Heart size={16} />
                         <span>تفضيل الكل</span>
                       </button>
                       <button onClick={() => setSelectedVerses([])} className={styles.clearSelectionBtn}>إلغاء</button>
                     </div>
                    )}
                </div>

                {searchType === 'semantic' && semanticResults.length > 0 && (
                  <div className={styles.resultsContainer}>
                    {semanticResults.map((res, idx) => (
                      <div key={idx} className={styles.semanticGroupWrapper}>
                        <div className={styles.semanticGroupHeader}>
                          <div className={styles.semanticHeaderTop}>
                            {semanticOptions.showTitle && <h3 className={styles.semanticTitle}>{res.title}</h3>}
                            <button
                              type="button"
                              className={styles.selectAllInCardBtn}
                              onClick={() => {
                                const allInCard = res.versesContent;
                                setSelectedVerses(prev => {
                                  const others = prev.filter(sv => !allInCard.some(v => `${v.book_index}-${v.chapter}-${v.verse}` === `${sv.book_index}-${sv.chapter}-${sv.verse}`));
                                  return [...others, ...allInCard];
                                });
                                toast.success("تم تحديد المقطع بالكامل");
                              }}
                            >
                              تحديد المقطع
                            </button>
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
