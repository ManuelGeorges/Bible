'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { 
  User, Mail, Calendar, Share2, LogOut, Trash2,
  BookOpen, Heart, Activity, Trophy, Settings as SettingsIcon,
  LogIn, CloudSync, Crown, Medal,
  ChevronRight, History, MessageSquare, Star,
  Flame, Target, Award, ExternalLink, Users
} from 'lucide-react';
import styles from './profile.module.css';
import { StorageService } from '../../lib/storage';
import { useLanguage } from '../context/LanguageContext';

// Import badge data for all supported languages
import badgesAr from '../data/translations/arabic/badges_ar.json';
import badgesEn from '../data/translations/English/badges_en.json';
import badgesFr from '../data/translations/French/badges_fr.json';
import badgesDe from '../data/translations/german/badges_de.json';

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
    points: 0,
    streak: 0,
    level: 1,
    nextLevelXP: 100
  });

  const router = useRouter();
  const { strings, dir, language } = useLanguage();

  // Select the correct badges data based on current language
  const badgesData = language === 'ar' ? badgesAr : language === 'fr' ? badgesFr : language === 'de' ? badgesDe : badgesEn;

  const calculateLevel = (points) => {
    const level = Math.floor(Math.sqrt(points / 50)) + 1;
    const nextLevelXP = Math.pow(level, 2) * 50;
    const currentLevelXP = Math.pow(level - 1, 2) * 50;
    const progress = Math.max(0, Math.min(100, ((points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100));
    return { level, nextLevelXP, progress };
  };

  const fetchLocalProfile = useCallback(async () => {
    const localStats = await StorageService.getLocalStats();
    const { level, nextLevelXP } = calculateLevel(localStats.points || 0);

    setUserStats({
      verses: Object.keys(localStats.favorites || {}).length,
      chapters: 0,
      plans: 0,
      joinDate: strings?.profile?.guest_date || 'Guest',
      points: localStats.points || 0,
      streak: localStats.streak || 0,
      level,
      nextLevelXP
    });

    setUserData({
      inventory: localStats.inventory || [],
      displayName: strings?.profile?.guest_user,
      badges: localStats.badges || []
    });

    setLoading(false);
    setIsGuest(true);
  }, [strings]);

  const fetchProfileData = useCallback(async (currentUser) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const unsubscribeSnap = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);

          const versesCount = data.favorites?.verses ? Object.keys(data.favorites.verses).length : 0;
          const completedChaptersCount = data.completedChapters ? Object.keys(data.completedChapters).filter(k => data.completedChapters[k] === true).length : 0;
          const plansCount = (data.completedPlans ? Object.keys(data.completedPlans).length : 0) + (data.customPlans ? Object.keys(data.customPlans).length : 0);

          const points = data.totalPoints || 0;
          const { level, nextLevelXP } = calculateLevel(points);

          const locale = language === 'ar' ? 'ar-EG' : language === 'fr' ? 'fr-FR' : language === 'de' ? 'de-DE' : 'en-US';
          const registrationDate = currentUser.metadata.creationTime
            ? new Date(currentUser.metadata.creationTime).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
            : 'N/A';

          setUserStats({
            verses: versesCount,
            chapters: completedChaptersCount,
            plans: plansCount,
            joinDate: String(registrationDate),
            points,
            streak: data.streak || 0,
            level,
            nextLevelXP
          });
        }
        setLoading(false);
        setIsGuest(false);
      });
      return unsubscribeSnap;
    } catch (e) {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
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
    return () => { unsubscribeAuth(); unsubSnap(); };
  }, [fetchProfileData, fetchLocalProfile]);

  const handleShareApp = async () => {
    const shareData = {
      title: strings?.profile?.share_title || 'Agios Bible',
      text: strings?.profile?.share_text || '',
      url: 'https://play.google.com/store/apps/details?id=com.agios.bible', 
    };
    if (Capacitor.isNativePlatform()) await Share.share(shareData);
    else if (navigator.share) navigator.share(shareData);
    else alert('Not supported');
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(strings?.profile?.delete_confirm || 'Are you sure?');
    if (confirmed && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid));
        await deleteUser(auth.currentUser);
        router.push('/');
      } catch (error) {
        alert("Please re-authenticate and try again.");
      }
    }
  };

  const getBadgeDetails = (badgeId) => {
    for (const family of badgesData.badge_families) {
      const badge = family.badges.find(b => b.id === badgeId);
      if (badge) return badge;
    }
    return null;
  };

  const getRarityColor = (rarity) => {
    const r = rarity?.toLowerCase();
    if (r === 'عادي' || r === 'common') return '#94a3b8';
    if (r === 'مميز' || r === 'uncommon') return '#10b981';
    if (r === 'نادر' || r === 'rare') return '#3b82f6';
    if (r === 'أسطوري' || r === 'epic') return '#8b5cf6';
    if (r === 'خرافي' || r === 'mythic') return '#f59e0b';
    if (r === 'سري' || r === 'secret') return '#f43f5e';
    return '#f59e0b';
  };

  if (loading) return <div className={styles.loading}>{strings?.common?.loading}</div>;

  const hasGoldTheme = userData?.inventory?.includes('theme_gold');
  const levelInfo = calculateLevel(userStats.points);

  return (
    <div className={`${styles.container} ${hasGoldTheme ? styles.goldProfile : ''}`} dir={dir}>

      <div className={styles.profileHeaderNoImage}>
        <div className={styles.userInfoTop}>
           <div className={styles.levelBadgeStandalone}>{userStats.level}</div>
           <h1 className={styles.userNameLarge}>
             {hasGoldTheme && <Crown className={styles.inlineCrown} size={28} />}
             {isGuest ? strings?.profile?.guest_user : (userData?.displayName || user?.displayName)}
             {!isGuest && <Award className={styles.verifiedIcon} size={24} />}
           </h1>
        </div>

        {userData?.inventory?.includes('title_word_lover') && (
            <div className={styles.titleBadge}>
                <Medal size={14} />
                <span>{strings?.shop?.items?.title_word_lover?.name || 'Word Lover'}</span>
            </div>
        )}

        {/* XP Progress Bar */}
        <div className={styles.xpProgressContainerLarge}>
          <div className={styles.xpText}>
            <span>{userStats.points} XP</span>
            <span>{userStats.nextLevelXP} XP</span>
          </div>
          <div className={styles.xpBarOuter}>
            <div className={styles.xpBarInner} style={{ width: `${levelInfo.progress}%` }}></div>
          </div>
        </div>

        <div className={styles.headerInfo}>
          {!isGuest && (
            <>
              <span className={styles.infoItem}><Mail size={14} /> {user?.email}</span>
              <span className={styles.infoItem}><Calendar size={14} /> {strings?.profile?.member_since?.replace('{date}', String(userStats.joinDate))}</span>
            </>
          )}
        </div>
      </div>

      {/* Modern Grid Stats */}
      <div className={styles.modernStatsGrid}>
        <div className={styles.modernStatCard} onClick={() => router.push('/points')}>
          <div className={`${styles.statIconWrapper} ${styles.bgOrange}`}>
            <Flame size={20} />
          </div>
          <div className={styles.statData}>
            <span className={styles.statValue}>{userStats.streak}</span>
            <span className={styles.statLabel}>{strings?.profile?.streak_days}</span>
          </div>
        </div>

        <div className={styles.modernStatCard} onClick={() => router.push('/favourites')}>
          <div className={`${styles.statIconWrapper} ${styles.bgPink}`}>
            <Heart size={20} />
          </div>
          <div className={styles.statData}>
            <span className={styles.statValue}>{userStats.verses}</span>
            <span className={styles.statLabel}>{strings?.profile?.fav_verses}</span>
          </div>
        </div>

        <div className={styles.modernStatCard} onClick={() => router.push('/studyPlans')}>
          <div className={`${styles.statIconWrapper} ${styles.bgBlue}`}>
            <Target size={20} />
          </div>
          <div className={styles.statData}>
            <span className={styles.statValue}>{userStats.plans}</span>
            <span className={styles.statLabel}>{strings?.profile?.active_plans_count}</span>
          </div>
        </div>
      </div>

      {/* Activity & History List */}
      <div className={styles.listSection}>
        <h3 className={styles.listTitle}>{strings?.profile?.my_activity}</h3>
        <div className={styles.menuCard}>
          <button className={styles.menuItem} onClick={() => router.push('/history')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgPurple}`}><History size={18} /></div>
              <span>{strings?.bible?.reading_history}</span>
            </div>
            <ChevronRight size={18} className={styles.chevron} />
          </button>

          <button className={styles.menuItem} onClick={() => router.push('/favourites?tab=notes')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgGreen}`}><MessageSquare size={18} /></div>
              <span>{strings?.profile?.my_notes_reflections}</span>
            </div>
            <ChevronRight size={18} className={styles.chevron} />
          </button>

          <button className={styles.menuItem} onClick={() => router.push('/points?tab=badges')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgYellow}`}><Award size={18} /></div>
              <span>{strings?.profile?.achievements}</span>
            </div>
            <div className={styles.badgeCount}>{userData?.badges?.length || 0}</div>
          </button>
        </div>
      </div>

      {/* Actual Badges Showcase - EARNED BADGES */}
      <div className={styles.sectionTitleRow}>
        <h3>{strings?.profile?.badges_section}</h3>
        <span onClick={() => router.push('/points?tab=badges')}>{strings?.common?.view_all}</span>
      </div>
      <div className={styles.earnedBadgesGrid}>
        {userData?.badges?.length > 0 ? (
          userData.badges.slice(0, 12).map((badgeId, idx) => {
            const details = getBadgeDetails(badgeId);
            return (
              <div
                key={idx}
                className={styles.realBadgeCard}
                onClick={() => router.push('/points?tab=badges')}
              >
                <div className={styles.realBadgeIconWrapper} style={{ border: `2px solid ${getRarityColor(details?.rarity)}` }}>
                  <Star size={20} style={{ color: getRarityColor(details?.rarity) }} />
                </div>
                <span className={styles.realBadgeName}>{details?.name || badgeId}</span>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyBadgesFull}>
            <Award size={40} opacity={0.2} />
            <p>{strings?.profile?.start_collecting_badges}</p>
          </div>
        )}
      </div>

      {isGuest && (
        <div className={styles.syncBanner}>
          <div className={styles.syncInfo}>
            <CloudSync size={28} />
            <div>
              <h4>{strings?.settings?.sync?.title}</h4>
              <p>{strings?.settings?.sync?.desc}</p>
            </div>
          </div>
          <button className={styles.loginAction} onClick={() => router.push('/intro')}>
            <LogIn size={18} />
            <span>{strings?.settings?.sync?.login_button}</span>
          </button>
        </div>
      )}

      {/* Community Access Buttons */}
      <div className={styles.listSection}>
        <div className={styles.menuCard}>
           <button className={styles.menuItem} onClick={() => router.push('/leaderboard')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgOrange}`}><Trophy size={18} /></div>
              <span>{strings?.profile?.leaderboard}</span>
            </div>
            <ChevronRight size={18} className={styles.chevron} />
          </button>

          <button className={styles.menuItem} onClick={() => router.push('/friends')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgBlue}`}><Users size={18} /></div>
              <span>{strings?.profile?.friends}</span>
            </div>
            <ChevronRight size={18} className={styles.chevron} />
          </button>
        </div>
      </div>

      {/* Settings Section */}
      <div className={styles.listSection}>
        <div className={styles.menuCard}>
          <button className={styles.menuItem} onClick={() => router.push('/settings')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgGray}`}><SettingsIcon size={18} /></div>
              <span>{strings?.profile?.app_settings}</span>
            </div>
            <ChevronRight size={18} className={styles.chevron} />
          </button>

          <button className={styles.menuItem} onClick={handleShareApp}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgBlueLight}`}><Share2 size={18} /></div>
              <span>{strings?.profile?.invite_friend}</span>
            </div>
            <ExternalLink size={16} />
          </button>

          {!isGuest && (
            <>
              <button className={`${styles.menuItem} ${styles.logoutText}`} onClick={handleLogout}>
                <div className={styles.menuItemLeft}>
                  <div className={`${styles.iconCircle} ${styles.bgRed}`}><LogOut size={18} /></div>
                  <span>{strings?.profile?.logout}</span>
                </div>
              </button>
              <button className={`${styles.menuItem} ${styles.deleteText}`} onClick={handleDeleteAccount}>
                <div className={styles.menuItemLeft}>
                  <div className={`${styles.iconCircle} ${styles.bgDarkRed}`}><Trash2 size={18} /></div>
                  <span>{strings?.profile?.delete_account}</span>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.profileFooter}>
        <p>{strings?.profile?.version}</p>
        <p>© 2026 Agios System</p>
      </div>
    </div>
  );
};

export default ProfilePage;
