'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './favourites.module.css';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;

function convertToArabicNumber(num) {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
}

export default function FavouritesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('verses');
  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const fetchFavourites = useCallback(async (loggedInUser) => {
    if (!loggedInUser) return;
    setIsLoading(true);
    try {
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const allVerses = data.favorites?.verses || {};
        const formattedVerses = Object.entries(allVerses).map(([key, val]) => ({
          id: key,
          ...val
        }));
        setFavourites(formattedVerses);
      }
    } catch (e) {
      setError('فشل تحميل المفضلة.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
        if (!loggedInUser) {
          router.push('/intro');
        } else {
          setUser(loggedInUser);
          fetchFavourites(loggedInUser);
        }
      });
      return () => unsubscribe();
    }
  }, [router, fetchFavourites]);

  const handleRemove = useCallback(async (itemToRemove) => {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentVerses = userSnap.data().favorites?.verses || {};
        delete currentVerses[itemToRemove.id];
        await updateDoc(userRef, { "favorites.verses": currentVerses });
        setFavourites(Object.entries(currentVerses).map(([key, val]) => ({
          id: key,
          ...val
        })));
      }
    } catch (e) {
      setError('فشل حذف العنصر.');
    }
  }, [user]);

  const getReferenceText = (item) => {
    return `${item.bookName || item.book} ${convertToArabicNumber(item.ch + 1)}:${convertToArabicNumber(item.v + 1)}`;
  };

  if (!user && isLoading) return <div className={styles.loadingMessage}>جاري التحقق...</div>;

  return (
    <main className={`${styles.container} ${styles.ar}`}>
      <h1 className={styles.title}>⭐ المفضلة</h1>
      <nav className={styles.tabContainer}>
        <div className={`${styles.tab} ${activeTab === 'verses' ? styles.activeTab : ''}`} onClick={() => setActiveTab('verses')}>آيات</div>
        <div className={`${styles.tab} ${activeTab === 'chapters' ? styles.activeTab : ''}`} style={{ opacity: 0.5, cursor: 'not-allowed' }}>اصحاحات (قريباً)</div>
      </nav>
      {isLoading ? (
        <div className={styles.loadingMessage}>جاري التحميل...</div>
      ) : error ? (
        <div className={styles.errorMessage}>{error}</div>
      ) : favourites.length === 0 ? (
        <div className={styles.emptyMessage}>لا توجد عناصر مفضلة.</div>
      ) : (
        <ul className={styles.favouritesList}>
          {favourites.map((item) => (
            <li key={item.id} className={styles.favouriteItem}>
              <div className={styles.favouriteContent}>
                <p className={styles.favouriteText}>{item.text}</p>
                <div className={styles.favouriteMeta}>
                  <span className={styles.favouriteReference}>{getReferenceText(item)}</span>
                </div>
              </div>
              <button onClick={() => handleRemove(item)} className={styles.removeButton} aria-label="حذف">✖</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}