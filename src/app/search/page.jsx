'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import styles from './search.module.css';
import { GoogleGenerativeAI } from "@google/generative-ai";
import _ from 'lodash';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
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
  return num.toString().split('').map(d => arabicNums[+d]).join('');
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

export default function BibleSearchPage() {
  const [user, setUser] = useState(null);
  const [inputTerm, setInputTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('literal');
  const [bibleData, setBibleData] = useState(null);
  const [bookNamesData, setBookNamesData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
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
  const resultsRef = useRef(null);

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

  const updateUserPoints = async (amount, reason) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalPoints: increment(amount), // توحيد الحقل إلى totalPoints
        pointsHistory: arrayUnion({
          points: amount, // توحيد الحقل إلى points
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
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
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
      const result = await model.generateContentStream(prompt);
      localStorage.setItem('last_gemini_search', Date.now().toString());
      setTimeLeft(60);

      let fullText = '';

      for await (const chunk of result.stream) {
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

      geminiCache[term] = currentInfo;
      return currentInfo;

    } catch (e) {
      console.error("Gemini Error:", e);
      toast.error(navigator.onLine ? "حدث خطأ في الاتصال بالذكاء الاصطناعي" : "تأكد من اتصالك بالإنترنت");
      const fallback = { derivatives: [normalizeArabicText(term)], root: 'غير معروف' };
      setSearchInfo(fallback);
      setSelectedDerivatives(fallback.derivatives);
      return fallback;
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
        await searchWithGeminiDerivatives(currentQuery);
      } else {
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
    const ref = `${rlm}(${v.book} ${chapterLabel}${lrm}:${rlm}${verseLabel})`;
    navigator.clipboard.writeText(`${v.text} ${ref}`);
    toast.success("تم نسخ الآية");
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
    
    let verseRange;
    if (sorted.length === 1) {
      verseRange = convertToArabicNumber(first.verse + 1);
    } else if (first.book_index === last.book_index && first.chapter === last.chapter) {
      const isConsecutive = (last.verse - first.verse) === (sorted.length - 1);
      verseRange = isConsecutive 
        ? `${convertToArabicNumber(first.verse + 1)} - ${convertToArabicNumber(last.verse + 1)}`
        : sorted.map(sv => convertToArabicNumber(sv.verse + 1)).join('، ');
    } else {
      verseRange = "شواهد متعددة";
    }

    const chapterLabel = convertToArabicNumber(first.chapter + 1);
    const ref = `${rlm}(${first.book} ${chapterLabel}${lrm}:${rlm}${verseRange})`;
    navigator.clipboard.writeText(`${text} ${ref}`);
    toast.success("تم نسخ الآيات المختارة");
    updateUserPoints(15, "مشاركة آية (Native Share)");
    setSelectedVerses([]);
  };

  const booksList = bookNamesData?.ar || [];
  const filteredBooks = selectedTestament ? booksList.filter(b => b.testament === selectedTestament) : booksList;
  const chaptersCount = (selectedBookIndex !== '' && bibleData) ? bibleData[parseInt(selectedBookIndex)].chapters.length : 0;

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.card}>
        <h1 className={styles.heading}>الباحث الإنجيلي</h1>
        <form onSubmit={(e) => { e.preventDefault(); performSearch(); }} className={styles.controls}>
          <div className={styles.inputGroup}>
            <input type="text" value={inputTerm} onChange={e => setInputTerm(e.target.value)} className={styles.input} placeholder="أدخل كلمة البحث..." />
            <button type="submit" className={styles.searchButton}>بحث الآن</button>
          </div>
          <div className={styles.searchTypeSelector}>
            <div className={styles.originalRadioGroup}>
              <label className={searchType === 'literal' ? styles.activeLabel : ''}><input type="radio" checked={searchType === 'literal'} onChange={() => setSearchType('literal')} /><span>بحث حرفي</span></label>
              <label className={`${searchType === 'derivatives' ? styles.activeLabel : ''} ${timeLeft > 0 ? styles.disabledLabel : ''} `}>
                <input type="radio" checked={searchType === 'derivatives'} onChange={() => timeLeft === 0 && setSearchType('derivatives')} disabled={timeLeft > 0 && searchType !== 'derivatives'} /><span>بحث بالمشتقات</span>
              </label>
            </div>
            {timeLeft > 0 && <div className={styles.originalCooldownBadge}><span className={styles.originalTimerText}>متاح خلال <strong>{convertToArabicNumber(timeLeft)}</strong> ث</span></div>}
          </div>
          <div className={styles.filterGrid}>
            <CustomSelect label="العهد" options={[{ value: '', label: 'كل العهدين' }, { value: 'OT', label: 'العهد القديم' }, { value: 'NT', label: 'العهد الجديد' }]} value={selectedTestament} onChange={e => { setSelectedTestament(e.target.value); setSelectedBookIndex(''); setSelectedChapter(''); }} />
            <CustomSelect label="السفر" options={[{ value: '', label: 'كل الأسفار' }, ...filteredBooks.map(b => ({ value: booksList.indexOf(b).toString(), label: b.name }))]} value={selectedBookIndex} onChange={e => { setSelectedBookIndex(e.target.value); setSelectedChapter(''); }} />
            {selectedBookIndex !== '' && <CustomSelect label="الأصحاح" options={[{ value: '', label: 'الكل' }, ...Array.from({ length: chaptersCount }, (_, i) => ({ value: i.toString(), label: convertToArabicNumber(i + 1) }))]} value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} />}
          </div>
        </form>

        {searchInfo && (
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
          {isLoading ? <div className={styles.loading}>جاري البحث, قد تطول مدة البحث نظراً لكثرة المشتقات العربية</div> : (
            (searchQuery || selectedTestament || selectedBookIndex !== '') && (
              <div className={styles.resultsWrapper}>
                <div className={styles.resultsHeader}>
                    <p className={styles.resultsCount}>نتائج البحث: {convertToArabicNumber(searchResults.length)} آية</p>
                    {selectedVerses.length > 0 && (
                     <div className={styles.selectionActions}>
                       <button onClick={copySelected} className={styles.multiCopyBtn}>نسخ {convertToArabicNumber(selectedVerses.length)} آيات</button>
                       <button onClick={() => setSelectedVerses([])} className={styles.clearSelectionBtn}>إلغاء</button>
                     </div>
                    )}
                </div>
                <div className={styles.resultsContainer}>
                  {searchResults.map((v, i) => {
                    const vId = `${v.book_index}-${v.chapter}-${v.verse}`;
                    const savedVerse = favouriteVerses[vId];
                    const isSelected = selectedVerses.some(sv => `${sv.book_index}-${sv.chapter}-${sv.verse}` === vId);
                    return (
                      <div key={vId} className={`${styles.verseCard} ${isSelected ? styles.selectedCard : ''}`} style={{ borderRight: savedVerse?.color ? `5px solid ${savedVerse.color}` : 'none' }} onClick={(e) => {
                          if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
                          setSelectedVerses(prev => isSelected ? prev.filter(sv => `${sv.book_index}-${sv.chapter}-${sv.verse}` !== vId) : [...prev, v]);
                        }}>
                        <div className={styles.verseText}>
                          <span className={styles.verseNumber}>{convertToArabicNumber(v.verse + 1)}</span>
                          {renderHighlightedText(v.text, searchQuery, savedVerse?.color)}
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
                            <button onClick={(e) => { e.stopPropagation(); handleCopy(v); }}>📋</button>
                            <button onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === vId ? null : vId); setNoteText(savedVerse?.note || ''); }}>
                              {savedVerse ? '💙' : '🤍'}
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
                              <button className={styles.saveNoteBtn} onClick={() => handleUpdateVerse(v, savedVerse?.color || null)}>حفظ الملحوظة</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}