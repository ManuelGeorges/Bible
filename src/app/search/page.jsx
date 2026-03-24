'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import styles from './search.module.css';
import { GoogleGenerativeAI } from "@google/generative-ai";
import _ from 'lodash';

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
    <div className={styles.customSelectWrapper} ref={selectRef} style={{ zIndex: isOpen ? 9999 : 1 }}>
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

export default function BibleSearchPage({ user }) {
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
  const [timeLeft, setTimeLeft] = useState(0);

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
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), s => setFavouriteVerses(s.data()?.favorites?.verses || {}));
  }, [user]);

  const searchWithGeminiDerivatives = async (term) => {
    if (geminiCache[term]) return geminiCache[term];
    const lastSearch = localStorage.getItem('last_gemini_search');
    const now = Date.now();
    if (lastSearch && now - parseInt(lastSearch) < 60000) return null;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const prompt = `أنت خبير لغوي في الصرف العربي والبحث الكتابي. الكلمة: "${term}". استخرج الجذر وقائمة شاملة جداً من المشتقات (أفعال بكل الضمائر، أسماء، جموع، صيغ مبالغة). الرد JSON فقط: {"root": "...", "derivatives": ["...", "..."]}`;

      const result = await model.generateContent(prompt);
      localStorage.setItem('last_gemini_search', Date.now().toString());
      setTimeLeft(60);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error();
      const parsed = JSON.parse(jsonMatch[0]);
      
      const derivatives = _.uniq([
        normalizeArabicText(term),
        ...(parsed.derivatives || []).map(d => normalizeArabicText(typeof d === 'string' ? d : d.word))
      ]).filter(d => d.length > 1);

      const finalResult = { derivatives, extractedRoot: parsed.root };
      geminiCache[term] = finalResult;
      return finalResult;
    } catch (e) { 
      return { derivatives: [normalizeArabicText(term)], extractedRoot: 'غير معروف' }; 
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputTerm.trim().length >= 2) {
      setSearchQuery(inputTerm.trim());
    } else {
      setSearchQuery('');
    }
  };

  useEffect(() => {
    const performSearch = async () => {
      const isFilterActive = selectedTestament !== '' || selectedBookIndex !== '' || selectedChapter !== '';
      
      if (allVerses.length === 0 || (!searchQuery && !isFilterActive)) {
        setSearchResults([]);
        return;
      }
      
      setIsLoading(true);
      let filtered = allVerses;

      if (selectedTestament) {
        filtered = filtered.filter(v => v.testament === selectedTestament);
      }
      
      if (selectedBookIndex !== '') {
        const bookIdxNum = parseInt(selectedBookIndex);
        filtered = filtered.filter(v => v.book_index === bookIdxNum);
      }

      if (selectedChapter !== '') {
        const chIdxNum = parseInt(selectedChapter);
        filtered = filtered.filter(v => v.chapter === chIdxNum);
      }

      if (searchQuery && searchQuery.length >= 2) {
        if (searchType === 'derivatives') {
          const info = await searchWithGeminiDerivatives(searchQuery);
          if (info) {
            const pattern = new RegExp(`(${info.derivatives.map(d => _.escapeRegExp(d)).join('|')})`, 'i');
            filtered = filtered.filter(v => pattern.test(normalizeArabicText(v.text)));
            setSearchInfo(info);
          } else {
            setIsLoading(false);
            return;
          }
        } else {
          const normQuery = normalizeArabicText(searchQuery);
          filtered = filtered.filter(v => normalizeArabicText(v.text).includes(normQuery));
          setSearchInfo(null);
        }
      } else {
        setSearchInfo(null);
      }

      setSearchResults(filtered);
      setIsLoading(false);
    };

    performSearch();
  }, [searchQuery, searchType, selectedTestament, selectedBookIndex, selectedChapter, allVerses]);

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
    navigator.clipboard.writeText(`${v.text} ${ref}`);
  };

  const booksList = bookNamesData?.ar || [];
  const filteredBooks = booksList.filter(b => !selectedTestament || b.testament === selectedTestament);
  const chaptersCount = (selectedBookIndex !== '' && bibleData) ? bibleData[parseInt(selectedBookIndex)].chapters.length : 0;

  const displayResults = useMemo(() => searchResults.slice(0, 300), [searchResults]);

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.card}>
        <h1 className={styles.heading}>الباحث الإنجيلي</h1>
        <form onSubmit={handleSearchSubmit} className={styles.controls}>
          <div className={styles.inputGroup}>
            <input 
              type="text" 
              value={inputTerm} 
              onChange={e => setInputTerm(e.target.value)} 
              className={styles.input} 
              placeholder="أدخل كلمة البحث (حرفين على الأقل)..." 
            />
            <button type="submit" className={styles.searchButton}>بحث الآن</button>
          </div>
          
          <div className={styles.searchTypeSelector}>
            <div className={styles.originalRadioGroup}>
              <label className={searchType === 'literal' ? styles.activeLabel : ''}>
                <input type="radio" checked={searchType === 'literal'} onChange={() => setSearchType('literal')} />
                <span>بحث حرفي</span>
              </label>
              <label className={`${searchType === 'derivatives' ? styles.activeLabel : ''} ${timeLeft > 0 ? styles.disabledLabel : ''}`}>
                <input 
                  type="radio" 
                  checked={searchType === 'derivatives'} 
                  onChange={() => timeLeft === 0 && setSearchType('derivatives')}
                  disabled={timeLeft > 0 && searchType !== 'derivatives'}
                />
                <span>بحث بالمشتقات</span>
              </label>
            </div>
            {timeLeft > 0 && (
              <div className={styles.originalCooldownBadge}>
                <div className={styles.originalProgressRing} style={{ '--progress': `${(timeLeft / 60) * 360}deg` }}></div>
                <span className={styles.originalTimerText}>متاح خلال <strong>{convertToArabicNumber(timeLeft)}</strong> ث</span>
              </div>
            )}
          </div>

          <div className={styles.filterGrid}>
            <CustomSelect 
              label="العهد" 
              options={[{value:'', label:'كل العهدين'}, {value:'OT', label:'العهد القديم'}, {value:'NT', label:'العهد الجديد'}]} 
              value={selectedTestament} 
              onChange={e => {setSelectedTestament(e.target.value); setSelectedBookIndex(''); setSelectedChapter('');}} 
            />
            
            {selectedTestament && (
              <CustomSelect 
                label="السفر" 
                options={[{value:'', label:'كل الأسفار'}, ...filteredBooks.map(b => ({value: booksList.indexOf(b).toString(), label: b.name}))]} 
                value={selectedBookIndex} 
                onChange={e => {setSelectedBookIndex(e.target.value); setSelectedChapter('');}} 
              />
            )}

            {selectedBookIndex !== '' && (
              <CustomSelect 
                label="الأصحاح" 
                options={[{value:'', label:'الكل'}, ...Array.from({length: chaptersCount}, (_, i) => ({value: i.toString(), label: convertToArabicNumber(i+1)}))]} 
                value={selectedChapter} 
                onChange={e => setSelectedChapter(e.target.value)} 
              />
            )}
          </div>
        </form>

        {searchInfo && <div className={styles.searchInfoBox}>
          <p><strong>الجذر:</strong> {searchInfo.extractedRoot}</p>
          <div className={styles.derivativesList}>{searchInfo.derivatives.map((d, i) => <span key={i} className={styles.derivativeItem}>{d}</span>)}</div>
        </div>}

        {isLoading && (searchQuery || selectedTestament || selectedBookIndex !== '') ? <div className={styles.loading}>جاري البحث...</div> : (
          (searchQuery || selectedTestament || selectedBookIndex !== '') && (
            <div className={styles.resultsWrapper}>
              <p className={styles.resultsCount}>نتائج البحث: {convertToArabicNumber(searchResults.length)} آية</p>
              <div className={styles.resultsContainer}>
                {displayResults.map((v, i) => (
                  <div key={i} className={styles.verseCard}>
                    <div className={styles.verseText}>
                      <span className={styles.verseNumber}>{convertToArabicNumber(v.verse + 1)}</span>
                      {renderHighlightedText(v.text, searchQuery)}
                    </div>
                    <div className={styles.verseReference}>
                      <span className={styles.referenceLink}>{`${v.book} ${convertToArabicNumber(v.chapter + 1)}:${convertToArabicNumber(v.verse + 1)}`}</span>
                      <div className={styles.actions}>
                        <button onClick={() => handleCopy(v)}>📋</button>
                        <button onClick={() => {}}>{favouriteVerses[`${v.book_index}-${v.chapter}-${v.verse}`] ? '💙' : '🤍'}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}