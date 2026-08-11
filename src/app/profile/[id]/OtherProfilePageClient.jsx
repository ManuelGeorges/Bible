'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
  User, Heart, Activity, Trophy, Crown, Medal,
  Lock, ArrowLeft, Star, Flame, Target, Award
} from 'lucide-react';
import styles from '../profile.module.css';
import { useLanguage } from '../../context/LanguageContext';

const OtherProfilePageClient = () => {
  const { id } = useParams();
  const router = useRouter();
  const { strings, dir } = useLanguage();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateLevel = (points) => {
    const level = Math.floor(Math.sqrt(points / 50)) + 1;
    const nextLevelXP = Math.pow(level, 2) * 50;
    const currentLevelXP = Math.pow(level - 1, 2) * 50;
    const progress = ((points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return { level, nextLevelXP, progress };
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!id) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          setError('User not found');
        }
      } catch (e) {
        console.error(e);
        setError('Error fetching user');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [id]);

  if (loading) return <div className={styles.loading}>{strings?.common?.loading}</div>;
  if (error || !userData) return <div className={styles.error}>{error || 'Not Found'}</div>;

  // Check if profile is private
  if (userData.isPrivate) {
    return (
      <div className={styles.container} dir={dir}>
        <div className={styles.topNav}>
          <button onClick={() => router.back()} className={styles.backBtn}>
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className={styles.privateContainer}>
          <div className={styles.lockCircle}>
            <Lock size={50} />
          </div>
          <h2 className={styles.userName}>{userData.displayName}</h2>
          <p className={styles.privateTitle}>{strings?.profile?.private_account_title}</p>
          <p className={styles.privateDesc}>
            {strings?.profile?.private_account_message}
          </p>
        </div>
      </div>
    );
  }

  const levelInfo = calculateLevel(userData.totalPoints || 0);
  const hasGoldTheme = userData.inventory?.includes('theme_gold');

  const stats = {
    verses: userData.favorites?.verses ? Object.keys(userData.favorites.verses).length : 0,
    plans: (userData.completedPlans ? Object.keys(userData.completedPlans).length : 0) + (userData.customPlans ? Object.keys(userData.customPlans).length : 0),
    streak: userData.streak || 0
  };

  return (
    <div className={`${styles.container} ${hasGoldTheme ? styles.goldProfile : ''}`} dir={dir}>
      <div className={styles.topNav}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          <ArrowLeft size={24} />
        </button>
      </div>

      <div className={styles.profileHeader}>
        <div className={styles.mainAvatarWrapper}>
          {hasGoldTheme && <Crown className={styles.crownIcon} size={40} />}
          <div className={`${styles.avatar} ${hasGoldTheme ? styles.goldAvatar : ''}`}>
            {userData.displayName?.[0]}
          </div>
          <div className={styles.levelBadge}>{levelInfo.level}</div>
        </div>

        <h1 className={styles.userName}>
          {userData.displayName}
          <Award className={styles.verifiedIcon} size={20} />
        </h1>

        {userData.inventory?.includes('title_word_lover') && (
            <div className={styles.titleBadge}>
                <Medal size={14} />
                <span>{strings?.shop?.items?.title_word_lover?.name || 'محب الكلمة'}</span>
            </div>
        )}

        <div className={styles.xpProgressContainer}>
          <div className={styles.xpText}>
            <span>{userData.totalPoints || 0} XP</span>
            <span>{levelInfo.nextLevelXP} XP</span>
          </div>
          <div className={styles.xpBarOuter}>
            <div className={styles.xpBarInner} style={{ width: `${levelInfo.progress}%` }}></div>
          </div>
        </div>
      </div>

      <div className={styles.modernStatsGrid}>
        <div className={styles.modernStatCard}>
          <div className={`${styles.statIconWrapper} ${styles.bgOrange}`}>
            <Flame size={20} />
          </div>
          <div className={styles.statData}>
            <span className={styles.statValue}>{stats.streak}</span>
            <span className={styles.statLabel}>{strings?.profile?.streak_days}</span>
          </div>
        </div>

        <div className={styles.modernStatCard}>
          <div className={`${styles.statIconWrapper} ${styles.bgPink}`}>
            <Heart size={20} />
          </div>
          <div className={styles.statData}>
            <span className={styles.statValue}>{stats.verses}</span>
            <span className={styles.statLabel}>{strings?.profile?.fav_verses}</span>
          </div>
        </div>

        <div className={styles.modernStatCard}>
          <div className={`${styles.statIconWrapper} ${styles.bgBlue}`}>
            <Target size={20} />
          </div>
          <div className={styles.statData}>
            <span className={styles.statValue}>{stats.plans}</span>
            <span className={styles.statLabel}>{strings?.profile?.active_plans_count}</span>
          </div>
        </div>
      </div>

      <div className={styles.sectionTitleRow}>
        <h3>{strings?.profile?.badges_section}</h3>
      </div>
      <div className={styles.badgesShowcase}>
        {userData.badges?.length > 0 ? (
          userData.badges.slice(0, 10).map((badge, idx) => (
            <div key={idx} className={styles.badgeMiniItem}>
              <Star size={20} className={styles.badgeIcon} />
            </div>
          ))
        ) : (
          <div className={styles.emptyBadges}>
            {strings?.profile?.no_badges_yet}
          </div>
        )}
      </div>

      <div className={styles.footerInfo} style={{ marginTop: 'auto' }}>
        <p>© 2026 Agios System</p>
      </div>
    </div>
  );
};

export default OtherProfilePageClient;
