'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import _ from 'lodash';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import styles from './search.module.css';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
const geminiCache = {}; 

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
  const selectedLabel = options.find(opt => opt.value.toString() === value.toString())?.label || `اختر ${label}`;

  const handleToggle = () => setIsOpen(!isOpen);
  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.customSelectWrapper} ref={selectRef}>
      <label className={styles.label}>{label}</label>
      <div className={`${styles.selectTrigger} ${isOpen ? styles.active : ''}`} onClick={handleToggle} dir={dir}>
        <span>{selectedLabel}</span>
        <div className={styles.arrow}></div>
      </div>
      <ul className={`${styles.dropdownMenu} ${isOpen ? styles.open : ''}`}>
        {options.map(option => (
          <li key={option.value} className={`${styles.dropdownItem} ${value.toString() === option.value.toString() ? styles.selected : ''}`} onClick={() => handleSelect(option.value)}>
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
  const [isLoading, setIsLoading] = useState(true);
  const [allVerses, setAllVerses] = useState([]);
  const [selectedTestament, setSelectedTestament] = useState('');
  const [selectedBookIndex, setSelectedBookIndex] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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
      } catch (e) { 
        setIsLoading(false); 
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!user) {
      setFavouriteVerses({});
      return;
    }
    return onSnapshot(doc(db, 'users', user.uid), s => setFavouriteVerses(s.data()?.favorites?.verses || {}));
  }, [user]);

  const searchWithGeminiDerivatives = async (term) => {
    if (!user) {
      setShowLoginPrompt(true);
      return { derivatives: [], extractedRoot: '' };
    }

    const COOLDOWN_TIME = 60 * 1000;
    const lastAskKey = `last_derivatives_ask_${user.uid}`;
    const lastAskTime = localStorage.getItem(lastAskKey);
    const currentTime = Date.now();

    if (lastAskTime) {
      const timePassed = currentTime - parseInt(lastAskTime);
      if (timePassed < COOLDOWN_TIME) {
        const remainingSeconds = Math.ceil((COOLDOWN_TIME - timePassed) / 1000);
        showNotification('error', `برجاء الانتظار ${remainingSeconds} ثانية للبحث بالمشتقات مرة أخرى`);
        return { derivatives: [], extractedRoot: 'انتظار...' };
      }
    }

    if (geminiCache[term]) return geminiCache[term];

    try {
      let responseText;
      const isWeb = typeof window !== 'undefined' && !window.Capacitor?.isNativePlatform;

      if (isWeb) {
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term }),
        });
        const data = await res.json();
        responseText = data.text;
      } else {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `أنت خبير لغوي في اللغة العربية. الكلمة هي: "${term}". قم باستخراج الجذر اللغوي والمشتقات الشاملة في صيغة JSON فقط: {"root": "...", "derivatives": ["...", "..."]}`;
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
      }

      localStorage.setItem(lastAskKey, Date.now().toString());

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error();
      const parsed = JSON.parse(jsonMatch[0]);
      const derivatives = (parsed.derivatives || []).map(d => normalizeArabicText(typeof d === 'string' ? d : d.word)).filter(d => d.length > 1);
      const finalResult = { derivatives, extractedRoot: parsed.root };
      geminiCache[term] = finalResult;
      return finalResult;
    } catch (e) { 
      return { derivatives: [normalizeArabicText(term)], extractedRoot: 'غير معروف' }; 
    }
  };

  useEffect(() => {
    const performSearch = async () => {
      if (allVerses.length === 0) return;
      
      if (searchType === 'derivatives' && !user && debouncedSearchQuery) {
        setShowLoginPrompt(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      let filtered = [...allVerses];

      if (selectedTestament) filtered = filtered.filter(v => v.testament === selectedTestament);
      if (selectedBookIndex !== '') filtered = filtered.filter(v => v.book_index.toString() === selectedBookIndex);
      if (selectedChapter !== '') filtered = filtered.filter(v => v.chapter.toString() === selectedChapter);

      if (debouncedSearchQuery) {
        if (searchType === 'derivatives') {
          const info = await searchWithGeminiDerivatives(debouncedSearchQuery);
          if (info.derivatives.length > 0) {
            const pattern = new RegExp(`(${info.derivatives.map(d => _.escapeRegExp(d)).join('|')})`, 'i');
            filtered = filtered.filter(v => pattern.test(normalizeArabicText(v.text)));
          }
          setSearchInfo(info);
        } else {
          const normQuery = normalizeArabicText(debouncedSearchQuery);
          filtered = filtered.filter(v => normalizeArabicText(v.text).includes(normQuery));
          setSearchInfo(null);
        }
      } else {
        setSearchInfo(null);
      }

      const isFilterActive = selectedTestament || selectedBookIndex !== '' || selectedChapter !== '';
      setSearchResults((debouncedSearchQuery || isFilterActive) ? filtered : []);
      setIsLoading(false);
    };

    performSearch();
  }, [debouncedSearchQuery, searchType, selectedTestament, selectedBookIndex, selectedChapter, allVerses, user]);

  const renderHighlightedText = (text, highlight) => {
    if (!highlight || !text) return text;
    let pattern;
    if (searchType === 'derivatives' && searchInfo?.derivatives) {
      const sorted = [...searchInfo.derivatives].sort((a,b) => b.length - a.length);
      pattern = `(${sorted.map(d => _.escapeRegExp(d)).join('|')})`;
    } else {
      pattern = `(${_.escapeRegExp(normalizeArabicText(highlight))})`;
    }
    const regex = new RegExp(pattern, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((p, i) => regex.test(normalizeArabicText(p)) ? <span key={i} className={styles.highlight}>{p}</span> : p)}
      </span>
    );
  };

  const handleCopy = (v) => {
    const ref = `(${v.book} ${convertToArabicNumber(v.chapter + 1)}:${convertToArabicNumber(v.verse + 1)})`;
    navigator.clipboard.writeText(`${v.text} ${ref}`).then(() => showNotification('copied', 'تم النسخ!'));
  };

  const booksList = bookNamesData?.ar || [];
  const filteredBooks = booksList.filter(b => !selectedTestament || b.testament === selectedTestament);
  const chaptersCount = (selectedBookIndex !== '' && bibleData) ? bibleData[selectedBookIndex].chapters.length : 0;

  return (
    <div className={styles.container} dir="rtl">
      {message.text && <div className={`${styles.messageBox} ${styles[message.type]}`}>{message.text}</div>}
      
      {showLoginPrompt && (
        <div className={styles.friendlyNotification}>
          <p>ميزة <strong>البحث بالمشتقات</strong> متاحة لأصدقاء "أجيوس" المسجلين فقط. انضم إلينا لتجربة بحث أعمق! ✨</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={() => window.location.href = '/intro'} style={{ background: 'var(--streak-gradient)', color: 'white', padding: '8px 15px', borderRadius: '5px' }}>إنضم لنا</button>
            <button onClick={() => setShowLoginPrompt(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--color-text-light)', padding: '8px 15px', borderRadius: '5px' }}>ليس الآن</button>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h1 className={styles.heading}>الباحث الإنجيلي</h1>
        <form onSubmit={e => { e.preventDefault(); setSearchQuery(inputTerm); }} className={styles.controls}>
          <div className={styles.inputGroup}>
            <input type="text" value={inputTerm} onChange={e => setInputTerm(e.target.value)} className={styles.input} placeholder="كلمة البحث..." />
            <button type="submit" className={styles.searchButton}>بحث</button>
          </div>
          <div className={styles.searchTypeSelector}>
            <label>
              <input type="radio" checked={searchType === 'literal'} onChange={() => setSearchType('literal')} /> 
              بحث حرفي
            </label>
            <label style={{ opacity: user ? 1 : 0.6 }}>
              <input 
                type="radio" 
                checked={searchType === 'derivatives'} 
                onChange={() => {
                  if (!user) {
                    setShowLoginPrompt(true);
                  } else {
                    setSearchType('derivatives');
                  }
                }} 
              /> 
              بحث بالمشتقات ✨
            </label>
          </div>
          <div className={styles.filterGrid}>
            <CustomSelect label="العهد" options={[{value:'', label:'كل العهدين'}, {value:'OT', label:'العهد القديم'}, {value:'NT', label:'العهد الجديد'}]} value={selectedTestament} onChange={e => {setSelectedTestament(e.target.value); setSelectedBookIndex(''); setSelectedChapter('');}} />
            <CustomSelect label="السفر" options={[{value:'', label:'كل الأسفار'}, ...filteredBooks.map(b => ({value: booksList.indexOf(b), label: b.name}))]} value={selectedBookIndex} onChange={e => {setSelectedBookIndex(e.target.value); setSelectedChapter('');}} />
            <CustomSelect label="الأصحاح" options={[{value:'', label:'الكل'}, ...Array.from({length: chaptersCount}, (_, i) => ({value: i, label: convertToArabicNumber(i+1)}))]} value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} />
          </div>
        </form>
        {searchInfo && <div className={styles.searchInfoBox}>
          <p><strong>الجذر:</strong> {searchInfo.extractedRoot}</p>
          <div className={styles.derivativesList}>{searchInfo.derivatives.map((d, i) => <span key={i} className={styles.derivativeItem}>{d}</span>)}</div>
        </div>}
        {isLoading ? <p className={styles.loading}>جاري المعالجة...</p> : (
          <div className={styles.resultsWrapper}>
            {searchResults.length > 0 && <p className={styles.resultsCount}>تم العثور على {convertToArabicNumber(searchResults.length)} آية</p>}
            <div className={styles.resultsContainer}>
              {searchResults.map((v, i) => (
                <div key={i} className={styles.verseCard}>
                  <div className={styles.verseText}>
                    <span className={styles.verseNumber}>{convertToArabicNumber(v.verse + 1)}</span>
                    {renderHighlightedText(v.text, debouncedSearchQuery)}
                  </div>
                  <div className={styles.verseReference}>
                    <span>{`${v.book} ${convertToArabicNumber(v.chapter + 1)}:${convertToArabicNumber(v.verse + 1)}`}</span>
                    <div className={styles.actions}>
                      <button onClick={() => handleCopy(v)}>نسخ</button>
                      <button onClick={() => {}}>{favouriteVerses[`${v.book_index}-${v.chapter}-${v.verse}`] ? '❤️' : '🤍'}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}