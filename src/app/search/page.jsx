'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import _ from 'lodash';
import styles from './search.module.css';

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

function extractArabicRoot(word) {
  try {
    let cleanWord = normalizeArabicText(word);
    
    // Step 1: Handle specific cases with known roots for accuracy
    const specificRoots = {
      'خاف': 'خوف',
      'خوف': 'خوف',
      'مخيف': 'خوف',
      'خائف': 'خوف',
      'يخاف': 'خوف',
      'قال': 'قول',
      'قول': 'قول',
      'يقول': 'قول',
      'سار': 'سير',
      'سير': 'سير',
      'باع': 'بيع',
      'بيع': 'بيع',
      'زاد': 'زيد',
      'جاء': 'جيء',
      'حب': 'حبب',
      'محبه': 'حبب',
      'أحب': 'حبب',
      'حبيب': 'حبب'
    };
    if (specificRoots[cleanWord]) {
      return specificRoots[cleanWord];
    }

    // Step 2: A more robust algorithm for hollow verbs (أجوف)
    if (cleanWord.length === 3 && (cleanWord[1] === 'ا')) {
      const firstChar = cleanWord[0];
      const lastChar = cleanWord[2];
      // Heuristic to guess the original middle letter
      // This is a simple guess and can be improved with a dictionary
      const potentialRoot = firstChar + 'و' + lastChar;
      return potentialRoot;
    }

    // Step 3: Simple stemming for common prefixes and suffixes
    const prefixes = ['ال', 'و', 'ف', 'ب', 'ل', 'ت', 'ي', 'أ', 'ن', 'م', 'ست', 'است'];
    for (const prefix of prefixes) {
      if (cleanWord.startsWith(prefix) && cleanWord.length > prefix.length + 1) {
        cleanWord = cleanWord.substring(prefix.length);
        break;
      }
    }
    
    const suffixes = ['ه', 'ها', 'هم', 'هن', 'ني', 'تي', 'تك', 'تكم', 'ين', 'ون', 'ات', 'ان', 'وا', 'تم', 'تن'];
    for (const suffix of suffixes) {
      if (cleanWord.endsWith(suffix) && cleanWord.length > suffix.length + 1) {
        cleanWord = cleanWord.substring(0, cleanWord.length - suffix.length);
        break;
      }
    }
    
    if (cleanWord.length < 2) {
      return word;
    }
    
    // Final check for common root patterns
    if (cleanWord.length === 3) {
      return cleanWord;
    }

    return word;
  } catch (error) {
    console.error('Error extracting root:', error);
    return word;
  }
}

function generateDerivatives(root) {
  const derivatives = new Set([root, normalizeArabicText(root)]);
  
  const patterns = [
    (r) => r,
    (r) => r + 'ه',
    (r) => r + 'اً',
    (r) => r.charAt(0) + 'ا' + r.slice(1),
    (r) => r.charAt(0) + 'ا' + r.charAt(2), // for roots like خوف -> خاف
    (r) => 'م' + r,
    (r) => 'م' + r + 'ه',
    (r) => 'ي' + r,
    (r) => 'ت' + r,
    (r) => 'أ' + r,
    (r) => 'ن' + r,
    (r) => r + 'ان',
    (r) => 'إ' + r,
    (r) => r + 'ي',
    (r) => r + 'يه',
    (r) => r + 'ين',
    (r) => r + 'ون',
    (r) => r + 'ات',
    (r) => 'است' + r,
    (r) => 'مست' + r,
    (r) => 'ت' + r.charAt(0) + 'ا' + r.slice(1),
    (r) => 'ان' + r,
    (r) => 'من' + r,
  ];
  
  patterns.forEach(pattern => {
    try {
      const derivative = pattern(root);
      if (derivative && derivative.length >= 2 && derivative.length <= 10) {
        derivatives.add(derivative);
        derivatives.add(normalizeArabicText(derivative));
      }
    } catch (error) {
    }
  });
  
  // Add common derivatives for 'خوف' root
  if (root === 'خوف') {
    derivatives.add('خاف');
    derivatives.add('يخاف');
    derivatives.add('خيفة');
    derivatives.add('خائف');
    derivatives.add('مخيف');
    derivatives.add('مخوف');
    derivatives.add('خوفا');
    derivatives.add('خائفون');
  }

  // Add common derivatives for 'حبب' root
  if (root === 'حبب') {
    derivatives.add('حب');
    derivatives.add('أحب');
    derivatives.add('محبة');
    derivatives.add('محبوب');
    derivatives.add('حبيب');
    derivatives.add('أحبب');
    derivatives.add('يُحِبّ');
  }

  return Array.from(derivatives).filter(word => word && word.length > 1);
}

function searchWithDerivatives(searchTerm, verses) {
  if (!searchTerm || searchTerm.length < 2) return { results: [], searchInfo: null };
  
  try {
    const root = extractArabicRoot(searchTerm);
    const derivatives = generateDerivatives(root);
    
    const searchInfo = {
      originalTerm: searchTerm,
      extractedRoot: root,
      derivatives: derivatives.slice(0, 20)
    };
    
    const normalizedDerivatives = derivatives.map(d => normalizeArabicText(d)).join('|');
    const derivativePattern = new RegExp(`(?:\\b${normalizedDerivatives})`, 'i');

    const results = verses.filter(verse => {
      const normalizedVerseText = normalizeArabicText(verse.text);
      return derivativePattern.test(normalizedVerseText);
    });
    
    return { results, searchInfo };
  } catch (error) {
    console.error('Error in derivative search:', error);
    const fallbackResults = verses.filter(verse => 
      normalizeArabicText(verse.text).includes(normalizeArabicText(searchTerm))
    );
    return { results: fallbackResults, searchInfo: null };
  }
}

function searchLiteral(searchTerm, verses) {
  const normalizedTerm = normalizeArabicText(searchTerm);
  return verses.filter(verse => 
    normalizeArabicText(verse.text).includes(normalizedTerm)
  );
}

export default function BibleSearchPage() {
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
  const [favouriteMessage, setFavouriteMessage] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');
  const [selectedVerses, setSelectedVerses] = useState(new Set());
  const [isMobileSelectionMode, setIsMobileSelectionMode] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const didHoldRef = useRef(false);

  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);

  const fetchFavourites = useCallback(() => {
    try {
      const verses = JSON.parse(localStorage.getItem('favourite_verses')) || {};
      setFavouriteVerses(verses);
    } catch (error) {
      console.error('Failed to load favorites from localStorage:', error);
    }
  }, []);

  const saveFavourites = useCallback((verses) => {
    try {
      localStorage.setItem('favourite_verses', JSON.stringify(verses));
    } catch (error) {
      console.error('Failed to save favorites to localStorage:', error);
    }
  }, []);

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
      setCopiedMessage(language === 'ar' ? 'تم النسخ!' : 'Copied!');
      setTimeout(() => setCopiedMessage(''), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopiedMessage(language === 'ar' ? 'فشل النسخ!' : 'Failed to copy!');
      setTimeout(() => setCopiedMessage(''), 2000);
    }
  };

  const handleCopySingleVerse = (verse) => {
    const reference = `(${verse.book} ${language === 'ar' ? convertToArabicNumber(verse.chapter + 1) : verse.chapter + 1}:${language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1})`;
    const textToCopy = `${verse.text} ${reference}`;
    copyTextToClipboard(textToCopy);
  };

  const handleFavouriteSingleVerse = (verse) => {
    const verseKey = `${verse.book_index}-${verse.chapter}-${verse.verse}`;
    const isFavourite = favouriteVerses[verseKey] !== undefined;
    let newFavouriteVerses = { ...favouriteVerses };
    if (isFavourite) {
      delete newFavouriteVerses[verseKey];
      setFavouriteMessage(language === 'ar' ? 'تم الحذف من المفضلة!' : 'Removed from favorites!');
    } else {
      newFavouriteVerses[verseKey] = {
        type: 'verse',
        verseKey,
        text: verse.text,
        bookName: verse.book,
        chapter: verse.chapter,
        verseIndex: verse.verse,
        language: language,
      };
      setFavouriteMessage(language === 'ar' ? 'تم الإضافة إلى المفضلة!' : 'Added to favorites!');
    }
    setFavouriteVerses(newFavouriteVerses);
    saveFavourites(newFavouriteVerses);
    setTimeout(() => setFavouriteMessage(''), 2000);
  };

  const handleVerseSelection = (verseKey) => {
    setSelectedVerses(prevSelected => {
      const newSelection = new Set(prevSelected);
      if (newSelection.has(verseKey)) {
        newSelection.delete(verseKey);
      } else {
        newSelection.add(verseKey);
      }
      if (newSelection.size === 0) {
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
    const compiledText = searchResults
      .filter(verse => selectedVerses.has(`${verse.book_index}-${verse.chapter}-${verse.verse}`))
      .map(verse => {
        const reference = `(${verse.book} ${language === 'ar' ? convertToArabicNumber(verse.chapter + 1) : verse.chapter + 1}:${language === 'ar' ? convertToArabicNumber(verse.verse + 1) : verse.verse + 1})`;
        return `${verse.text} ${reference}`;
      }).join('\n\n');
    copyTextToClipboard(compiledText);
    setSelectedVerses(new Set());
    setIsMobileSelectionMode(false);
  };

  const handleFavouriteSelectedVerses = () => {
    if (selectedVerses.size === 0) return;
    let newFavouriteVerses = { ...favouriteVerses };
    const selectedResults = searchResults.filter(verse => selectedVerses.has(`${verse.book_index}-${verse.chapter}-${verse.verse}`));
    selectedResults.forEach(verse => {
      const verseKey = `${verse.book_index}-${verse.chapter}-${verse.verse}`;
      newFavouriteVerses[verseKey] = {
        type: 'verse',
        verseKey,
        text: verse.text,
        bookName: verse.book,
        chapter: verse.chapter,
        verseIndex: verse.verse,
        language: language,
      };
    });
    setFavouriteVerses(newFavouriteVerses);
    saveFavourites(newFavouriteVerses);
    setFavouriteMessage(language === 'ar' ? `تم إضافة ${selectedResults.length} آية إلى المفضلة!` : `Added ${selectedResults.length} verses to favorites!`);
    setTimeout(() => setFavouriteMessage(''), 2000);
    setSelectedVerses(new Set());
    setIsMobileSelectionMode(false);
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

  const handleFavouriteAllResults = () => {
    if (searchResults.length === 0) return;
    let newFavouriteVerses = { ...favouriteVerses };
    searchResults.forEach(verse => {
      const verseKey = `${verse.book_index}-${verse.chapter}-${verse.verse}`;
      newFavouriteVerses[verseKey] = {
        type: 'verse',
        verseKey,
        text: verse.text,
        bookName: verse.book,
        chapter: verse.chapter,
        verseIndex: verse.verse,
        language: language,
      };
    });
    setFavouriteVerses(newFavouriteVerses);
    saveFavourites(newFavouriteVerses);
    setFavouriteMessage(language === 'ar' ? `تم إضافة ${searchResults.length} آية إلى المفضلة!` : `Added ${searchResults.length} verses to favorites!`);
    setTimeout(() => setFavouriteMessage(''), 2000);
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
    fetchFavourites();
    fetchData();
  }, [fetchFavourites, language]);

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

  useEffect(() => {
    if (allVerses.length > 0) {
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
          const searchResult = searchWithDerivatives(debouncedSearchQuery, filteredVerses);
          results = searchResult.results;
          searchInfoData = searchResult.searchInfo;
        } else {
          results = searchLiteral(debouncedSearchQuery, filteredVerses);
        }
      } else if (selectedBookIndex !== '' || selectedChapter !== '') {
        results = filteredVerses;
      }
      
      setSearchResults(results);
      setSearchInfo(searchInfoData);
    } else {
      setSearchResults([]);
      setSearchInfo(null);
    }
  }, [debouncedSearchQuery, allVerses, selectedTestament, selectedBookIndex, selectedChapter, searchType]);

  const renderHighlightedText = (text, highlight) => {
    if (!highlight) return text;
    
    if (searchType === 'derivatives' && searchInfo) {
      try {
        const derivatives = searchInfo.derivatives;
        let highlightedText = text;
        
        derivatives.forEach(derivative => {
          const normalizedDerivative = normalizeArabicText(derivative);
          const regex = new RegExp(`(${derivative}|${normalizedDerivative})`, 'gi');
          highlightedText = highlightedText.replace(regex, `<span class="${styles.highlight}">$1</span>`);
        });
        
        return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
      } catch (error) {
        console.error('Error highlighting derivatives:', error);
        const normalizedHighlight = normalizeArabicText(highlight);
        const regex = new RegExp(`(${highlight}|${normalizedHighlight})`, 'gi');
        const highlightedText = text.replace(regex, `<span class="${styles.highlight}">$1</span>`);
        return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
      }
    } else {
      const normalizedHighlight = normalizeArabicText(highlight);
      const regex = new RegExp(`(${highlight}|${normalizedHighlight})`, 'gi');
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
      {copiedMessage && <div className={`${styles.messageBox} ${styles.copiedMessage}`}>{copiedMessage}</div>}
      {favouriteMessage && <div className={`${styles.messageBox} ${styles.favouriteMessage}`}>{favouriteMessage}</div>}
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
          <div className={styles.resultsWrapper}>
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
                    <button onClick={handleFavouriteSelectedVerses}>
                      إضافة للمفضلة ({convertToArabicNumber(selectedVerses.size)})
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
                                <path d="M9.5 1a.5.5 0 0 1 .5.5v1h-4v-1a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1h-4v-1z"/>
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleFavouriteSingleVerse(verse); }}
                              className={isFavourite ? styles.favourited : ''}
                              aria-label={isFavourite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                {isFavourite ? (
                                  <path fillRule="evenodd" d="M2 13.5V14a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H9.5L9.245.879A.5.5 0 0 0 8.754.5L8 .5A.5.5 0 0 0 7.246.879L6.755 1.5H2.5A1.5 1.5 0 0 0 1 3v11a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V3a1.5 1.5 0 0 0-1.5-1.5H9.5z"/>
                                ) : (
                                  <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.74.439L8 13.069l-5.26 2.87A.5.5 0 0 1 2 15.5V2zm2 13.5V2h8v13.5L8 12.3l-4 2.2z"/>
                                )}
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