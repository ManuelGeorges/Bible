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
import strings from '../data/ar.json';

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

    setUserStats({
      verses: Object.keys(localFavs).length,
      chapters: 0,
      plans: 0,
      joinDate: strings.profile.guest_date,
      points: localStats.points || 0
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
            : 'N/A';

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
      title: strings.profile.share_title,
      text: strings.profile.share_text,
      url: 'https://play.google.com/store/apps/details?id=com.agios.bible', 
      dialogTitle: strings.profile.share_dialog,
    };

    if (Capacitor.isNativePlatform()) {
      await Share.share(shareData);
    } else {
      if (navigator.share) {
        navigator.share(shareData);
      } else {
        alert(strings.profile.share_not_supported);
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

    const confirmed = window.confirm(strings.profile.delete_confirm);
    if (confirmed) {
      try {
        const userId = currentUser.uid;
        await deleteUser(currentUser);
        await deleteDoc(doc(db, 'users', userId));
        router.push('/');
      } catch (error) {
        alert("An error occurred");
      }
    }
  };

  if (loading) return <div className={styles.loading}>{strings.common.loading}</div>;

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.profileHeader}>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {isGuest ? <User size={40} /> : (userData?.displayName?.[0] || user?.displayName?.[0] || <User size={40} />)}
          </div>
        </div>
        <h1 className={styles.userName}>
          {isGuest ? strings.profile.guest_user : (userData?.displayName || user?.displayName || strings.profile.friend_agios)}
        </h1>
        {!isGuest && (
          <>
            <p className={styles.userEmail}><Mail size={14} /> {user?.email}</p>
            <p className={styles.joinDate}><Calendar size={14} /> {strings.profile.member_since.replace('{date}', userStats.joinDate)}</p>
          </>
        )}
      </div>

      <div className={styles.statsOverview}>
        <div className={styles.statBox} onClick={() => router.push('/favourites')}>
          <Heart className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.verses}</span>
          <span className={styles.statLabel}>{strings.profile.fav_verses}</span>
        </div>
        <div className={styles.statBox}>
          <Trophy className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.points}</span>
          <span className={styles.statLabel}>{strings.profile.points_label}</span>
        </div>
        <div className={styles.statBox} onClick={() => router.push('/studyPlans')}>
          <Activity className={styles.statIcon} size={20} />
          <span className={styles.statValue}>{userStats.plans}</span>
          <span className={styles.statLabel}>{strings.profile.active_plans_count}</span>
        </div>
      </div>

      <div className={styles.menuSection}>
        {!isGuest && (
          <>
            <h3 className={styles.menuTitle}>{strings.profile.account_section}</h3>
            <button className={`${styles.menuItem} ${styles.logout}`} onClick={handleLogout}>
              <div className={styles.menuItemRight}>
                <LogOut size={20} />
                <span>{strings.profile.logout}</span>
              </div>
            </button>
          </>
        )}

        <h3 className={styles.menuTitle}>{strings.profile.general_options}</h3>
        
        <button className={styles.menuItem} onClick={() => router.push('/settings')}>
          <div className={styles.menuItemRight}>
            <SettingsIcon size={20} />
            <span>{strings.profile.app_settings}</span>
          </div>
        </button>

        <button className={styles.menuItem} onClick={() => router.push('/points')}>
          <div className={styles.menuItemRight}>
            <Trophy size={20} />
            <span>{strings.profile.points_badges}</span>
          </div>
        </button>

        <button className={styles.menuItem} onClick={handleShareApp}>
          <div className={styles.menuItemRight}>
            <Share2 size={20} />
            <span>{strings.profile.invite_friend}</span>
          </div>
        </button>

        {!isGuest && (
          <button className={`${styles.menuItem} ${styles.deleteAccount}`} onClick={handleDeleteAccount}>
            <div className={styles.menuItemRight}>
              <Trash2 size={20} />
              <span>{strings.profile.delete_account}</span>
            </div>
          </button>
        )}
      </div>

      <footer className={styles.profileFooter}>
        <p>{strings.profile.version}</p>
      </footer>
    </div>
  );
};

export default ProfilePage;
