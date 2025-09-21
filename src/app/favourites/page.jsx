'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './favourites.module.css';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '/lib/firebase';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;
export const metadata = {
  title: ' الآيات المفضلة | Agios Bible',
  description:"احفظ جميع آياتك المفضلة في مكان واحد للوصول السريع في أي وقت من أي جهاز",
  keywords: ['Agios Bible, Agios ,الآيات المفضلة , آياتي المفضلةBible, الكتاب المقدس, Full Bible, الإنجيل, الآيات'],
  openGraph: {
    title: 'الآيات المفضلة | Agios Bible',
     description:"احفظ جميع آياتك المفضلة في مكان واحد للوصول السريع في أي وقت من أي جهاز",

    type: 'website',
    url: 'https://agios-bible.vercel.app/favourites',
    siteName: 'Agios Bible',
    locale: 'ar_AR',
  },
};
function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d]).join('');
}

export default function FavouritesPage() {
  const [activeTab, setActiveTab] = useState('verses');
  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const saveFavouritesToLocalStorage = useCallback((key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, []);

  const saveFavouritesToFirebase = useCallback(async (loggedInUser, key, data) => {
    if (!loggedInUser || !firestore) return;
    try {
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      await setDoc(userRef, {
        favorites: { [key]: data }
      }, { merge: true });
    } catch (e) {
      console.error("Error saving favorites to Firebase:", e);
    }
  }, []);

  const fetchFavourites = useCallback(async (loggedInUser) => {
    setIsLoading(true);
    setError('');
    try {
      const key = activeTab === 'verses' ? 'verses' : 'chapters';
      const localStorageKey = `favourite_${key}`;
      
      const localData = JSON.parse(localStorage.getItem(localStorageKey)) || {};
      let firestoreData = {};

      if (loggedInUser) {
        const userRef = doc(firestore, 'users', loggedInUser.uid);
        const userSnap = await getDoc(userRef);
        firestoreData = userSnap.exists() && userSnap.data().favorites ? userSnap.data().favorites[key] || {} : {};

        const mergedData = { ...firestoreData, ...localData };
        setFavourites(Object.values(mergedData));
        saveFavouritesToLocalStorage(localStorageKey, mergedData);
        saveFavouritesToFirebase(loggedInUser, key, mergedData);
      } else {
        setFavourites(Object.values(localData));
      }
    } catch (e) {
      console.error(e);
      setError('فشل تحميل المفضلة.');
      setFavourites([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, saveFavouritesToLocalStorage, saveFavouritesToFirebase]);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
        setUser(loggedInUser);
        fetchFavourites(loggedInUser);
      });
      return () => unsubscribe();
    }
  }, [fetchFavourites]);

  const handleRemove = useCallback(async (itemToRemove) => {
    try {
      let key, itemIdentifier;
      if (itemToRemove.type === 'verse') {
        key = 'verses';
        itemIdentifier = itemToRemove.verseKey;
      } else if (itemToRemove.type === 'chapter') {
        key = 'chapters';
        itemIdentifier = itemToRemove.chapterKey;
      }
      
      if (!key || !itemIdentifier) return;

      const localStorageKey = `favourite_${key}`;
      const existingFavourites = JSON.parse(localStorage.getItem(localStorageKey)) || {};
      delete existingFavourites[itemIdentifier];
      saveFavouritesToLocalStorage(localStorageKey, existingFavourites);

      if (user) {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const firestoreFavourites = userSnap.exists() && userSnap.data().favorites ? userSnap.data().favorites[key] || {} : {};
        delete firestoreFavourites[itemIdentifier];
        await setDoc(userRef, {
          favorites: { [key]: firestoreFavourites }
        }, { merge: true });
      }

      setFavourites(Object.values(existingFavourites));
    } catch (e) {
      console.error('Failed to remove item:', e);
      setError('فشل حذف العنصر.');
    }
  }, [saveFavouritesToLocalStorage, user]);

  const getReferenceText = (item) => {
    const bookName = item.bookName;
    const chapterNumber = item.chapter + 1;
    let reference = `${bookName} ${convertToArabicNumber(chapterNumber)}`;
    if (item.verseIndex !== undefined) {
      reference += `:${convertToArabicNumber(item.verseIndex + 1)}`;
    }
    return reference;
  };

  return (
    <main className={`${styles.container} ${styles.ar}`}>
      <h1 className={styles.title}>⭐ المفضلة</h1>

      <nav className={styles.tabContainer}>
        <div
          className={`${styles.tab} ${activeTab === 'verses' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('verses')}
        >
          آيات
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'chapters' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('chapters')}
        >
          اصحاحات
        </div>
      </nav>

      {isLoading && (
        <div className={styles.loadingMessage}>
          جاري التحميل...
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}

      {!isLoading && !error && favourites.length === 0 && (
        <div className={styles.emptyMessage}>
          لا توجد عناصر مفضلة.
        </div>
      )}

      {!isLoading && !error && favourites.length > 0 && (
        <ul className={styles.favouritesList}>
          {favourites.map((item) => (
            <li key={item.verseKey || item.chapterKey} className={styles.favouriteItem}>
              <div className={styles.favouriteContent}>
                <p className={styles.favouriteText}>
                  {item.text}
                </p>
                <div className={styles.favouriteMeta}>
                  <span className={styles.favouriteReference}>
                    {getReferenceText(item)}
                  </span>
                  {item.dateAdded && (
                    <span className={styles.dateAdded}>
                      (
                      أُضيف في: {new Date(item.dateAdded).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                      )
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(item)}
                className={styles.removeButton}
                aria-label="حذف من المفضلة"
              >
                ✖
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}