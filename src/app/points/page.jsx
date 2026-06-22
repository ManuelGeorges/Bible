'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './points.module.css';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayUnion, increment, getDoc } from 'firebase/firestore';
import { 
  FaBookOpen, FaFeatherAlt, FaHeart, FaChevronDown, FaEye, FaEyeSlash,
  FaTrophy, FaChartLine, FaHistory, FaMapMarkedAlt, FaSearch,
  FaShareAlt, FaFire, FaSignInAlt, FaCheckCircle, FaStar
} from 'react-icons/fa';
import Badge from '../../components/Badge/Badge';
import { toast } from 'react-hot-toast';
import { getCairoDate, getCairoIsoString, getCairoDateInfo } from '../../lib/dateUtils';
import { StorageService, KEYS } from '../../lib/storage';
import { useLanguage } from '../context/LanguageContext';

// Import badge translations statically
import badgesAr from '../../data/translations/arabic/badges_ar.json';
import badgesEn from '../../data/translations/English/badges_en.json';
import badgesFr from '../../data/translations/French/badges_fr.json';
import badgesDe from '../../data/translations/german/badges_de.json';

const calculateLevel = (points) => {
  const level = Math.floor(Math.sqrt(points / 50)) + 1;
  const currentLevelXP = Math.pow(level - 1, 2) * 50;
  const nextLevelXP = Math.pow(level, 2) * 50;
  const progress = ((points - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

  return {
    level,
    progress: Math.min(100, Math.max(0, progress)),
    nextXP: nextLevelXP - points
  };
};

const awardPoints = async (userId, type, points, reason) => {
  if (userId) {
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        totalPoints: increment(points),
        pointsHistory: arrayUnion({
          type,
          points,
          reason,
          timestamp: getCairoIsoString()
        }),
        lastActiveDate: getCairoDate()
      });
      return true;
    } catch (error) {
      console.error("Error awarding points:", error);
      return false;
    }
  } else {
    await StorageService.addPoints(points);
    const history = await StorageService.get('points_history') || [];
    history.push({ type, points, reason, timestamp: getCairoIsoString() });
    await StorageService.save('points_history', history);
    return true;
  }
};

const calculatePointsFromData = (data, isLocal = false, stringsParam = null) => {
  let totalPoints = data.totalPoints || data.points || 0;
  const history = [];
  const today = getCairoDate();

  const POINTS_MAP = {
    dailyLogin: 10,
    dailyQuestion: 20,
    completedChapter: 20,
    search: 5,
    share: 15,
    favouriteVerse: 5,
    mapExploration: 40,
    studyPlanDay: 30
  };

  const historyData = data.pointsHistory || data.history || [];
  const historyArray = Array.isArray(historyData) ? historyData : Object.values(historyData);

  historyArray.forEach(item => {
    const ts = item.timestamp?.seconds ? item.timestamp.toDate() : new Date(item.timestamp);
    history.push({
      activity: item.type || 'unknown',
      points: item.points || POINTS_MAP[item.type] || 0,
      description: item.reason || 'نشاط غير محدد',
      timestamp: ts,
      dateStr: getCairoDate(ts)
    });
  });

  const answeredQuestions = data.answeredQuestions || {};
  Object.entries(answeredQuestions).forEach(([dateKey, q]) => {
    if (q && q.answered) {
      const qTime = q.timestamp || dateKey;
      const qDateObj = new Date(qTime);
      const qDateStr = getCairoDate(qDateObj);
      const exists = history.some(h => h.activity === 'dailyQuestion' && h.dateStr === qDateStr);
      if (!exists) {
        history.push({
          activity: 'dailyQuestion',
          points: q.correct ? 20 : 0,
          description: q.correct ? `إجابة صحيحة على سؤال يوم ${dateKey}` : `محاولة الإجابة على سؤال يوم ${dateKey}`,
          timestamp: qDateObj,
          dateStr: qDateStr
        });
      }
    }
  });

  const lastActiveDate = data.lastActiveDate || data.lastActive || "";

  const S = stringsParam || {};
  const dailyGoals = [
    { id: 'dailyLogin', label: S.points?.goals?.dailyLogin || 'Daily login', points: 10, icon: <FaSignInAlt />, completed: lastActiveDate === today || history.some(h => h.activity === 'dailyLogin' && h.dateStr === today) },
    { id: 'dailyQuestion', label: S.points?.goals?.dailyQuestion || 'Daily question', points: 20, icon: <FaFeatherAlt />, completed: !!answeredQuestions[today]?.answered },
    { id: 'mapExploration', label: S.points?.goals?.mapExploration || 'Explore map', points: 40, icon: <FaMapMarkedAlt />, completed: history.some(h => h.activity === 'mapExploration' && h.dateStr === today) },
    { id: 'share', label: S.points?.goals?.share || 'Share', points: 15, icon: <FaShareAlt />, completed: history.some(h => h.activity === 'share' && h.dateStr === today) },
    { id: 'completedChapter', label: S.points?.goals?.completedChapter || 'Complete chapter', points: 20, icon: <FaBookOpen />, completed: history.some(h => h.activity === 'completedChapter' && h.dateStr === today) },
    { id: 'favouriteVerse', label: S.points?.goals?.favouriteVerse || 'Favourite verse', points: 5, icon: <FaHeart />, completed: history.some(h => h.activity === 'favouriteVerse' && h.dateStr === today) }
  ];

  return { 
    totalPoints, 
    levelInfo: calculateLevel(totalPoints),
    dailyGoals,
    history: history.sort((a, b) => b.timestamp - a.timestamp),
    unlockedFromFirestore: data.badges || [],
    streak: data.streak || 0,
    rawStats: {
      questions: Object.keys(answeredQuestions).length,
      maps: (data.visitedMapPoints || []).length,
      favorites: Object.keys(data.favorites?.verses || data.favorites || {}).length,
      chapters: Object.keys(data.completedChapters || {}).filter(k => data.completedChapters[k]).length,
      quizzes: (data.completedQuizzes || []).length,
      perfectQuizzes: (data.completedQuizzes || []).filter(q => q.score === q.total).length,
      shares: history.filter(h => h.activity === 'share').length
    }
  };
};

const categorizeActivities = (history) => {
  const summary = {
    totalPoints: 0,
    dailyActions: { count: 0, points: 0 },
    reading: { count: 0, points: 0 },
    maps: { count: 0, points: 0 },
    bonuses: { count: 0, points: 0 },
    filteredHistory: history,
    chartData: []
  };

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateKey = getCairoDate(d);
    const label = d.toLocaleDateString('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' });
    return { date: dateKey, points: 0, label };
  });

  history.forEach(item => {
    const dateKey = getCairoDate(item.timestamp);
    const chartDay = last7Days.find(d => d.date === dateKey);
    if (chartDay) chartDay.points += Math.max(0, item.points);

    summary.totalPoints += item.points;
    if (['dailyLogin', 'search', 'share', 'favouriteVerse', 'dailyQuestion'].includes(item.activity)) {
      summary.dailyActions.count++;
      summary.dailyActions.points += item.points;
    } else if (['completedChapter', 'studyPlanDay'].includes(item.activity)) {
      summary.reading.count++;
      summary.reading.points += item.points;
    } else if (item.activity === 'mapExploration') {
      summary.maps.count++;
      summary.maps.points += item.points;
    } else if (item.activity === 'streakBonus') {
      summary.bonuses.count++;
      summary.bonuses.points += item.points;
    }
  });

  summary.chartData = last7Days;
  return summary;
};

export default function Points() {
  const { strings, dir, language, formatNumber } = useLanguage();
  const router = useRouter();
  const [pointsData, setPointsData] = useState(null);
  const [badgesData, setBadgesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('points');
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const [user, setUser] = useState(null);

  const [isRarityOpen, setIsRarityOpen] = useState(false);
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const rarityRef = useRef(null);
  const familyRef = useRef(null);

  const rarities = [
    { id: 'all', name: strings.points.rarity.all },
    { id: 'عادي', name: strings.points.rarity.common },
    { id: 'مميز', name: strings.points.rarity.uncommon },
    { id: 'نادر', name: strings.points.rarity.rare },
    { id: 'أسطوري', name: strings.points.rarity.epic },
    { id: 'خرافي', name: strings.points.rarity.mythic }
  ];

  const handleGoalClick = (goalId) => {
    switch (goalId) {
        case 'dailyQuestion': router.push('/#daily-question'); break;
        case 'mapExploration': router.push('/maps'); break;
        case 'share': router.push('/#daily-verse'); break;
        case 'completedChapter': router.push('/bible'); break;
        case 'favouriteVerse': router.push('/bible'); break;
        default: break;
    }
  };

  useEffect(() => {
    const badgeFiles = {
      ar: badgesAr,
      en: badgesEn,
      fr: badgesFr,
      de: badgesDe
    };
    setBadgesData(badgeFiles[language] || badgeFiles.ar);
  }, [language]);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubFirestore = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
            const data = docSnap.data();
            const newData = calculatePointsFromData(data, false, strings);
            const today = getCairoDate();
            if (data.lastActiveDate !== today) {
              awardPoints(currentUser.uid, 'dailyLogin', 10, strings.points.points_reasons.daily_login);
              toast.success(strings.points.daily_bonus_toast, { icon: '✨' });
            }
            setPointsData(newData);
          }
          setLoading(false);
        });
        return () => unsubFirestore();
      } else {
        const localStats = await StorageService.getLocalStats();
        const localHistory = await StorageService.get('points_history') || [];
        const localAnswered = await StorageService.get('answered_questions') || {};
        const localCompleted = await StorageService.get(KEYS.COMPLETED_CHAPTERS) || {};

        const localDataMapped = {
          ...localStats,
          history: localHistory,
          answeredQuestions: localAnswered,
          completedChapters: localCompleted,
          lastActiveDate: await StorageService.get(KEYS.LAST_ACTIVE) || ""
        };

        const newData = calculatePointsFromData(localDataMapped, true, strings);
        setPointsData(newData);
        setLoading(false);
      }
    });
  }, [strings]);

  const activitiesSummary = useMemo(() => pointsData ? categorizeActivities(pointsData.history) : null, [pointsData]);
  const userUnlockedBadges = useMemo(() => pointsData?.unlockedFromFirestore || [], [pointsData]);

  const filteredBadges = useMemo(() => {
    if (!badgesData) return [];
    return badgesData.badge_families.map(family => {
      const badges = family.badges.map(badge => {
        let progress = null;
        if (!userUnlockedBadges.includes(badge.id)) {
            if (badge.id.startsWith('streak_')) {
                const target = parseInt(badge.id.split('_')[1]);
                progress = { current: pointsData?.streak || 0, target };
            } else if (badge.id.startsWith('map_') || badge.id === 'ancient_navigator') {
                const target = badge.id === 'map_pioneer' ? 5 : 20;
                progress = { current: pointsData?.rawStats.maps || 0, target };
            } else if (badge.id.startsWith('reader_')) {
                const target = parseInt(badge.id.split('_')[1]);
                progress = { current: pointsData?.rawStats.chapters || 0, target };
            } else if (badge.id === 'bible_finisher') {
                progress = { current: pointsData?.rawStats.chapters || 0, target: 1189 };
            } else if (badge.id === 'reader_594') {
                progress = { current: pointsData?.rawStats.chapters || 0, target: 594 };
            } else if (badge.id.startsWith('scholar_')) {
                const target = parseInt(badge.id.split('_')[1]);
                progress = { current: pointsData?.rawStats.quizzes || 0, target };
            } else if (badge.id === 'bible_master') {
                progress = { current: pointsData?.rawStats.quizzes || 0, target: 73 };
            } else if (badge.id.startsWith('perfect_')) {
                const target = badge.id === 'perfect_all' ? 73 : parseInt(badge.id.split('_')[1]);
                progress = { current: pointsData?.rawStats.perfectQuizzes || 0, target };
            } else if (badge.id.startsWith('fav_')) {
                const target = parseInt(badge.id.split('_')[1]);
                progress = { current: pointsData?.rawStats.favorites || 0, target };
            } else if (badge.id === 'share_1') {
                progress = { current: pointsData?.rawStats.shares || 0, target: 1 };
            } else if (badge.id === 'social_influencer') {
                progress = { current: pointsData?.rawStats.shares || 0, target: 50 };
            }
        }
        return { ...badge, progress };
      }).filter(badge => {
        const isUnlocked = userUnlockedBadges.includes(badge.id);
        const matchesSearch = badge.name.includes(searchTerm);
        const matchesRarity = rarityFilter === 'all' || badge.rarity === rarityFilter;
        const matchesUnlocked = !unlockedOnly || isUnlocked;
        if (badge.rarity === "سري" && !isUnlocked && !searchTerm) return false;
        return matchesSearch && matchesRarity && matchesUnlocked;
      });
      return { ...family, badges };
    }).filter(family => (familyFilter === 'all' || family.family_name === familyFilter) && family.badges.length > 0);
  }, [badgesData, searchTerm, rarityFilter, familyFilter, userUnlockedBadges, unlockedOnly, pointsData]);

  if (loading || !badgesData) return (
    <div className={styles.container}>
        <div className={styles.skeletonContainer}>
            <div className={styles.skeletonHeader} /><div className={styles.skeletonCard} />
            <div className={styles.skeletonGrid}>{[1,2,3,4].map(i => <div key={i} className={styles.skeletonItem} />)}</div>
        </div>
    </div>
  );

  return (
    <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
      <h1 className={styles.header}>{strings.points.title}</h1>

      <nav className={styles.topNav}>
        <button className={`${styles.navBtn} ${activeTab === 'points' ? styles.active : ''}`} onClick={() => setActiveTab('points')}>
          <FaChartLine /> <span>{strings.points.tab_points}</span>
        </button>
        <button className={`${styles.navBtn} ${activeTab === 'badges' ? styles.active : ''}`} onClick={() => setActiveTab('badges')}>
          <FaTrophy /> <span>{strings.points.tab_badges}</span>
        </button>
        <button className={`${styles.navBtn} ${activeTab === 'history' ? styles.active : ''}`} onClick={() => setActiveTab('history')}>
          <FaHistory /> <span>{strings.points.tab_history}</span>
        </button>
      </nav>

      {activeTab === 'points' && (
        <section className={styles.sectionWrapper}>
          <div className={styles.pointsSummary}>
            <div className={styles.levelContainer}>
              <div className={styles.levelBadge}>
                  <FaStar className={styles.levelStar} />
                  <span>{strings.points.level.replace('{level}', formatNumber(pointsData?.levelInfo.level || 1))}</span>
              </div>
              <div className={styles.levelBarOuter}>
                  <div className={styles.levelBarInner} style={{ width: `${pointsData?.levelInfo.progress}%` }} />
              </div>
              <p className={styles.nextLevelText}>{strings.points.next_level.replace('{points}', formatNumber(pointsData?.levelInfo.nextXP || 0))}</p>
            </div>
            <div className={styles.pointsTotal}>
              <span className={styles.pointsNumber}>{formatNumber(pointsData?.totalPoints || 0)}</span>
              <span className={styles.pointsLabel}>{strings.points.total_points_label}</span>
            </div>
            <div className={styles.streakBadge}>
              <FaFire className={styles.fireIcon} />
              <span>{strings.points.streak_label.replace('{streak}', formatNumber(pointsData?.streak || 0))}</span>
            </div>
            <div className={styles.dailyGoalsSection}>
              <h3 className={styles.subTitle}>{strings.points.daily_goals_title}</h3>
              <div className={styles.goalsGrid}>
                  {pointsData?.dailyGoals.map(goal => (
                      <div key={goal.id} className={`${styles.goalCard} ${goal.completed ? styles.goalCompleted : ''}`} onClick={() => handleGoalClick(goal.id)}>
                          <div className={goal.icon}>{goal.completed ? <FaCheckCircle color="#10b981" /> : goal.icon}</div>
                          <div className={styles.goalInfo}>
                              <span>{goal.label}</span>
                              <small>+{formatNumber(goal.points)} {strings.points.points_unit || 'Points'}</small>
                          </div>
                      </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'badges' && (
        <section className={styles.sectionWrapper}>
          <div className={styles.badgesGrid}>
            {filteredBadges.map((family) => (
              <div key={family.family_name} className={styles.familyRow}>
                <h3 className={styles.familyTitleSmall}>{family.family_name}</h3>
                <div className={styles.badgesListHorizontal}>
                  {family.badges.map((badge) => (
                    <div key={badge.id} className={styles.badgeWrapper}>
                      <Badge badge={badge} familyName={family.family_name} isUnlocked={userUnlockedBadges.includes(badge.id)} />
                      {badge.progress && (
                          <div className={styles.badgeProgressMini}>
                              <div className={styles.progressText}>{formatNumber(badge.progress.current)}/{formatNumber(badge.progress.target)}</div>
                              <div className={styles.progressLine}><div className={styles.progressFill} style={{ width: `${(badge.progress.current/badge.progress.target)*100}%` }} /></div>
                          </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className={styles.sectionWrapper}>
          <ul className={styles.activityList}>
            {pointsData?.history.length > 0 ? pointsData.history.map((item, i) => (
              <li key={i} className={styles.activityItem}>
                <div className={styles.activityInfo}>
                  <p>{item.description}</p>
                  <span>{new Date(item.timestamp).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                </div>
                <span className={styles.activityPoints}>+{formatNumber(item.points)}</span>
              </li>
            )) : <p>{strings.points.no_history}</p>}
          </ul>
        </section>
      )}
    </div>
  );
}
