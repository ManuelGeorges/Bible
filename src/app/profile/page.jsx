'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { doc, onSnapshot, deleteDoc, collection, query, where, getDocs, limit, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { 
  User, Mail, Calendar, Share2, LogOut, Trash2,
  BookOpen, Heart, Activity, Trophy, Settings as SettingsIcon,
  LogIn, CloudSync, Crown, Medal, Search,
  Users, ChevronRight, History, MessageSquare, Star,
  Flame, Target, Award, UserPlus, ExternalLink, Lock, Unlock
} from 'lucide-react';
import styles from './profile.module.css';
import { StorageService } from '../../lib/storage';
import { useLanguage } from '../context/LanguageContext';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Level logic: Level = floor(sqrt(points/50)) + 1
  const calculateLevel = (points) => {
    const level = Math.floor(Math.sqrt(points / 50)) + 1;
    const nextLevelXP = Math.pow(level, 2) * 50;
    const currentLevelXP = Math.pow(level - 1, 2) * 50;
    const progress = ((points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
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
      badges: localStats.badges || [],
      isPrivate: false
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

          const locale = language === 'ar' ? 'ar-EG' : 'en-US';
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

  // Search Logic (Real-time search in Firestore)
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        // Search by displayName prefix AND exclude private profiles
        const q = query(
          usersRef,
          where('displayName', '>=', searchQuery),
          where('displayName', '<=', searchQuery + '\uf8ff'),
          where('isPrivate', '==', false),
          limit(5)
        );
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
          if (doc.id !== user?.uid) {
            results.push({ id: doc.id, ...doc.data() });
          }
        });
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, user]);

  const togglePrivacy = async () => {
    if (isGuest || !user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        isPrivate: !userData.isPrivate
      });
    } catch (e) {
      console.error("Privacy Toggle Error:", e);
    }
  };

  const handleShareApp = async () => {
    const shareData = {
      title: strings?.profile?.share_title || 'Agios Bible',
      text: strings?.profile?.share_text || '',
      url: 'https://play.google.com/store/apps/details?id=com.agios.bible', 
    };
    if (Capacitor.isNativePlatform()) await Share.share(shareData);
    else navigator.share ? navigator.share(shareData) : alert('Not supported');
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

  if (loading) return <div className={styles.loading}>{strings?.common?.loading}</div>;

  const hasGoldTheme = userData?.inventory?.includes('theme_gold');
  const levelInfo = calculateLevel(userStats.points);

  return (
    <div className={`${styles.container} ${hasGoldTheme ? styles.goldProfile : ''}`} dir={dir}>

      {/* Search Bar Section */}
      <div className={styles.searchSection}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <input
            type="text"
            placeholder={strings?.profile?.search_friends || 'البحث عن أصدقاء...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {isSearching && <div className={styles.searchLoader} />}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map((res) => (
              <div key={res.id} className={styles.searchResultItem} onClick={() => router.push(`/profile/${res.id}`)}>
                <div className={styles.resAvatar}>{res.displayName?.[0]}</div>
                <div className={styles.resInfo}>
                  <span className={styles.resName}>{res.displayName}</span>
                  <span className={styles.resXP}>{res.totalPoints || 0} XP</span>
                </div>
                <UserPlus size={18} className={styles.addIcon} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.profileHeader}>
        <div className={styles.mainAvatarWrapper}>
          {hasGoldTheme && <Crown className={styles.crownIcon} size={40} />}
          <div className={`${styles.avatar} ${hasGoldTheme ? styles.goldAvatar : ''}`}>
            {isGuest ? <User size={45} /> : (userData?.displayName?.[0] || user?.displayName?.[0])}
          </div>
          <div className={styles.levelBadge}>{userStats.level}</div>
        </div>

        <h1 className={styles.userName}>
          {isGuest ? strings?.profile?.guest_user : (userData?.displayName || user?.displayName)}
          {!isGuest && <Award className={styles.verifiedIcon} size={20} />}
        </h1>

        {userData?.inventory?.includes('title_word_lover') && (
            <div className={styles.titleBadge}>
                <Medal size={14} />
                <span>{strings?.shop?.items?.title_word_lover?.name || 'محب الكلمة'}</span>
            </div>
        )}

        {/* XP Progress Bar */}
        <div className={styles.xpProgressContainer}>
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
            <span className={styles.statLabel}>{strings?.profile?.streak_days || 'يوم متواصل'}</span>
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

      {/* Community & Leaderboard Glass Card */}
      <div className={styles.glassSection}>
        <div className={styles.sectionHeader}>
          <h3>{strings?.profile?.community || 'المجتمع'}</h3>
          <Users size={20} />
        </div>
        <div className={styles.communityActions}>
          <button className={styles.actionBtn} onClick={() => router.push('/leaderboard')}>
            <Trophy size={20} />
            <span>{strings?.profile?.leaderboard || 'المتصدرين'}</span>
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/friends')}>
            <Users size={20} />
            <span>{strings?.profile?.friends || 'الأصدقاء'}</span>
          </button>
        </div>
      </div>

      {/* Activity & History List */}
      <div className={styles.listSection}>
        <h3 className={styles.listTitle}>{strings?.profile?.my_activity || 'نشاطي'}</h3>
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
              <span>{strings?.profile?.my_notes_reflections || 'ملاحظاتي وتأملاتي'}</span>
            </div>
            <ChevronRight size={18} className={styles.chevron} />
          </button>

          <button className={styles.menuItem} onClick={() => router.push('/points?tab=badges')}>
            <div className={styles.menuItemLeft}>
              <div className={`${styles.iconCircle} ${styles.bgYellow}`}><Award size={18} /></div>
              <span>{strings?.profile?.achievements || 'الإنجازات'}</span>
            </div>
            <div className={styles.badgeCount}>{userData?.badges?.length || 0}</div>
          </button>
        </div>
      </div>

      {/* Badges Preview */}
      <div className={styles.sectionTitleRow}>
        <h3>{strings?.profile?.badges_section || 'الأوسمة'}</h3>
        <span onClick={() => router.push('/points?tab=badges')}>{strings?.common?.view_all}</span>
      </div>
      <div className={styles.badgesShowcase}>
        {userData?.badges?.slice(0, 5).map((badge, idx) => (
          <div key={idx} className={styles.badgeMiniItem}>
            <Star size={20} className={styles.badgeIcon} />
          </div>
        )) || (
          <div className={styles.emptyBadges}>
            {strings?.profile?.start_collecting_badges || 'ابدأ رحلتك لجمع الأوسمة'}
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

      {/* Settings Section */}
      <div className={styles.listSection}>
        <div className={styles.menuCard}>
          {/* Privacy Toggle Option */}
          {!isGuest && (
            <button className={styles.menuItem} onClick={togglePrivacy}>
              <div className={styles.menuItemLeft}>
                <div className={`${styles.iconCircle} ${userData?.isPrivate ? styles.bgDarkRed : styles.bgGreen}`}>
                  {userData?.isPrivate ? <Lock size={18} /> : <Unlock size={18} />}
                </div>
                <div>
                  <div style={{ fontWeight: '800' }}>{strings?.profile?.private_profile || 'حساب خاص'}</div>
                  <div style={{ fontSize: '11px', opacity: 0.7 }}>{strings?.profile?.private_profile_desc || 'إخفاء بروفايلك عن الآخرين'}</div>
                </div>
              </div>
              <div className={`${styles.toggleSwitch} ${userData?.isPrivate ? styles.active : ''}`}>
                <div className={styles.toggleKnob}></div>
              </div>
            </button>
          )}

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
