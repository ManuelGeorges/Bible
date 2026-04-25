'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { 
  User, Mail, Calendar, Share2, LogOut, 
  BookOpen, Heart, Activity, Trophy, Settings as SettingsIcon 
} from 'lucide-react';
import styles from './profile.module.css';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    verses: 0,
    chapters: 0,
    plans: 0,
    joinDate: ''
  });
  const router = useRouter();

  const fetchProfileData = useCallback(async (currentUser) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserData(data);

        const versesCount = data.favorites?.verses ? Object.keys(data.favorites.verses).length : 0;
        const completedChaptersCount = data.completedChapters ? Object.keys(data.completedChapters).filter(k => data.completedChapters[k] === true).length : 0;
        const activePlansCount = data.completedPlans ? Object.keys(data.completedPlans).length : 0;
        
        const registrationDate = currentUser.metadata.creationTime 
          ? new Date(currentUser.metadata.creationTime).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })
          : 'غير متوفر';

        setUserStats({
          verses: versesCount,
          chapters: completedChaptersCount,
          plans: activePlansCount,
          joinDate: registrationDate
        });
      }
    } catch (e) {
      console.error("Profile Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchProfileData(currentUser);
      } else {
        router.push('/intro');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, fetchProfileData]);

  const handleShareApp = async () => {
    const shareData = {
      title: 'تطبيق أجيوس',
      text: 'حمل أبليكيشن أجيوس واقرأ الكتاب المقدس بطريقة جديدة!',
      url: 'https://play.google.com/store/apps/details?id=com.agios.bible, 
      dialogTitle: 'مشاركة التطبيق مع الأصدقاء',
    };

    if (Capacitor.isNativePlatform()) {
      await Share.share(shareData);
    } else {
      if (navigator.share) {
        navigator.share(shareData);
      } else {
        alert('المشاركة غير مدعومة في المتصفح، يمكنك نسخ الرابط: ' + shareData.url);
      }
    }
  };

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/intro');
  };

  if (loading) return <div className={styles.loading}>جاري التحميل...</div>;
  if (!user) return null;

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.profileHeader}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {userData?.firstName?.[0] || user.displayName?.[0] || <User size={40} />}
          </div>
        </div>
        <h1 className={styles.userName}>{userData?.firstName || user.displayName || 'يا صديق'}</h1>
        <p className={styles.userEmail}><Mail size={14} /> {user.email}</p>
        <p className={styles.joinDate}><Calendar size={14} /> عضو منذ: {userStats.joinDate}</p>
      </div>

      <div className={styles.statsOverview}>
        <div className={styles.statBox}>
          <Heart className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.verses}</span>
          <span className={styles.statLabel}>آيات مفضلة</span>
        </div>
        <div className={styles.statBox}>
          <BookOpen className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.chapters}</span>
          <span className={styles.statLabel}>إصحاح مقروء</span>
        </div>
        <div className={styles.statBox}>
          <Activity className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.plans}</span>
          <span className={styles.statLabel}>خطط نشطة</span>
        </div>
      </div>

      <div className={styles.menuSection}>
        <h3 className={styles.menuTitle}>الخيارات العامة</h3>
        
        <button className={styles.menuItem} onClick={() => router.push('/settings')}>
          <div className={styles.menuItemRight}>
            <SettingsIcon size={20} />
            <span>إعدادات التطبيق</span>
          </div>
        </button>
        <button className={styles.menuItem} onClick={() => router.push('/settings')}>
          <div className={styles.menuItemRight}>
            <Trophy size={20} />
            <span>النقاط والأوسمة</span>
          </div>
        </button>

        <button className={styles.menuItem} onClick={handleShareApp}>
          <div className={styles.menuItemRight}>
            <Share2 size={20} />
            <span>دعوة صديق للتطبيق</span>
          </div>
        </button>

        <button className={`${styles.menuItem} ${styles.logout}`} onClick={handleLogout}>
          <div className={styles.menuItemRight}>
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </div>
        </button>
      </div>

      <footer className={styles.profileFooter}>
        <p>تطبيق أجيوس - الإصدار 1.2.0</p>
      </footer>
    </div>
  );
};

export default ProfilePage;