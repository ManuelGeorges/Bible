'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, getAuth, deleteUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { 
  User, Mail, Calendar, Share2, LogOut, Trash2,
  BookOpen, Heart, Activity, Trophy, Settings as SettingsIcon,
  LogIn, UserPlus, CloudSync
} from 'lucide-react';
import styles from './profile.module.css';
import { StorageService } from '../../lib/storage';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [userStats, setUserStats] = useState({
    verses: 0,
    chapters: 0,
    plans: 0,
    joinDate: '',
    points: 0
  });
  const router = useRouter();

  const fetchLocalProfile = useCallback(async () => {
    const localStats = await StorageService.getLocalStats();
    const localFavs = localStats.favorites || {};
    const localNotes = localStats.notes || [];

    // محاكاة إحصائيات للضيف
    setUserStats({
      verses: Object.keys(localFavs).length,
      chapters: 0, // يمكن تطويرها لاحقاً لتخزين الفصول محلياً
      plans: 0,
      joinDate: 'زائر',
      points: localStats.points
    });
    setLoading(false);
    setIsGuest(true);
  }, []);

  const fetchProfileData = useCallback(async (currentUser) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);

      const unsubscribeSnap = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);

          const versesCount = data.favorites?.verses ? Object.keys(data.favorites.verses).length : 0;
          const completedChaptersCount = data.completedChapters ? Object.keys(data.completedChapters).filter(k => data.completedChapters[k] === true).length : 0;
          const staticPlansCount = data.completedPlans ? Object.keys(data.completedPlans).length : 0;
          const customPlansCount = data.customPlans ? Object.keys(data.customPlans).length : 0;

          const registrationDate = currentUser.metadata.creationTime
            ? new Date(currentUser.metadata.creationTime).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                timeZone: 'Africa/Cairo'
              })
            : 'غير متوفر';

          setUserStats({
            verses: versesCount,
            chapters: completedChaptersCount,
            plans: staticPlansCount + customPlansCount,
            joinDate: registrationDate,
            points: data.totalPoints || 0
          });
        }
        setLoading(false);
        setIsGuest(false);
      });

      return unsubscribeSnap;
    } catch (e) {
      console.error("Profile Fetch Error:", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    let unsubSnap = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        unsubSnap = await fetchProfileData(currentUser);
      } else {
        setUser(null);
        await fetchLocalProfile();
      }
    });

    return () => {
        unsubscribeAuth();
        unsubSnap();
    };
  }, [router, fetchProfileData, fetchLocalProfile]);

  const handleShareApp = async () => {
    const shareData = {
      title: 'تطبيق أجيوس',
      text: 'حمل أبليكيشن أجيوس واقرأ الكتاب المقدس بطريقة جديدة!',
      url: 'https://play.google.com/store/apps/details?id=com.agios.bible', 
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
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const lastSignInTime = new Date(currentUser.metadata.lastSignInTime).getTime();
    const now = new Date().getTime();
    const isFreshSession = (now - lastSignInTime) < (5 * 60 * 1000);

    if (!isFreshSession) {
      alert("لدواعي أمنية، يتطلب حذف الحساب تسجيل دخول حديث. يرجى تسجيل الخروج ثم الدخول مرة أخرى والمحاولة مجدداً.");
      return;
    }

    const confirmed = window.confirm(
      "هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح جميع بياناتك من السحابة."
    );

    if (confirmed) {
      try {
        const userId = currentUser.uid;
        await deleteUser(currentUser);
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
        alert("تم حذف الحساب والبيانات بنجاح.");
        router.push('/');
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("حدث خطأ أثناء حذف الحساب.");
      }
    }
  };

  if (loading) return <div className={styles.loading}>جاري التحميل...</div>;

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.profileHeader}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {isGuest ? <User size={40} /> : (userData?.displayName?.[0] || user?.displayName?.[0] || <User size={40} />)}
          </div>
        </div>
        <h1 className={styles.userName}>
          {isGuest ? 'حساب زائر' : (userData?.displayName || user?.displayName || 'صديق أجيوس')}
        </h1>
        {isGuest ? (
          <p className={styles.guestHint}>سجل دخولك لحفظ بياناتك في السحابة</p>
        ) : (
          <>
            <p className={styles.userEmail}><Mail size={14} /> {user?.email}</p>
            <p className={styles.joinDate}><Calendar size={14} /> عضو منذ: {userStats.joinDate}</p>
          </>
        )}
      </div>

      <div className={styles.statsOverview}>
        <div className={styles.statBox} onClick={() => router.push('/favourites')}>
          <Heart className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.verses}</span>
          <span className={styles.statLabel}>آيات مفضلة</span>
        </div>
        <div className={styles.statBox}>
          <Trophy className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.points}</span>
          <span className={styles.statLabel}>XP</span>
        </div>
        <div className={styles.statBox} onClick={() => router.push('/studyPlans')}>
          <Activity className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.plans}</span>
          <span className={styles.statLabel}>خطط نشطة</span>
        </div>
      </div>

      <div className={styles.menuSection}>
        <h3 className={styles.menuTitle}>الحساب</h3>

        {isGuest ? (
          <>
            <button className={`${styles.menuItem} ${styles.loginBtn}`} onClick={() => router.push('/intro')}>
              <div className={styles.menuItemRight}>
                <LogIn size={20} />
                <span>تسجيل الدخول / إنشاء حساب</span>
              </div>
            </button>
          </>
        ) : (
          <button className={`${styles.menuItem} ${styles.logout}`} onClick={handleLogout}>
            <div className={styles.menuItemRight}>
              <LogOut size={20} />
              <span>تسجيل الخروج</span>
            </div>
          </button>
        )}

        <h3 className={styles.menuTitle}>الخيارات العامة</h3>
        
        <button className={styles.menuItem} onClick={() => router.push('/settings')}>
          <div className={styles.menuItemRight}>
            <SettingsIcon size={20} />
            <span>إعدادات التطبيق</span>
          </div>
        </button>

        <button className={styles.menuItem} onClick={() => router.push('/points')}>
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

        {!isGuest && (
          <button className={`${styles.menuItem} ${styles.deleteAccount}`} onClick={handleDeleteAccount}>
            <div className={styles.menuItemRight}>
              <Trash2 size={20} />
              <span>حذف الحساب</span>
            </div>
          </button>
        )}
      </div>

      <footer className={styles.profileFooter}>
        <p>تطبيق أجيوس - الإصدار 1.2.0</p>
      </footer>
    </div>
  );
};

export default ProfilePage;
