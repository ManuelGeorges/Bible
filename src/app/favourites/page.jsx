'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './favourites.module.css';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';

export default function FavouritesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('verses');
  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d] || d).join('');
  };

  const fetchFavourites = useCallback(async (userId) => {
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const allVerses = data.favorites?.verses || {};
        const formattedVerses = Object.entries(allVerses).map(([key, val]) => ({
          id: key,
          ...val
        }));
        setFavourites(formattedVerses);
        setError('');
      }
    } catch (e) {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        setError('تعذر الاتصال بالخادم. يتم العرض من الذاكرة المحلية.');
      } else {
        setError('فشل تحميل المفضلة.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
      if (!loggedInUser) {
        router.push('/intro');
      } else {
        setUser(loggedInUser);
        fetchFavourites(loggedInUser.uid);
      }
    });
    return () => unsubscribe();
  }, [router, fetchFavourites]);

  const handleRemove = async (itemToRemove) => {
    if (!user) return;

    const previousFavourites = [...favourites];
    setFavourites(prev => prev.filter(item => item.id !== itemToRemove.id));

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [`favorites.verses.${itemToRemove.id}`]: deleteField()
      });
    } catch (e) {
      setFavourites(previousFavourites);
      alert('فشل الحذف. تأكد من اتصالك بالإنترنت.');
    }
  };

  const getReferenceText = (item) => {
    return `${item.bookName || item.book} ${convertToArabicNumber(item.ch + 1)}:${convertToArabicNumber(item.v + 1)}`;
  };

  if (isLoading) return <div className={styles.loadingMessage}>جاري التحميل...</div>;

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
          className={styles.tab} 
          style={{ opacity: 0.5, cursor: 'not-allowed' }}
        >
          اصحاحات (قريباً)
        </div>
      </nav>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {favourites.length === 0 && !error ? (
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
              <button 
                onClick={() => handleRemove(item)} 
                className={styles.removeButton} 
                aria-label="حذف"
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