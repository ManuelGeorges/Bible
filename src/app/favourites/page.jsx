"use client";

import { useState, useEffect, useCallback } from 'react';
import styles from './favourites.module.css';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';

const HIGHLIGHT_COLORS = [
  '#FFC107', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFECB3',
  '#F8BBD0', '#E1BEE7', '#CFD8DC'
];

export default function FavouritesPage() {
  const router = useRouter();
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

  const fetchData = useCallback(async (userId) => {
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', userId);
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
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/intro'); } 
      else { setUser(u); fetchData(u.uid); }
    });
    return () => unsub();
  }, [router, fetchData]);

  const saveColorLabel = async () => {
    if (!user || !editingColor) return;
    const newLabels = { ...colorLabels, [editingColor]: tempLabel };
    setColorLabels(newLabels);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        'favorites.colorLabels': newLabels
      });
      setEditingColor(null);
    } catch (e) {
      alert("حدث خطأ أثناء حفظ التسمية");
    }
  };

  const handleRemove = async (item) => {
    if (!user) return;
    setAllData(prev => prev.filter(i => i.id !== item.id));
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`favorites.verses.${item.id}`]: deleteField()
      });
    } catch (e) { fetchData(user.uid); }
  };

  const filteredItems = allData.filter(item => {
    if (activeTab === 'notes') return !!item.note;
    if (selectedColor) return item.color === selectedColor;
    return false; 
  });

  if (isLoading) return <div className={styles.loadingMessage}>جاري التحميل...</div>;

  return (
    <main className={`${styles.container} ${styles.ar}`}>
      <h1 className={styles.title}> كنوزي ⭐</h1>

      <nav className={styles.tabContainer}>
        <div className={`${styles.tab} ${activeTab === 'favourites' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('favourites'); setSelectedColor(null); }}>
          المفضلة
        </div>
        <div className={`${styles.tab} ${activeTab === 'notes' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('notes'); setSelectedColor(null); }}>
          الملحوظات
        </div>
      </nav>

      {activeTab === 'favourites' && (
        <div className={styles.colorPickerContainer}>
          <p className={styles.pickerTitle}>تصنيفات الألوان:</p>
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
                      {colorLabels[color] || 'بدون عنوان'}
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
            <h3>تسمية اللون</h3>
            <div className={styles.previewDot} style={{ backgroundColor: editingColor }} />
            <input 
              type="text" 
              value={tempLabel} 
              onChange={(e) => setTempLabel(e.target.value)} 
              placeholder="مثلاً: آيات تعزية، وعود..."
            />
            <div className={styles.modalActions}>
              <button onClick={saveColorLabel} className={styles.saveBtn}>حفظ</button>
              <button onClick={() => setEditingColor(null)} className={styles.cancelBtn}>إلغاء</button>
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
    // لو الآية جاية من "آية اليوم" ومعاها مرجع جاهز اعرضه فوراً
    item.reference
  ) : (
    // لو آية قديمة من الكتاب المقدس، اعرضها بالنظام القديم
    `${item.book} ${convertToArabicNumber((item.ch || 0) + 1)}:${convertToArabicNumber((item.v || 0) + 1)}`
  )}
</span>
              </div>
            </div>
            <button onClick={() => handleRemove(item)} className={styles.removeButton}>✖</button>
          </li>
        ))}
        {activeTab === 'favourites' && !selectedColor && (
          <div className={styles.emptyPrompt}>اختر تصنيفاً من الأعلى لعرض الآيات</div>
        )}
      </ul>
    </main>
  );
}