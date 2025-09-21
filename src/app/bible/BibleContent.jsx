'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Bible.module.css';
import { useLanguage } from './../context/LanguageContext';
import { useSearchParams } from 'next/navigation';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '/lib/firebase';
const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;
export const metadata = {
  title: 'الكتاب المقدس| Agios Bible',
  description: 'اقرأ الكتاب المقدس من واجهة سلسة مريحة للعين في القراءة مع خصائص عدة مثل نسخ الآيات ووضعها في المفضلة',
  keywords: ['Agios Bible, Agios , Bible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'Agios Bible',
    description: 'اقرأ الكتاب المقدس من واجهة سلسة مريحة للعين في القراءة مع خصائص عدة مثل نسخ الآيات ووضعها في المفضلة',
    type: 'website',
    url: 'https://agios-bible.vercel.app/bible',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
  },
};
function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d]).join('');
}

export default function BibleContent() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();

  const [user, setUser] = useState(null);
  const [bibleData, setBibleData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bookNamesData, setBookNamesData] = useState(null);
  const [hasBookNamesError, setHasBookNamesError] = useState(false);

  const [favouriteVerses, setFavouriteVerses] = useState({});
  const [favouriteChapters, setFavouriteChapters] = useState({});
  const [completedChapters, setCompletedChapters] = useState({});

  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [isBookDropdownOpen, setIsBookDropdownOpen] = useState(false);
  const bookDropdownRef = useRef(null);

  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const chapterDropdownRef = useRef(null);

  const [selectedVerses, setSelectedVerses] = useState(new Set());

  const [copiedMessage, setCopiedMessage] = useState('');
  const [favouriteMessage, setFavouriteMessage] = useState('');
  const [completedMessage, setCompletedMessage] = useState('');

  const touchTimeout = useRef(null);
  const isLongPress = useRef(false);

  const [tafseerIndex, setTafseerIndex] = useState(null);

  const getBookName = useCallback((index) => {
    return bookNamesData?.[language]?.[index]?.name || 'Unknown Book';
  }, [bookNamesData, language]);

  const getBookIndexByName = useCallback((name) => {
    if (!bookNamesData?.[language] || !name) return 0;
    const index = bookNamesData[language].findIndex(book => book.name?.toLowerCase() === name.toLowerCase());
    return index !== -1 ? index : 0;
  }, [bookNamesData, language]);

  const getBookAbbreviation = useCallback((index) => {
    return bookNamesData?.abbreviations?.[index] || '';
  }, [bookNamesData]);

const saveToFirestore = useCallback(async (loggedInUser, verses, chapters, completed) => {
    if (!loggedInUser || !firestore) return;
    try {
        const userRef = doc(firestore, 'users', loggedInUser.uid);
        await setDoc(userRef, {
            favorites: {
                verses: verses,
                chapters: chapters
            },
            completedChapters: completed // هنا يتم استخدام البيانات الممررة
        }, { merge: true });
        console.log("Progress saved to Firestore successfully!");
    } catch (error) {
        console.error("Error saving progress to Firestore:", error);
    }
}, []);

  const fetchUserDataFromFirestore = useCallback(async (loggedInUser) => {
    if (!loggedInUser || !firestore) return;

    try {
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const firestoreData = userSnap.data();
        setFavouriteVerses(firestoreData.favorites?.verses || {});
        setFavouriteChapters(firestoreData.favorites?.chapters || {});
        setCompletedChapters(firestoreData.completedChapters || {});
      } else {
        setFavouriteVerses({});
        setFavouriteChapters({});
        setCompletedChapters({});
      }
    } catch (error) {
      console.error("Error fetching data from Firestore:", error);
    }
  }, []);
  
  const saveFavourites = useCallback((verses, chapters) => {
    try {
      localStorage.setItem('favourite_verses', JSON.stringify(verses));
      localStorage.setItem('favourite_chapters', JSON.stringify(chapters));
    } catch (error) {
      console.error('Error saving favourites:', error);
    }
    if (user) {
      saveToFirestore(user, verses, chapters, completedChapters);
    }
  }, [user, saveToFirestore, completedChapters]);

const saveCompletedChapters = useCallback((completed) => {
    try {
        localStorage.setItem('completed_chapters', JSON.stringify(completed));
    } catch (error) {
        console.error('Error saving completed chapters:', error);
    }
    if (user) {
        saveToFirestore(user, favouriteVerses, favouriteChapters, completed);
    }
}, [user, saveToFirestore, favouriteVerses, favouriteChapters]);

  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((loggedInUser) => {
        setUser(loggedInUser);
        if (loggedInUser) {
          fetchUserDataFromFirestore(loggedInUser);
        } else {
          try {
            const verses = JSON.parse(localStorage.getItem('favourite_verses')) || {};
            const chapters = JSON.parse(localStorage.getItem('favourite_chapters')) || {};
            const completed = JSON.parse(localStorage.getItem('completed_chapters')) || {};
            setFavouriteVerses(verses);
            setFavouriteChapters(chapters);
            setCompletedChapters(completed);
          } catch (error) {
            console.error('Error loading data from local storage:', error);
          }
        }
      });
      return () => unsubscribe();
    }
  }, [fetchUserDataFromFirestore]);

  useEffect(() => {
    let timerId;
    if (copiedMessage || favouriteMessage || completedMessage) {
      timerId = setTimeout(() => {
        setCopiedMessage('');
        setFavouriteMessage('');
        setCompletedMessage('');
      }, 3000);
    }
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [copiedMessage, favouriteMessage, completedMessage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bookDropdownRef.current && !bookDropdownRef.current.contains(event.target)) {
        setIsBookDropdownOpen(false);
      }
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target)) {
        setIsChapterDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsBookDropdownOpen(false);
        setIsChapterDropdownOpen(false);
        setSelectedVerses(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  useEffect(() => {
    const loadBookNames = async () => {
      try {
        const response = await fetch('/data/bookNames.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for /data/bookNames.json`);
        }
        const data = await response.json();
        setBookNamesData(data);
        setTafseerIndex(data.tafseer || []);
        setHasBookNamesError(false);
      } catch (error) {
        console.error('Error loading book names:', error);
        setBookNamesData({});
        setTafseerIndex(null);
        setHasBookNamesError(true);
      }
    };
    loadBookNames();
  }, []);

  useEffect(() => {
    const loadBible = async () => {
      setIsLoading(true);
      setBibleData(null);
      if (!language || !['ar', 'en', 'fr'].includes(language) || !bookNamesData) {
        setIsLoading(false);
        setBibleData([]);
        return;
      }

      try {
        let jsonFileName = '';
        if (language === 'ar') {
          jsonFileName = 'ar_svd.json';
        } else if (language === 'en') {
          jsonFileName = 'en_bbe.json';
        } else {
          jsonFileName = 'fr_apee.json';
        }
        const jsonFilePath = `/data/bibles/${jsonFileName}`;
        const response = await fetch(jsonFilePath);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for ${jsonFilePath}`);
        }
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setBibleData(data);
          const bookNameFromUrl = searchParams.get('book');
          const chapterFromUrl = searchParams.get('chapter');
          let initialBookIndex = 0;
          let initialChapterIndex = 0;

          if (bookNameFromUrl) {
            initialBookIndex = getBookIndexByName(decodeURIComponent(bookNameFromUrl));
          }

          if (chapterFromUrl) {
            const parsedChapter = parseInt(decodeURIComponent(chapterFromUrl)) - 1;
            if (!isNaN(parsedChapter) && parsedChapter >= 0 && parsedChapter < data?.[initialBookIndex]?.chapters.length) {
              initialChapterIndex = parsedChapter;
            }
          }
          setSelectedBookIndex(initialBookIndex);
          setSelectedChapterIndex(initialChapterIndex);
          setSelectedVerses(new Set());
        } else {
          setBibleData([]);
        }
      } catch (error) {
        console.error('Error loading bible data:', error);
        setBibleData(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadBible();
  }, [language, bookNamesData, searchParams, getBookIndexByName]);

  const handleBookItemClick = useCallback((index) => {
    setSelectedBookIndex(index);
    setSelectedChapterIndex(0);
    setSelectedVerses(new Set());
    setIsBookDropdownOpen(false);
  }, []);

  const handleChapterItemClick = useCallback((index) => {
    setSelectedChapterIndex(index);
    setSelectedVerses(new Set());
    setIsChapterDropdownOpen(false);
  }, []);

  const handlePreviousChapter = useCallback(() => {
    setSelectedVerses(new Set());
    if (selectedChapterIndex > 0) {
      setSelectedChapterIndex(prev => prev - 1);
    } else {
      if (selectedBookIndex > 0) {
        const prevBookIndex = selectedBookIndex - 1;
        const prevBookChapters = bibleData?.[prevBookIndex]?.chapters.length - 1;
        setSelectedBookIndex(prevBookIndex);
        setSelectedChapterIndex(prevBookChapters);
      }
    }
  }, [selectedBookIndex, selectedChapterIndex, bibleData]);

  const handleNextChapter = useCallback(() => {
    setSelectedVerses(new Set());
    if (selectedChapterIndex < chapters.length - 1) {
      setSelectedChapterIndex(prev => prev + 1);
    } else {
      if (selectedBookIndex < bibleData.length - 1) {
        setSelectedBookIndex(prev => prev + 1);
        setSelectedChapterIndex(0);
      }
    }
  }, [selectedBookIndex, selectedChapterIndex, bibleData]);

const handleCompleteChapter = useCallback(() => {
    const chapterKey = `${selectedBookIndex}-${selectedChapterIndex}`;
    const bookName = getBookName(selectedBookIndex); // جلب اسم السفر
    const chapterNumber = selectedChapterIndex + 1; // جلب رقم الإصحاح

    setCompletedChapters(prevCompleted => {
        const isCurrentlyCompleted = prevCompleted[chapterKey]?.isCompleted;
        const newCompleted = {
            ...prevCompleted,
            [chapterKey]: isCurrentlyCompleted
                ? null
                : {
                      isCompleted: true,
                      dateCompleted: new Date().toISOString(),
                      bookName: bookName,          // هنا نضيف اسم السفر
                      chapter: chapterNumber,      // وهنا نضيف رقم الإصحاح
                  }
        };

        const message = isCurrentlyCompleted
            ? (language === 'ar' ? 'تم حذف الإصحاح من الإنجازات.' : 'Chapter completion removed.')
            : (language === 'ar' ? 'تم تسجيل إنجاز الإصحاح!' : 'Chapter marked as completed!');
        setCompletedMessage(message);

        saveCompletedChapters(newCompleted);
        return newCompleted;
    });
}, [selectedBookIndex, selectedChapterIndex, getBookName, saveCompletedChapters, language]);

  const selectedBook = bibleData?.[selectedBookIndex] || null;
  const chapters = selectedBook?.chapters || [];
  const verses = chapters?.[selectedChapterIndex] || [];

  const getChapterLabel = useCallback((index) => {
    if (language === 'ar') return `الإصحاح ${convertToArabicNumber(index + 1)}`;
    if (language === 'fr') return `Chapitre ${index + 1}`;
    return `Chapter ${index + 1}`;
  }, [language]);

  const getVerseNumber = useCallback((index) => {
    return language === 'ar' ? convertToArabicNumber(index + 1) : index + 1;
  }, [language]);

  const getFullVerseText = useCallback((bookIdx, chapterIdx, verseIdx, verseText) => {
    const bookName = getBookName(bookIdx);
    const chapterNumber = chapterIdx + 1;
    const verseNumber = verseIdx + 1;
    let reference;
    if (language === 'ar') {
      reference = `(${bookName} ${convertToArabicNumber(chapterNumber)}:${convertToArabicNumber(verseNumber)})`;
    } else {
      reference = `(${bookName} ${chapterNumber}:${verseNumber})`;
    }
    return `${verseText} ${reference}`;
  }, [getBookName, language]);

  const copyTextToClipboard = useCallback(async (textToCopy) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const el = document.createElement('textarea');
        el.value = textToCopy;
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedMessage(
        language === 'ar' ? 'تم النسخ!' : language === 'en' ? 'Copied!' : 'Copié!'
      );
    } catch (err) {
      console.error('Copy failed:', err);
      setCopiedMessage(
        language === 'ar' ? 'فشل النسخ!' : language === 'en' ? 'Failed to copy!' : 'Échec de la copie!'
      );
    }
  }, [language]);

  const handleCopySingleVerse = useCallback((verse, index) => {
    const textToCopy = getFullVerseText(selectedBookIndex, selectedChapterIndex, index, verse);
    copyTextToClipboard(textToCopy);
  }, [getFullVerseText, selectedBookIndex, selectedChapterIndex, copyTextToClipboard]);

  const handleCopyChapter = useCallback(() => {
    const textToCopy = verses.map((verse, index) => {
      return getFullVerseText(selectedBookIndex, selectedChapterIndex, index, verse);
    }).join('\n\n');
    copyTextToClipboard(textToCopy);
  }, [verses, getFullVerseText, selectedBookIndex, selectedChapterIndex, copyTextToClipboard]);

  const handleFavouriteChapter = useCallback(() => {
    const chapterKey = `${selectedBookIndex}-${selectedChapterIndex}`;
    const isFavourite = favouriteChapters[chapterKey] !== undefined;
    let newFavouriteChapters = { ...favouriteChapters };
    
    if (isFavourite) {
      delete newFavouriteChapters[chapterKey];
      setFavouriteMessage(language === 'ar' ? 'تم حذف الإصحاح من المفضلة!' : 'Chapter removed from favorites!');
    } else {
      const chapterData = {
        type: 'chapter',
        chapterKey,
        dateAdded: new Date().toLocaleDateString('en-CA'),
        text: verses.map((v, i) => {
          let verseNumber = language === 'ar' ? convertToArabicNumber(i + 1) : i + 1;
          return `${verseNumber}. ${v}`;
        }).join('\n'),
        bookName: getBookName(selectedBookIndex),
        bookNameAbbrev: getBookAbbreviation(selectedBookIndex),
        chapter: selectedChapterIndex,
        language: language,
      };
      newFavouriteChapters[chapterKey] = chapterData;
      setFavouriteMessage(language === 'ar' ? 'تم إضافة الإصحاح إلى المفضلة!' : 'Chapter added to favorites!');
    }
    setFavouriteChapters(newFavouriteChapters);
    saveFavourites(favouriteVerses, newFavouriteChapters);
  }, [selectedBookIndex, selectedChapterIndex, favouriteChapters, verses, language, getBookName, getBookAbbreviation, favouriteVerses, saveFavourites]);

  const handleFavouriteSingleVerse = useCallback((verse, verseIndex) => {
    const verseKey = `${selectedBookIndex}-${selectedChapterIndex}-${verseIndex}`;
    const isFavourite = favouriteVerses[verseKey] !== undefined;
    let newFavouriteVerses = { ...favouriteVerses };
    
    if (isFavourite) {
      delete newFavouriteVerses[verseKey];
      setFavouriteMessage(language === 'ar' ? 'تم الحذف من المفضلة!' : 'Removed from favorites!');
    } else {
      const verseData = {
        type: 'verse',
        verseKey,
        dateAdded: new Date().toLocaleDateString('en-CA'),
        text: verse,
        bookName: getBookName(selectedBookIndex),
        bookNameAbbrev: getBookAbbreviation(selectedBookIndex),
        chapter: selectedChapterIndex,
        verseIndex: verseIndex,
        language: language,
      };
      newFavouriteVerses[verseKey] = verseData;
      setFavouriteMessage(language === 'ar' ? 'تم الإضافة إلى المفضلة!' : 'Added to favorites!');
    }
    setFavouriteVerses(newFavouriteVerses);
    saveFavourites(newFavouriteVerses, favouriteChapters);
  }, [selectedBookIndex, selectedChapterIndex, favouriteVerses, language, getBookName, getBookAbbreviation, favouriteChapters, saveFavourites]);

  const handleVerseSelection = useCallback((verseKey) => {
    setSelectedVerses(prevSelected => {
      const newSelection = new Set(prevSelected);
      if (newSelection.has(verseKey)) {
        newSelection.delete(verseKey);
      } else {
        newSelection.add(verseKey);
      }
      return newSelection;
    });
  }, []);

  const handleCopySelectedVerses = useCallback(() => {
    if (selectedVerses.size === 0) return;
    let compiledText = [];
    const sortedSelectedVerseKeys = Array.from(selectedVerses).sort((a, b) => {
      const [, , verseIdxA] = a.split('-').map(Number);
      const [, , verseIdxB] = b.split('-').map(Number);
      return verseIdxA - verseIdxB;
    });
    
    sortedSelectedVerseKeys.forEach(key => {
      const [bookIdx, chapterIdx, verseIdx] = key.split('-').map(Number);
      if (bookIdx === selectedBookIndex && chapterIdx === selectedChapterIndex && verses[verseIdx]) {
        compiledText.push(getFullVerseText(bookIdx, chapterIdx, verseIdx, verses[verseIdx]));
      }
    });
    
    const textToCopy = compiledText.join('\n\n');
    copyTextToClipboard(textToCopy);
    setSelectedVerses(new Set());
  }, [selectedVerses, selectedBookIndex, selectedChapterIndex, verses, getFullVerseText, copyTextToClipboard]);

  const handleFavouriteSelectedVerses = useCallback(() => {
    if (selectedVerses.size === 0) return;
    let newFavouriteVerses = { ...favouriteVerses };
    
    for (const key of Array.from(selectedVerses)) {
      const isFavourite = newFavouriteVerses[key] !== undefined;
      const [bookIdx, chapterIdx, verseIdx] = key.split('-').map(Number);
      
      if (isFavourite) {
        delete newFavouriteVerses[key];
      } else {
        const verseData = {
          type: 'verse',
          verseKey: key,
          dateAdded: new Date().toLocaleDateString('en-CA'),
          text: verses[verseIdx],
          bookName: getBookName(bookIdx),
          bookNameAbbrev: getBookAbbreviation(bookIdx),
          chapter: chapterIdx,
          verseIndex: verseIdx,
          language: language,
        };
        newFavouriteVerses[key] = verseData;
      }
    }
    
    setFavouriteVerses(newFavouriteVerses);
    saveFavourites(newFavouriteVerses, favouriteChapters);
    setFavouriteMessage(
      language === 'ar' 
        ? `تم تحديث المفضلة (${convertToArabicNumber(selectedVerses.size)} آية)!` 
        : `Favorites updated (${selectedVerses.size} Verses)!`
    );
    setSelectedVerses(new Set());
  }, [selectedVerses, favouriteVerses, verses, getBookName, getBookAbbreviation, language, favouriteChapters, saveFavourites]);

  const isCurrentChapterFavourite = favouriteChapters[`${selectedBookIndex}-${selectedChapterIndex}`] !== undefined;
  const isCurrentChapterCompleted = completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`]?.isCompleted;
  const currentChapterCompletedDate = completedChapters[`${selectedBookIndex}-${selectedChapterIndex}`]?.dateCompleted;

  const handleVerseTouchStart = useCallback((e, verseKey) => {
    e.stopPropagation();
    isLongPress.current = false;
    touchTimeout.current = setTimeout(() => {
      isLongPress.current = true;
      handleVerseSelection(verseKey);
    }, 500);
  }, [handleVerseSelection]);

  const handleVerseTouchEnd = useCallback((e, verseKey) => {
    clearTimeout(touchTimeout.current);
    if (!isLongPress.current) {
      if (selectedVerses.size > 0) {
        handleVerseSelection(verseKey);
      }
    }
    isLongPress.current = false;
  }, [selectedVerses.size, handleVerseSelection]);

  const handleVerseClick = useCallback((e, verseKey) => {
    e.stopPropagation();
    if (!isTouchDevice()) {
      handleVerseSelection(verseKey);
    }
  }, [handleVerseSelection]);

  const isTouchDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const getTafsirUrl = useCallback(() => {
    const entry = tafseerIndex?.[selectedBookIndex];
    if (!entry) return null;
    return `https://st-takla.org/pub_Bible-Interpretations/${entry.urlBase}/`;
  }, [tafseerIndex, selectedBookIndex]);

  const handleOpenTafsir = useCallback(() => {
    const url = getTafsirUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [getTafsirUrl]);

  const handleKeyDown = useCallback((e, action, ...args) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action(...args);
    }
  }, []);

  if (isLoading || bookNamesData === null) {
    return (
      <div className={styles.loadingMessage}>
        {language === 'ar' ? 'جارٍ تحميل الكتاب المقدس...' : language === 'en' ? 'Loading Bible...' : 'Chargement de la Bible...'}
      </div>
    );
  }

  if (!bibleData || bibleData.length === 0 || hasBookNamesError || !bookNamesData?.[language] || Object.keys(bookNamesData[language]).length === 0) {
    return (
      <div className={styles.errorMessage}>
        {language === 'ar' ? 'فشل تحميل بيانات الكتاب المقدس أو البيانات فارغة.' : 'Failed to load Bible data or data is empty.'}
        <br />
        {hasBookNamesError && (language === 'ar' ? 'الرجاء التحقق من مسار ملف bookNames.json.' : 'Please check the path to bookNames.json.')}
        {!hasBookNamesError && (language === 'ar' ? 'الرجاء التحقق من: 1. قيمة اللغة من `LanguageContext`. 2. مسارات ملفات JSON في مجلد `public/data/bibles`. 3. بنية ملفات JSON.' : 'Please check: 1. Language value from `LanguageContext`. 2. JSON file paths in `public/data/bibles` folder. 3. JSON file structure.')}
      </div>
    );
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={styles.container}>
      <h1 className={styles.title}>
        📚 {
          language === 'ar'
            ? ' الكتاب المقدس'
            : language === 'en'
              ? 'Bible Study'
              : 'Étude de la Bible'
        }
      </h1>
      
      <div className={styles.controls}>
        <div className={styles.customSelectWrapper} ref={bookDropdownRef}>
          <label className={styles.label}>
            📖 {
              language === 'ar'
                ? 'اختر السفر:'
                : language === 'en'
                  ? 'Select Book:'
                  : 'Choisir un livre:'
            }
          </label>
          <div
            className={`${styles.selectTrigger} ${isBookDropdownOpen ? styles.active : ''}`}
            onClick={() => setIsBookDropdownOpen(!isBookDropdownOpen)}
            onKeyDown={(e) => handleKeyDown(e, () => setIsBookDropdownOpen(!isBookDropdownOpen))}
            tabIndex={0}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={isBookDropdownOpen}
          >
            <span>{getBookName(selectedBookIndex)}</span>
            <div className={styles.arrow}></div>
          </div>
          <ul className={`${styles.dropdownMenu} ${isBookDropdownOpen ? styles.open : ''}`} role="listbox">
            {bookNamesData?.[language]?.map((book, index) => (
              <li
                key={index}
                className={`${styles.dropdownItem} ${selectedBookIndex === index ? styles.selected : ''}`}
                onClick={() => handleBookItemClick(index)}
                onKeyDown={(e) => handleKeyDown(e, handleBookItemClick, index)}
                tabIndex={isBookDropdownOpen ? 0 : -1}
                role="option"
                aria-selected={selectedBookIndex === index}
              >
                {book.name}
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.customSelectWrapper} ref={chapterDropdownRef}>
          <label className={styles.label}>
            🔢 {
              language === 'ar'
                ? 'اختر الإصحاح:'
                : language === 'en'
                  ? 'Select Chapter:'
                  : 'Choisir un chapitre:'
            }
          </label>
          <div
            className={`${styles.selectTrigger} ${isChapterDropdownOpen ? styles.active : ''}`}
            onClick={() => setIsChapterDropdownOpen(!isChapterDropdownOpen)}
            onKeyDown={(e) => handleKeyDown(e, () => setIsChapterDropdownOpen(!isChapterDropdownOpen))}
            tabIndex={0}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={isChapterDropdownOpen}
          >
            <span>{getChapterLabel(selectedChapterIndex)}</span>
            <div className={styles.arrow}></div>
          </div>
          <ul className={`${styles.dropdownMenu} ${isChapterDropdownOpen ? styles.open : ''}`} role="listbox">
            {chapters?.map((_, index) => (
              <li
                key={index}
                className={`${styles.dropdownItem} ${selectedChapterIndex === index ? styles.selected : ''}`}
                onClick={() => handleChapterItemClick(index)}
                onKeyDown={(e) => handleKeyDown(e, handleChapterItemClick, index)}
                tabIndex={isChapterDropdownOpen ? 0 : -1}
                role="option"
                aria-selected={selectedChapterIndex === index}
              >
                {getChapterLabel(index)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {copiedMessage && (
        <div className={`${styles.messageBox} ${styles.copiedMessage}`} role="alert">
          {copiedMessage}
        </div>
      )}

      {favouriteMessage && (
        <div className={`${styles.messageBox} ${styles.favouriteMessage}`} role="alert">
          {favouriteMessage}
        </div>
      )}

      {completedMessage && (
        <div className={`${styles.messageBox} ${styles.completedMessage}`} role="alert">
          {completedMessage}
        </div>
      )}

      {selectedVerses.size > 0 && (
        <div className={`${styles.actionButtons} ${styles.visible}`}>
          <button
            onClick={handleCopySelectedVerses}
            className={styles.copySelectedButton}
            aria-label={language === 'ar' ? `نسخ ${selectedVerses.size} آية مختارة` : `Copy ${selectedVerses.size} Selected Verses`}
          >
            📋 {language === 'ar' ? `نسخ ${convertToArabicNumber(selectedVerses.size)} آية مختارة` : `Copy ${selectedVerses.size} Selected Verses`}
          </button>
          <button
            onClick={handleFavouriteSelectedVerses}
            className={styles.favouriteSelectedButton}
            aria-label={language === 'ar' ? `تحديث المفضلة (${selectedVerses.size} آية)` : `Update Favorites (${selectedVerses.size} Verses)`}
          >
            ⭐ {language === 'ar' ? `تحديث المفضلة (${convertToArabicNumber(selectedVerses.size)} آية)` : `Update Favorites (${selectedVerses.size} Verses)`}
          </button>
        </div>
      )}

      <div>
        <h2 className={styles.chapterTitle}>
          📜 {getBookName(selectedBookIndex)} {getChapterLabel(selectedChapterIndex)}
        </h2>

        <div className={styles.actionButtons}>
          <button
            onClick={handlePreviousChapter}
            className={styles.navButton}
            disabled={selectedBookIndex === 0 && selectedChapterIndex === 0}
            aria-label={language === 'ar' ? 'الإصحاح السابق' : 'Previous Chapter'}
          >
            {language === 'ar' ? '« السابق' : '« Previous'}
          </button>
          <button
            onClick={handleCompleteChapter}
            className={`${styles.completeButton} ${isCurrentChapterCompleted ? styles.isCompleted : ''}`}
            aria-label={language === 'ar' ? (isCurrentChapterCompleted ? 'إلغاء إكمال الإصحاح' : 'أنهيت الإصحاح') : (isCurrentChapterCompleted ? 'Un-complete Chapter' : 'Complete Chapter')}
          >
            ✅ {language === 'ar' ? (isCurrentChapterCompleted ? 'إلغاء الإنجاز' : 'أنهيت الإصحاح') : (isCurrentChapterCompleted ? 'Un-complete' : 'Complete Chapter')}
          </button>
          <button
            onClick={handleNextChapter}
            className={styles.navButton}
            disabled={selectedBookIndex === bibleData.length - 1 && selectedChapterIndex === chapters.length - 1}
            aria-label={language === 'ar' ? 'الإصحاح القادم' : 'Next Chapter'}
          >
            {language === 'ar' ? 'التالي »' : 'Next »'}
          </button>
        </div>

        {isCurrentChapterCompleted && (
          <div className={styles.completionInfo}>
            {language === 'ar' ? `تم إكمال هذا الإصحاح في: ${currentChapterCompletedDate}` : `This chapter was completed on: ${currentChapterCompletedDate}`}
          </div>
        )}

        <div className={styles.verseContainer}>
          {verses?.map((verse, index) => {
            const verseKey = `${selectedBookIndex}-${selectedChapterIndex}-${index}`;
            const isSelected = selectedVerses.has(verseKey);
            const isFavourite = favouriteVerses[verseKey] !== undefined;
            const favouriteVerseDate = favouriteVerses[verseKey]?.dateAdded;

            return (
              <div
                key={index}
                className={`${styles.singleVerse} ${isSelected ? styles.selectedVerse : ''} ${isFavourite ? styles.favouriteVerse : ''}`}
                onTouchStart={(e) => isTouchDevice() && handleVerseTouchStart(e, verseKey)}
                onTouchEnd={(e) => isTouchDevice() && handleVerseTouchEnd(e, verseKey)}
                onClick={(e) => handleVerseClick(e, verseKey)}
                onKeyDown={(e) => handleKeyDown(e, handleVerseSelection, verseKey)}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${language === 'ar' ? 'الآية' : 'Verse'} ${getVerseNumber(index)}`}
              >
                <div className={styles.verseNumberAndText}>
                  <strong className={styles.verseNumber}>
                    {getVerseNumber(index)}.
                  </strong>
                  {verse}
                </div>
                {isFavourite && (
                  <div className={styles.favouriteDate}>
                    {language === 'ar' ? `أُضيفت للمفضلة: ${favouriteVerseDate}` : `Added to favorites: ${favouriteVerseDate}`}
                  </div>
                )}
                <div className={styles.verseActions}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFavouriteSingleVerse(verse, index);
                    }}
                    className={`${styles.favouriteButton} ${isFavourite ? styles.isFavourite : ''}`}
                    title={language === 'ar' ? (isFavourite ? 'إزالة من المفضلة' : 'أضف للمفضلة') : (isFavourite ? 'Remove from Favorites' : 'Add to Favorites')}
                    aria-label={language === 'ar' ? (isFavourite ? 'إزالة من المفضلة' : 'أضف للمفضلة') : (isFavourite ? 'Remove from Favorites' : 'Add to Favorites')}
                  >
                    ⭐
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopySingleVerse(verse, index);
                    }}
                    className={styles.copyButton}
                    title={language === 'ar' ? 'نسخ الآية' : language === 'en' ? 'Copy Verse' : 'Copier le verset'}
                    aria-label={language === 'ar' ? 'نسخ الآية' : language === 'en' ? 'Copy Verse' : 'Copier le verset'}
                  >
                    📋
                  </button>
                </div>
              </div>
            );
          }) || <div className={styles.noVersesMessage}>
            {language === 'ar' ? 'لا توجد آيات متاحة لهذا الإصحاح أو السفر.' : 'No verses available for this chapter or book.'}
          </div>}
        </div>
        <div className={styles.actionButtons}>
          <button
            onClick={handlePreviousChapter}
            className={styles.navButton}
            disabled={selectedBookIndex === 0 && selectedChapterIndex === 0}
            aria-label={language === 'ar' ? 'الإصحاح السابق' : 'Previous Chapter'}
          >
            {language === 'ar' ? '« السابق' : '« Previous'}
          </button>
          <button
            onClick={handleCompleteChapter}
            className={`${styles.completeButton} ${isCurrentChapterCompleted ? styles.isCompleted : ''}`}
            aria-label={language === 'ar' ? (isCurrentChapterCompleted ? 'إلغاء إكمال الإصحاح' : 'أنهيت الإصحاح') : (isCurrentChapterCompleted ? 'Un-complete Chapter' : 'Complete Chapter')}
          >
            ✅ {language === 'ar' ? (isCurrentChapterCompleted ? 'إلغاء الإنجاز' : 'أنهيت الإصحاح') : (isCurrentChapterCompleted ? 'Un-complete' : 'Complete Chapter')}
          </button>
          <button
            onClick={handleNextChapter}
            className={styles.navButton}
            disabled={selectedBookIndex === bibleData.length - 1 && selectedChapterIndex === chapters.length - 1}
            aria-label={language === 'ar' ? 'الإصحاح القادم' : 'Next Chapter'}
          >
            {language === 'ar' ? 'التالي »' : 'Next »'}
          </button>
        </div>
      </div>
    </div>
  );
}