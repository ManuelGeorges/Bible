'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { FaCoins, FaSnowflake, FaPalette, FaMedal, FaShoppingCart } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import { getCairoIsoString } from '../../lib/dateUtils';
import { StorageService, KEYS } from '../../lib/storage';
import { useTheme } from 'next-themes';

export default function Shop() {
  const { strings, dir, formatNumber } = useLanguage();
  const { setTheme } = useTheme();
  const [userData, setUserData] = useState({ totalPoints: 0, streakFreezes: 0, inventory: [] });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
          setLoading(false);
        });
        return () => unsubDoc();
      } else {
        // تحميل البيانات المحلية للضيف
        const stats = await StorageService.getLocalStats();
        setUserData({
          totalPoints: stats.points || 0,
          streakFreezes: stats.streakFreezes || 0,
          inventory: stats.inventory || []
        });
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const shopItems = [
    {
      id: 'streak_freeze',
      category: 'utility',
      icon: <FaSnowflake />,
      name: strings.shop?.items?.streak_freeze?.name || 'تجميد الستريك',
      desc: strings.shop?.items?.streak_freeze?.desc || 'يحمي سلسلة أيامك من الانكسار إذا نسيت فتح التطبيق يوماً واحداً.',
      price: 500,
      type: 'consumable'
    },
    {
      id: 'theme_gold',
      category: 'appearance',
      icon: <FaPalette />,
      name: strings.shop?.items?.theme_gold?.name || 'المظهر الذهبي',
      desc: strings.shop?.items?.theme_gold?.desc || 'تمتع بواجهة ذهبية فاخرة تليق بكونك قارئاً متميزاً.',
      price: 6000,
      type: 'unlockable'
    },
    {
      id: 'title_word_lover',
      category: 'social',
      icon: <FaMedal />,
      name: strings.shop?.items?.title_word_lover?.name || 'لقب: محب الكلمة',
      desc: strings.shop?.items?.title_word_lover?.desc || 'لقب شرفي يظهر بجانب اسمك في لوحة المتصدرين.',
      price: 1000,
      type: 'unlockable'
    }
  ];

  const handleBuy = async (item) => {
    const currentPoints = userData?.totalPoints || 0;

    if (currentPoints < item.price) {
      toast.error(strings.shop?.insufficient_points || 'نقاطك غير كافية');
      return;
    }

    try {
      if (user) {
        // الشراء للمستخدم المسجل (Firebase)
        const userRef = doc(db, 'users', user.uid);
        const updates = {
          totalPoints: increment(-item.price),
          pointsHistory: arrayUnion({
            type: 'shop_purchase',
            points: -item.price,
            reason: `شراء: ${item.name}`,
            timestamp: getCairoIsoString()
          })
        };

        if (item.id === 'streak_freeze') {
          updates.streakFreezes = increment(1);
        } else {
          updates.inventory = arrayUnion(item.id);
        }

        await updateDoc(userRef, updates);
      } else {
        // الشراء للضيف (Local Storage)
        await StorageService.addPoints(-item.price);

        if (item.id === 'streak_freeze') {
          const currentFreezes = (await StorageService.get(KEYS.STREAK_FREEZES)) || 0;
          await StorageService.save(KEYS.STREAK_FREEZES, currentFreezes + 1);
        } else {
          const currentInventory = (await StorageService.get(KEYS.INVENTORY)) || [];
          if (!currentInventory.includes(item.id)) {
            currentInventory.push(item.id);
            await StorageService.save(KEYS.INVENTORY, currentInventory);
          }
        }

        const history = (await StorageService.get(KEYS.POINTS_HISTORY)) || [];
        history.push({
          type: 'shop_purchase',
          points: -item.price,
          reason: `شراء: ${item.name}`,
          timestamp: getCairoIsoString()
        });
        await StorageService.save(KEYS.POINTS_HISTORY, history);

        // تحديث الواجهة فوراً للضيف
        setUserData(prev => ({
          ...prev,
          totalPoints: prev.totalPoints - item.price,
          streakFreezes: item.id === 'streak_freeze' ? prev.streakFreezes + 1 : prev.streakFreezes,
          inventory: item.id !== 'streak_freeze' ? [...prev.inventory, item.id] : prev.inventory
        }));
      }

      toast.success(strings.shop?.purchase_success?.replace('{item}', item.name) || `تم شراء ${item.name} بنجاح!`);

      // إذا اشترى الثيم الذهبي، حوله إليه فوراً
      if (item.id === 'theme_gold') {
        setTheme('gold');
      }

    } catch (error) {
      console.error("Purchase Error:", error);
      toast.error(strings.common.error_occurred);
    }
  };

  if (loading) return <div className={styles.container}><p>{strings.common.loading}</p></div>;

  return (
    <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
      <h1 className={styles.header}>{strings.shop?.title || 'متجر أجيوس'}</h1>
      <p className={styles.subtitle}>{strings.shop?.subtitle || 'استبدل نقاطك بمزايا وخصائص حصرية'}</p>

      <div className={styles.pointsDisplay}>
        <FaCoins className={styles.pointsIcon} />
        <span className={styles.pointsValue}>{formatNumber(userData?.totalPoints || 0)}</span>
      </div>

      <div className={styles.categorySection}>
        <h2 className={styles.categoryTitle}>{strings.shop?.categories?.utility || 'أدوات المساعدة'}</h2>
        <div className={styles.shopGrid}>
          {shopItems.filter(i => i.category === 'utility').map(item => (
            <div key={item.id} className={styles.itemCard}>
              <div className={styles.iconContainer}>{item.icon}</div>
              <h3 className={styles.itemName}>{item.name}</h3>
              <p className={styles.itemDesc}>{item.desc}</p>
              {userData?.streakFreezes > 0 && item.id === 'streak_freeze' && (
                <span className={styles.ownedBadge}>{formatNumber(userData.streakFreezes)} مملوك</span>
              )}
              <button
                className={styles.buyButton}
                onClick={() => handleBuy(item)}
              >
                <FaShoppingCart /> {formatNumber(item.price)} {strings.points?.points_unit || 'نقطة'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.categorySection}>
        <h2 className={styles.categoryTitle}>{strings.shop?.categories?.appearance || 'المظهر والتميز'}</h2>
        <div className={styles.shopGrid}>
          {shopItems.filter(i => i.category !== 'utility').map(item => {
            const isOwned = userData?.inventory?.includes(item.id);
            return (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.iconContainer}>{item.icon}</div>
                <h3 className={styles.itemName}>{item.name}</h3>
                <p className={styles.itemDesc}>{item.desc}</p>
                {isOwned && <span className={styles.ownedBadge}>{strings.shop?.owned || 'مملوك'}</span>}
                <button
                  className={styles.buyButton}
                  onClick={() => handleBuy(item)}
                  disabled={isOwned}
                >
                  {isOwned ? strings.shop?.owned || 'مملوك' : <><FaShoppingCart /> {formatNumber(item.price)} {strings.points?.points_unit || 'نقطة'}</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
