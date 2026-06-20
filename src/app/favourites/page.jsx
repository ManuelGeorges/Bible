"use client";

import { useState, useEffect, useCallback } from 'react';
import styles from './favourites.module.css';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { StorageService, KEYS } from '../../lib/storage';

const HIGHLIGHT_COLORS = [
  '#FFC107', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFECB3',
  '#F8BBD0', '#E1BEE7', '#CFD8DC'
];

export default function FavouritesPage() {
  const router = useRouter();
  const { strings } = useLanguage();
  const [activeTab, setActiveTab] = useState('favourites'); 
  const [selectedColor, setSelectedColor] = useState(null); 
  const [allData, setAllData] = useState([]);
  const [colorLabels, setColorLabels] = useState({});
  const [editingColor, setEditingColor] = useState(null);
  const [tempLabel, setTempLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d] || d).join('');
  };

  const fetchData = useCallback(async (u) => {
    setIsLoading(true);
    try {
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const verses = data.favorites?.verses || {};
          const formatted = Object.entries(verses).map(([key, val]) => ({
            id: key,
            ...val
          }));
          setAllData(formatted);
          setColorLabels(data.favorites?.colorLabels || {});
        }
      } else {
        const localFavs = await StorageService.get(KEYS.FAVORITES) || {};
        const formatted = Object.entries(localFavs).map(([key, val]) => ({
          id: key,
          ...val
        }));
        setAllData(formatted);
        const localLabels = await StorageService.get('color_labels') || {};
        setColorLabels(localLabels);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      fetchData(u);
    });
    return () => unsub();
  }, [fetchData]);

  const saveColorLabel = async () => {
    if (!editingColor) return;
    const newLabels = { ...colorLabels, [editingColor]: tempLabel };
    setColorLabels(newLabels);

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          'favorites.colorLabels': newLabels
        });
      } catch (e) {
        alert(strings.favourites.error_save);
      }
    } else {
      await StorageService.save('color_labels', newLabels);
    }
    setEditingColor(null);
  };

  const handleRemove = async (item) => {
    setAllData(prev => prev.filter(i => i.id !== item.id));

    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          [`favorites.verses.${item.id}`]: deleteField()
        });
      } catch (e) { fetchData(user); }
    } else {
      const localFavs = await StorageService.get(KEYS.FAVORITES) || {};
      delete localFavs[item.id];
      await StorageService.save(KEYS.FAVORITES, localFavs);
    }
  };

  const filteredItems = allData.filter(item => {
    if (activeTab === 'notes') return !!item.note;
    if (selectedColor) return item.color === selectedColor;
    return false; 
  });

  if (isLoading) return <div className={styles.loadingMessage}>{strings.common.loading}</div>;

  return (
    <main className={`${styles.container} ${styles.ar}`}>
      <h1 className={styles.title}>{strings.favourites.title}</h1>

      <nav className={styles.tabContainer}>
        <div className={`${styles.tab} ${activeTab === 'favourites' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('favourites'); setSelectedColor(null); }}>
          {strings.favourites.tab_favs}
        </div>
        <div className={`${styles.tab} ${activeTab === 'notes' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('notes'); setSelectedColor(null); }}>
          {strings.favourites.tab_notes}
        </div>
      </nav>

      {activeTab === 'favourites' && (
        <div className={styles.colorPickerContainer}>
          <p className={styles.pickerTitle}>{strings.favourites.color_categories}</p>
          <div className={styles.colorGrid}>
            {HIGHLIGHT_COLORS.map((color, idx) => {
              const count = allData.filter(i => i.color === color).length;
              if (count === 0) return null;
              return (
                <div key={idx} className={styles.colorWrapper}>
                  <span 
                    className={`${styles.colorDot} ${selectedColor === color ? styles.activeColor : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                  <div className={styles.labelRow} onClick={() => { setEditingColor(color); setTempLabel(colorLabels[color] || ''); }}>
                    <span className={styles.colorLabelText}>
                      {colorLabels[color] || strings.favourites.no_title}
                    </span>
                    <button className={styles.inlineEditBtn}>✎</button>
                  </div>
                  <span className={styles.colorCount}>({convertToArabicNumber(count)})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingColor && (
        <div className={styles.modalOverlay}>
          <div className={styles.editModal}>
            <h3>{strings.favourites.modal_title}</h3>
            <div className={styles.previewDot} style={{ backgroundColor: editingColor }} />
            <input 
              type="text" 
              value={tempLabel} 
              onChange={(e) => setTempLabel(e.target.value)} 
              placeholder={strings.favourites.modal_placeholder}
            />
            <div className={styles.modalActions}>
              <button onClick={saveColorLabel} className={styles.saveBtn}>{strings.common.save}</button>
              <button onClick={() => setEditingColor(null)} className={styles.cancelBtn}>{strings.common.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <ul className={styles.favouritesList}>
        {filteredItems.map((item) => (
          <li key={item.id} className={styles.favouriteItem} style={{ borderRight: `5px solid ${item.color}` }}>
            <div className={styles.favouriteContent}>
              <p className={styles.favouriteText}>{item.text}</p>
              {item.note && <div className={styles.userNote}><p>{item.note}</p></div>}
              <div className={styles.favouriteMeta}>
                <span className={styles.favouriteReference}>
                  {item.reference ? (
                    item.reference
                  ) : (
                    `${item.book} ${convertToArabicNumber((item.ch || 0) + 1)}:${convertToArabicNumber((item.v || 0) + 1)}`
                  )}
                </span>
              </div>
            </div>
            <button onClick={() => handleRemove(item)} className={styles.removeButton}>✖</button>
          </li>
        ))}
        {activeTab === 'favourites' && !selectedColor && (
          <div className={styles.emptyPrompt}>{strings.favourites.empty_color_prompt}</div>
        )}
        {filteredItems.length === 0 && (selectedColor || activeTab === 'notes') && (
          <div className={styles.emptyPrompt}>{strings.favourites.empty_list}</div>
        )}
      </ul>
    </main>
  );
}
