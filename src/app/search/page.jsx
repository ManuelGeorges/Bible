'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import Fuse from 'fuse.js';
import _ from 'lodash';
import { db } from '/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import styles from './search.module.css';


const geminiCache = {};

function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d]).join('');
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

  const handleClickOutside = useCallback((event) => {
    if (selectRef.current && !selectRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Corrected the typo here
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  return (
    <div className={styles.customSelectWrapper} ref={selectRef}>
      <label className={styles.label}>{label}</label>
      <div
        className={`${styles.selectTrigger} ${isOpen ? styles.active : ''}`}
        onClick={handleToggle}
        dir={dir}
      >
        <span>{selectedLabel}</span>
        <div className={styles.arrow}></div>
      </div>
      <ul className={`${styles.dropdownMenu} ${isOpen ? styles.open : ''}`}>
        {options.map(option => (
          <li
            key={option.value}
            className={`${styles.dropdownItem} ${value.toString() === option.value.toString() ? styles.selected : ''}`}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizeArabicText(text) {
  return text
    .replace(/[ًٌٍَُِْ]/g, '')
    .replace(/[أآإ]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ءئؤ]/g, '')
    .trim();
}

function searchLiteral(searchTerm, verses) {
  const normalizedTerm = normalizeArabicText(searchTerm);
  return verses.filter(verse =>
    normalizeArabicText(verse.text).includes(normalizedTerm)
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
  const [error, setError] = useState(null);
  const [allVerses, setAllVerses] = useState([]);
  const [selectedTestament, setSelectedTestament] = useState('');
  const [selectedBookIndex, setSelectedBookIndex] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const language = 'ar';
  const dir = 'rtl';
  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedVerses, setSelectedVerses] = useState(new Set());
  const [isMobileSelectionMode, setIsMobileSelectionMode] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const didHoldRef = useRef(false);
  const resultsRef = useRef(null);

  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage({ type: '', text: '' });
    }, 3000);
  };

  const getBookName = useCallback((index) => {
    return bookNamesData?.[language]?.[index]?.name || 'Unknown Book';
  }, [bookNamesData, language]);

  const copyTextToClipboard = async (textToCopy) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const el = document.createElement('textarea');
        el.value = textToCopy;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      showNotification('copied', 'تم النسخ بنجاح!');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showNotification('error', 'فشل النسخ!');
    }
  };

  const handleCopySingleVerse = (verse) => {
    const reference = `(${verse.book} ${language === 'ar' ? convertToArabicNumber(verse.chapter + 1) : verse.chapter + 1}:${language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1})`;
    const textToCopy = `${verse.text} ${reference}`;
    copyTextToClipboard(textToCopy);
  };

  const handleToggleFavourite = async (verse) => {
    if (!user) {
      showNotification('error', 'يرجى تسجيل الدخول لحفظ الآيات المفضلة.');
      return;
    }
    const verseKey = `${verse.book_index}-${verse.chapter}-${verse.verse}`;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      const currentFavourites = docSnap.exists() ? docSnap.data().favorites?.verses || {} : {};
      
      let newFavourites = { ...currentFavourites };
      
      if (newFavourites[verseKey]) {
        delete newFavourites[verseKey];
        showNotification('favourite', 'تمت الإزالة من المفضلة.');
      } else {
        const today = new Date().toLocaleDateString('en-CA');
        newFavourites[verseKey] = {
          type: 'verse',
          verseKey,
          text: verse.text,
          bookName: verse.book,
          chapter: verse.chapter,
          verseIndex: verse.verse,
          dateAdded: today,
          language: language,
        };
        showNotification('favourite', 'تمت الإضافة للمفضلة!');
      }

      await setDoc(userDocRef, { favorites: { verses: newFavourites } }, { merge: true });
    } catch (error) {
      console.error("Error toggling favourite status:", error);
      showNotification('error', 'فشل في تحديث المفضلة.');
    }
  };

  const handleVerseSelection = (verseKey) => {
    setSelectedVerses(prevSelected => {
      const newSelection = new Set(prevSelected);
      if (newSelection.has(verseKey)) {
        newSelection.delete(verseKey);
      } else {
        newSelection.add(verseKey);
      }
      if (newSelection.size === 0 && isMobileSelectionMode) {
        setIsMobileSelectionMode(false);
      }
      return newSelection;
    });
  };

  const handleVerseTouchStart = (verseKey) => {
    if (!isSmallScreen) return;
    didHoldRef.current = false;
    setPressTimer(
      setTimeout(() => {
        setIsMobileSelectionMode(true);
        setSelectedVerses(new Set([verseKey]));
        didHoldRef.current = true;
        setPressTimer(null);
      }, 500)
    );
  };

  const handleVerseTouchEnd = (verseKey) => {
    if (!isSmallScreen) return;
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    if (didHoldRef.current) {
      didHoldRef.current = false;
      return;
    }
    if (isMobileSelectionMode) {
      handleVerseSelection(verseKey);
    }
  };

  const handleCopySelectedVerses = () => {
    if (selectedVerses.size === 0) return;
    const compiledText = Array.from(selectedVerses)
      .map(verseKey => {
        const verse = searchResults.find(v => `${v.book_index}-${v.chapter}-${v.verse}` === verseKey);
        if (!verse) return '';
        const reference = `(${verse.book} ${language === 'ar' ? convertToArabicNumber(verse.chapter + 1) : verse.chapter + 1}:${language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1})`;
        return `${verse.text} ${reference}`;
      })
      .filter(text => text.length > 0)
      .join('\n\n');
    copyTextToClipboard(compiledText);
    setSelectedVerses(new Set());
    setIsMobileSelectionMode(false);
  };

  const handleFavouriteSelectedVerses = async () => {
    if (selectedVerses.size === 0 || !user) {
      showNotification('error', 'يرجى تسجيل الدخول أو تحديد آيات لإضافتها.');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      const currentFavourites = docSnap.exists() ? docSnap.data().favorites?.verses || {} : {};
      const today = new Date().toLocaleDateString('en-CA');
      let newFavourites = { ...currentFavourites };
      
      let versesToAdd = [];
      let versesToRemove = [];

      selectedVerses.forEach(verseKey => {
        const verse = searchResults.find(v => `${v.book_index}-${v.chapter}-${v.verse}` === verseKey);
        if (verse) {
          if (newFavourites[verseKey]) {
            delete newFavourites[verseKey];
            versesToRemove.push(verseKey);
          } else {
            newFavourites[verseKey] = {
              type: 'verse',
              verseKey,
              text: verse.text,
              bookName: verse.book,
              chapter: verse.chapter,
              verseIndex: verse.verse,
              dateAdded: today,
              language: language,
            };
            versesToAdd.push(verseKey);
          }
        }
      });
      await setDoc(userDocRef, { favorites: { verses: newFavourites } }, { merge: true });
      showNotification('favourite', `تم تحديث المفضلة. أُضيفت ${versesToAdd.length} وأُزيلت ${versesToRemove.length}.`);
      setSelectedVerses(new Set());
      setIsMobileSelectionMode(false);
    } catch (error) {
      console.error("Error adding verses to favourites:", error);
      showNotification('error', 'فشل في إضافة الآيات للمفضلة.');
    }
  };

  const handleCopyAllResults = () => {
    if (searchResults.length === 0) return;
    const compiledText = searchResults
      .map(verse => {
        const reference = `(${verse.book} ${language === 'ar' ? convertToArabicNumber(verse.chapter + 1) : verse.chapter + 1}:${language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1})`;
        return `${verse.text} ${reference}`;
      }).join('\n\n');
    copyTextToClipboard(compiledText);
  };

  const handleFavouriteAllResults = async () => {
    if (searchResults.length === 0 || !user) {
      showNotification('error', 'يرجى تسجيل الدخول أو البحث عن آيات لإضافتها.');
      return;
    }
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      const currentFavourites = docSnap.exists() ? docSnap.data().favorites?.verses || {} : {};
      const today = new Date().toLocaleDateString('en-CA');
      let newFavourites = { ...currentFavourites };
      
      searchResults.forEach(verse => {
        const verseKey = `${verse.book_index}-${verse.chapter}-${verse.verse}`;
        newFavourites[verseKey] = {
          type: 'verse',
          verseKey,
          text: verse.text,
          bookName: verse.book,
          chapter: verse.chapter,
          verseIndex: verse.verse,
          dateAdded: today,
          language: language,
        };
      });

      await setDoc(userDocRef, { favorites: { verses: newFavourites } }, { merge: true });
      showNotification('favourite', `تم إضافة ${searchResults.length} آية إلى المفضلة!`);
    } catch (error) {
      console.error("Error adding all results to favourites:", error);
      showNotification('error', 'فشل في إضافة كل النتائج للمفضلة.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bibleResponse, bookNamesResponse] = await Promise.all([
          fetch('/data/bibles/ar_svd.json'),
          fetch('/data/bookNames.json')
        ]);

        if (!bibleResponse.ok || !bookNamesResponse.ok) {
          throw new Error('فشل في جلب البيانات من المسارات المحلية.');
        }

        const bibleJson = await bibleResponse.json();
        const bookNamesJson = await bookNamesResponse.json();

        setBibleData(bibleJson);
        setBookNamesData(bookNamesJson);

        const flattenedVerses = bibleJson.flatMap((book, bookIndex) => {
          const bookMeta = bookNamesJson?.[language]?.[bookIndex];
          if (!bookMeta) return [];

          return book.chapters.flatMap((chapter, chapterIndex) =>
            chapter.map((verseText, verseIndex) => ({
              text: verseText,
              book: bookMeta.name,
              book_index: bookIndex,
              chapter: chapterIndex,
              verse: verseIndex,
              testament: bookMeta.testament,
            }))
          );
        });

        setAllVerses(flattenedVerses);
        setIsLoading(false);
      } catch (err) {
        setError('فشل في جلب البيانات. تأكد من وجود ملفات البيانات في المسار public/data/bibles/ و public/data/.');
        setIsLoading(false);
        console.error(err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!user) {
      setFavouriteVerses({});
      return;
    }
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().favorites) {
        setFavouriteVerses(docSnap.data().favorites.verses || {});
      } else {
        setFavouriteVerses({});
      }
    }, (err) => {
      console.error("Firebase listener failed:", err);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(inputTerm.trim());
  };

  const searchWithGeminiDerivatives = async (searchTerm) => {
    // Check if the result is already in the cache
    if (geminiCache[searchTerm]) {
      console.log('Returning cached result for Gemini search.');
      return geminiCache[searchTerm];
    }
  
    if (!searchTerm || searchTerm.length < 2) return { results: [], searchInfo: null };
  
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `استخرج الجذر اللغوي للكلمة العربية "${searchTerm}" ثم أعد لي قائمة شاملة بكل المشتقات وتصريفات الأفعال الممكنة لهذا الجذر. أرجع لي الإجابة بتنسيق JSON فقط، لا تضف أي نص توضيحي آخر. يجب أن يحتوي الرد على حقلين: "root" (للجذر المستخرج) و "derivatives" (لقائمة المشتقات والتصريفات).`
        }),
      });
  
      if (!response.ok) {
        throw new Error('فشل في الحصول على المشتقات من الخادم. يرجى المحاولة لاحقًا.');
      }
  
      const data = await response.json();
      let geminiResponseString = data.response.trim();

      const firstBrace = geminiResponseString.indexOf('{');
      const lastBrace = geminiResponseString.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        geminiResponseString = geminiResponseString.substring(firstBrace, lastBrace + 1);
      } else {
        throw new Error('لم يتم العثور على كائن JSON صالح في الاستجابة.');
      }
  
      const geminiResponse = JSON.parse(geminiResponseString);
      const derivatives = geminiResponse.derivatives;
      const root = geminiResponse.root;
  
      const searchInfo = {
        originalTerm: searchTerm,
        extractedRoot: root,
        derivatives: derivatives,
      };
      
      const normalizedDerivatives = derivatives.map(d => normalizeArabicText(d)).join('|');
      const derivativePattern = new RegExp(`(?:\\b)${normalizedDerivatives}(?:\\b)`, 'i');
  
      const results = allVerses.filter(verse => {
        const normalizedVerseText = normalizeArabicText(verse.text);
        return derivativePattern.test(normalizedVerseText);
      });
      
      const result = { results, searchInfo };
      geminiCache[searchTerm] = result; // Store result in cache
      return result;

    } catch (error) {
      console.error('Error in Gemini derivative search:', error);
      showNotification('error', `فشل البحث بالمشتقات. قد تكون الخدمة غير متاحة. سيتم استخدام البحث الحرفي بدلاً من ذلك.`);
      const fallbackResults = allVerses.filter(verse => 
        normalizeArabicText(verse.text).includes(normalizeArabicText(searchTerm))
      );
      return { results: fallbackResults, searchInfo: null };
    }
  };

  useEffect(() => {
    const performSearch = async () => {
      if (allVerses.length === 0) return;
      
      // Clear results and info if search query is empty
      if (!debouncedSearchQuery && !selectedBookIndex && !selectedChapter) {
        setSearchResults([]);
        setSearchInfo(null);
        return;
      }
      
      let filteredVerses = allVerses;
      
      if (selectedTestament) {
        filteredVerses = filteredVerses.filter(verse => verse.testament === selectedTestament);
      }

      if (selectedBookIndex !== '') {
        filteredVerses = filteredVerses.filter(verse => verse.book_index.toString() === selectedBookIndex.toString());
      }

      if (selectedChapter !== '') {
        filteredVerses = filteredVerses.filter(verse => verse.chapter.toString() === selectedChapter.toString());
      }
      
      let results = [];
      let searchInfoData = null;
      
      if (debouncedSearchQuery.length > 0) {
        if (searchType === 'derivatives') {
          setIsLoading(true);
          const searchResult = await searchWithGeminiDerivatives(debouncedSearchQuery);
          results = searchResult.results;
          searchInfoData = searchResult.searchInfo;
          setIsLoading(false);
        } else {
          results = searchLiteral(debouncedSearchQuery, filteredVerses);
        }
      } else {
        results = filteredVerses;
      }
      
      setSearchResults(results);
      setSearchInfo(searchInfoData);
      
      if (results.length > 0 && resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    performSearch();
  }, [debouncedSearchQuery, searchType, allVerses, selectedTestament, selectedBookIndex, selectedChapter]);

  const renderHighlightedText = (text, highlight) => {
    if (!highlight) return text;
    
    if (searchType === 'derivatives' && searchInfo) {
      try {
        const derivatives = searchInfo.derivatives;
        let highlightedText = text;
        
        const sortedDerivatives = _.sortBy(derivatives, 'length').reverse();

        sortedDerivatives.forEach(derivative => {
          const normalizedDerivative = normalizeArabicText(derivative);
          const regex = new RegExp(`(?:\\b)(${derivative}|${normalizedDerivative})(?:\\b)`, 'gi');
          highlightedText = highlightedText.replace(regex, `<span class="${styles.highlight}">$1</span>`);
        });
        
        return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
      } catch (error) {
        console.error('Error highlighting derivatives:', error);
        const normalizedHighlight = normalizeArabicText(highlight);
        const regex = new RegExp(`(?:\\b)(${highlight}|${normalizedHighlight})(?:\\b)`, 'gi');
        const highlightedText = text.replace(regex, `<span class="${styles.highlight}">$1</span>`);
        return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
      }
    } else {
      const normalizedHighlight = normalizeArabicText(highlight);
      const regex = new RegExp(`(?:\\b)(${highlight}|${normalizedHighlight})(?:\\b)`, 'gi');
      const highlightedText = text.replace(regex, `<span class="${styles.highlight}">$1</span>`);
      return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
    }
  };
  
  const allBooks = bookNamesData ? bookNamesData[language] : [];
  
  const availableBooks = allBooks.filter(book => {
    if (!selectedTestament) return true;
    return book.testament === selectedTestament;
  });

  const availableChapters = selectedBookIndex !== '' && bibleData ? bibleData[selectedBookIndex].chapters.map((_, index) => index) : [];

  return (
    <div className={styles.container} dir={dir}>
      {message.type && (
        <div className={`${styles.messageBox} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}
      <div className={styles.card}>
        <h1 className={styles.heading}>الباحث الإنجيلي</h1>
        <p className={styles.description}>
          ابحث في الكتاب المقدس باللغة العربية عن آيات أو كلمات محددة، مع خيارات البحث الحرفي أو البحث بالمشتقات لتحديد العهد أو السفر أو الأصحاح لتصفية نتائج البحث.
        </p>
        <form onSubmit={handleSearch} className={styles.controls}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={inputTerm}
              onChange={(e) => setInputTerm(e.target.value)}
              className={styles.input}
              placeholder="ابحث بكلمة أو جملة..."
            />
            <button type="submit" className={styles.searchButton}>بحث</button>
          </div>
          <div className={styles.searchTypeSelector}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                value="literal"
                checked={searchType === 'literal'}
                onChange={() => setSearchType('literal')}
              />
              بحث حرفي
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                value="derivatives"
                checked={searchType === 'derivatives'}
                onChange={() => setSearchType('derivatives')}
              />
              بحث بالمشتقات
            </label>
          </div>
          <div className={styles.inputGroup}>
            <CustomSelect
              label="العهد"
              options={[{ value: '', label: 'كل العهدين' }, { value: 'OT', label: 'العهد القديم' }, { value: 'NT', label: 'العهد الجديد' }]}
              value={selectedTestament}
              onChange={(e) => { setSelectedTestament(e.target.value); setSelectedBookIndex(''); setSelectedChapter(''); }}
              dir={dir}
            />
            <CustomSelect
              label="السفر"
              options={[{ value: '', label: 'كل الأسفار' }, ...availableBooks.map(book => ({ value: allBooks.indexOf(book), label: book.name }))]}
              value={selectedBookIndex}
              onChange={(e) => { setSelectedBookIndex(e.target.value); setSelectedChapter(''); }}
              dir={dir}
            />
            <CustomSelect
              label="الأصحاح"
              options={[{ value: '', label: 'كل الأصحاحات' }, ...availableChapters.map(chapterIndex => ({ value: chapterIndex, label: convertToArabicNumber(chapterIndex + 1) }))]}
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              dir={dir}
            />
          </div>
        </form>
        
        {searchInfo && searchType === 'derivatives' && (
          <div className={styles.searchInfoBox}>
            <h3>معلومات البحث بالمشتقات:</h3>
            <p><strong>الكلمة المدخلة:</strong> {searchInfo.originalTerm}</p>
            <p><strong>الجذر المستخرج:</strong> {searchInfo.extractedRoot}</p>
            <div>
              <strong>المشتقات المولدة:</strong>
              <div className={styles.derivativesList}>
                {searchInfo.derivatives.map((derivative, index) => (
                  <span key={index} className={styles.derivativeItem}>{derivative}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {isLoading && <p className={styles.loading}>يتم تحميل البيانات...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!isLoading && !error && (
          <div className={styles.resultsWrapper} ref={resultsRef}>
            {searchResults.length > 0 && debouncedSearchQuery && (
              <p className={styles.resultsCount}>
                {`تم العثور على ${convertToArabicNumber(searchResults.length)} نتيجة لـ "${debouncedSearchQuery}" ${searchType === 'derivatives' ? '(بحث بالمشتقات)' : '(بحث حرفي)'}`}
              </p>
            )}
            {searchResults.length === 0 && debouncedSearchQuery && (
              <p className={styles.noResults}>
                لم يتم العثور على نتائج لـ "{debouncedSearchQuery}" {searchType === 'derivatives' ? '(بحث بالمشتقات)' : '(بحث حرفي)'}
              </p>
            )}
            {searchResults.length > 0 && (
              <>
                <div className={styles.batchActions}>
                  <button onClick={handleCopyAllResults}>
                    نسخ كل النتائج ({convertToArabicNumber(searchResults.length)})
                  </button>
                  <button onClick={handleFavouriteAllResults}>
                    إضافة كل النتائج للمفضلة ({convertToArabicNumber(searchResults.length)})
                  </button>
                </div>
                {selectedVerses.size > 0 && (
                  <div className={styles.batchActions}>
                    <button onClick={handleCopySelectedVerses}>
                      نسخ الآيات المحددة ({convertToArabicNumber(selectedVerses.size)})
                    </button>
                  </div>
                )}
                <div className={styles.resultsContainer}>
                  {searchResults.map((verse, index) => {
                    const verseKey = `${verse.book_index}-${verse.chapter}-${verse.verse}`;
                    const isFavourite = favouriteVerses[verseKey] !== undefined;
                    const isSelected = selectedVerses.has(verseKey);

                    const verseProps = {};
                    if (isSmallScreen) {
                      verseProps.onTouchStart = () => handleVerseTouchStart(verseKey);
                      verseProps.onTouchEnd = () => handleVerseTouchEnd(verseKey);
                    } else {
                      verseProps.onClick = () => handleVerseSelection(verseKey);
                    }

                    return (
                      <div
                        key={index}
                        className={`${styles.verseCard} ${isSelected ? styles.selected : ''}`}
                        {...verseProps}
                      >
                        <div className={styles.verseText}>
                          <span className={styles.verseNumber}>
                            {language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1}
                          </span>
                          {renderHighlightedText(verse.text, debouncedSearchQuery)}
                        </div>
                        <div className={styles.verseReference}>
                          <span className={styles.referenceLink}>
                            {`${verse.book} ${language === 'ar' ? convertToArabicNumber(verse.chapter + 1) : verse.chapter + 1}:${language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1}`}
                          </span>
                          <div className={styles.actions}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopySingleVerse(verse); }}
                              aria-label="نسخ الآية"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                                <path d="M9.5 1a.5.5 0 0 1 .5.5v1h-4v-1a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1z"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}