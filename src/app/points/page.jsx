'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './points.module.css';
import { db } from '../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayUnion, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { 
  FaBookOpen, FaFeatherAlt, FaHeart, FaChevronDown, FaEye, FaEyeSlash,
  FaTrophy, FaChartLine, FaHistory, FaMapMarkedAlt, FaSearch,
  FaShareAlt, FaFire, FaSignInAlt, FaCheckCircle, FaStar
} from 'react-icons/fa';
import Badge from '../../components/Badge/Badge';
import { toast, Toaster } from 'react-hot-toast';

const convertToArabicNumber = (num) => {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
};

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

// وظيفة لإضافة النقاط إلى Firebase
const awardPoints = async (userId, type, points, reason) => {
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      totalPoints: increment(points),
      pointsHistory: arrayUnion({
        type,
        points,
        reason,
        timestamp: new Date()
      }),
      lastActiveDate: new Date().toISOString().split('T')[0]
    });
    return true;
  } catch (error) {
    console.error("Error awarding points:", error);
    return false;
  }
};

const calculatePointsFromData = (data) => {
  let totalPoints = data.totalPoints || 0;
  const history = [];
  const today = new Date().toISOString().split('T')[0];

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

  // معالجة التاريخ والسجل
  if (data.pointsHistory) {
    const historyArray = Array.isArray(data.pointsHistory) ? data.pointsHistory : Object.values(data.pointsHistory);
    historyArray.forEach(item => {
      const ts = item.timestamp?.seconds ? item.timestamp.toDate() : new Date(item.timestamp);
      history.push({
        activity: item.type || 'unknown',
        points: item.points || POINTS_MAP[item.type] || 0,
        description: item.reason || 'نشاط غير محدد',
        timestamp: ts,
        dateStr: ts.toISOString().split('T')[0]
      });
    });
  }

  // دمج الأسئلة المجابة (لو مش موجودة في الـ history)
  if (data.answeredQuestions) {
    Object.entries(data.answeredQuestions).forEach(([dateKey, q]) => {
      if (q && (q.answered)) {
        const qTime = q.timestamp || dateKey;
        const exists = history.some(h => {
           const hTime = h.timestamp?.toISOString ? h.timestamp.toISOString() : h.timestamp;
           return hTime === qTime;
        });

        if (!exists) {
          history.push({
            activity: 'dailyQuestion',
            points: q.correct ? 20 : 0,
            description: q.correct ? `إجابة صحيحة على سؤال يوم ${dateKey}` : `محاولة الإجابة على سؤال يوم ${dateKey}`,
            timestamp: new Date(qTime),
            dateStr: new Date(qTime).toISOString().split('T')[0]
          });
        }
      }
    });
  }

  // المهام اليومية المحسنة
  const dailyGoals = [
    {
      id: 'dailyLogin',
      label: 'تسجيل الدخول اليومي',
      points: 10,
      icon: <FaSignInAlt />,
      completed: data.lastActiveDate === today || history.some(h => h.activity === 'dailyLogin' && h.dateStr === today)
    },
    {
      id: 'dailyQuestion',
      label: 'حل سؤال التحدي',
      points: 20,
      icon: <FaFeatherAlt />,
      completed: !!data.answeredQuestions?.[today]?.answered
    },
    {
      id: 'mapExploration',
      label: 'استكشاف معلم في الخريطة',
      points: 40,
      icon: <FaMapMarkedAlt />,
      completed: history.some(h => h.activity === 'mapExploration' && h.dateStr === today)
    },
    {
      id: 'share',
      label: 'مشاركة آية أو محتوى',
      points: 15,
      icon: <FaShareAlt />,
      completed: history.some(h => h.activity === 'share' && h.dateStr === today)
    },
    {
      id: 'completedChapter',
      label: 'قراءة أصحاح كامل',
      points: 20,
      icon: <FaBookOpen />,
      completed: history.some(h => h.activity === 'completedChapter' && h.dateStr === today)
    },
    {
      id: 'favouriteVerse',
      label: 'تظليل آية أعجبتك',
      points: 5,
      icon: <FaHeart />,
      completed: history.some(h => h.activity === 'favouriteVerse' && h.dateStr === today)
    }
  ];

  return { 
    totalPoints, 
    levelInfo: calculateLevel(totalPoints),
    dailyGoals,
    history: history.sort((a, b) => b.timestamp - a.timestamp),
    unlockedFromFirestore: data.badges || [],
    streak: data.streak || 0,
    rawStats: {
      questions: Object.keys(data.answeredQuestions || {}).length,
      maps: (data.visitedMapPoints || []).length,
      favorites: Object.keys(data.favorites?.verses || {}).length
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
    const dateKey = d.toISOString().split('T')[0];
    return { date: dateKey, points: 0, label: d.toLocaleDateString('ar-EG', { weekday: 'short' }) };
  });

  history.forEach(item => {
    const dateKey = item.timestamp.toISOString().split('T')[0];
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
  const [pointsData, setPointsData] = useState(null);
  const [badgesData, setBadgesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const pointsSectionRef = useRef(null);
  const badgesSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const rarityRef = useRef(null);
  const familyRef = useRef(null);

  const [isRarityOpen, setIsRarityOpen] = useState(false);
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);

  const rarities = [
    { id: 'all', name: 'كل الندرة' }, { id: 'عادي', name: 'عادي' }, { id: 'مميز', name: 'مميز' },
    { id: 'نادر', name: 'نادر' }, { id: 'أسطوري', name: 'أسطوري' }, { id: 'خرافي', name: 'خرافي' }
  ];

  const scrollToSection = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rarityRef.current && !rarityRef.current.contains(event.target)) setIsRarityOpen(false);
      if (familyRef.current && !familyRef.current.contains(event.target)) setIsFamilyOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetch('/data/badges.json').then(res => res.json()).then(data => setBadgesData(data));
  }, []);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const newData = calculatePointsFromData(data);

            // لوجيك تسجيل الدخول اليومي التلقائي
            const today = new Date().toISOString().split('T')[0];
            if (data.lastActiveDate !== today) {
              awardPoints(currentUser.uid, 'dailyLogin', 10, 'تسجيل دخول يومي');
              toast.success('حصلت على ١٠ نقاط لتفاعلك اليوم! 🔥', { icon: '✨' });
            }

            if (pointsData && newData.unlockedFromFirestore.length > pointsData.unlockedFromFirestore.length) {
              toast.success('تهانينا! لقد فتحت وساماً جديداً 🏅', { duration: 5000, icon: '🎉' });
            }
            setPointsData(newData);
          }
          setLoading(false);
        });
        return () => unsubFirestore();
      } else {
        setLoading(false);
      }
    });
  }, [pointsData === null]);

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
    <div className={styles.container} dir="rtl">
      <Toaster position="top-center" />
      <h1 className={styles.header}>النقاط والإنجازات</h1>

      <nav className={styles.topNav}>
        <button onClick={() => scrollToSection(pointsSectionRef)}><FaChartLine /> النقاط</button>
        <button onClick={() => scrollToSection(badgesSectionRef)}><FaTrophy /> الأوسمة</button>
        <button onClick={() => scrollToSection(historySectionRef)}><FaHistory /> السجل</button>
      </nav>

      <section ref={pointsSectionRef} className={styles.sectionWrapper}>
        <div className={styles.pointsSummary}>
          <div className={styles.levelContainer}>
            <div className={styles.levelBadge}>
                <FaStar className={styles.levelStar} />
                <span>المستوى {convertToArabicNumber(pointsData?.levelInfo.level || 1)}</span>
            </div>
            <div className={styles.levelBarOuter}>
                <div className={styles.levelBarInner} style={{ width: `${pointsData?.levelInfo.progress}%` }} />
            </div>
            <p className={styles.nextLevelText}>تبقّى {convertToArabicNumber(pointsData?.levelInfo.nextXP || 0)} نقطة للمستوى التالي</p>
          </div>

          <div className={styles.pointsTotal}>
            <span className={styles.pointsNumber}>{convertToArabicNumber(pointsData?.totalPoints || 0)}</span>
            <span className={styles.pointsLabel}>نقطة إجمالية</span>
          </div>

          <div className={styles.streakBadge}>
            <FaFire className={styles.fireIcon} />
            <span>سلسلة تفاعل: {convertToArabicNumber(pointsData?.streak || 0)} يوم</span>
          </div>

          <div className={styles.dailyGoalsSection}>
            <h3 className={styles.subTitle}>أهداف اليوم</h3>
            <div className={styles.goalsGrid}>
                {pointsData?.dailyGoals.map(goal => (
                    <div key={goal.id} className={`${styles.goalCard} ${goal.completed ? styles.goalCompleted : ''}`}>
                        <div className={styles.goalIcon}>{goal.completed ? <FaCheckCircle color="#10b981" /> : goal.icon}</div>
                        <div className={styles.goalInfo}>
                            <span>{goal.label}</span>
                            <small>+{convertToArabicNumber(goal.points)} نقطة</small>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          <div className={styles.activityChartSection}>
            <h3 className={styles.subTitle}>نشاطك الأخير</h3>
            <div className={styles.chartWrapper}>
                {activitiesSummary?.chartData.map((d, i) => (
                    <div key={i} className={styles.chartBarContainer}>
                        <div className={styles.chartBar} style={{ height: `${Math.min(100, (d.points / 100) * 100)}%` }}>
                            {d.points > 0 && <span className={styles.barValue}>{convertToArabicNumber(d.points)}</span>}
                        </div>
                        <span className={styles.barLabel}>{d.label}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section ref={badgesSectionRef} className={styles.sectionWrapper}>
        <div className={styles.filterSection}>
          <h2 className={styles.detailedHeader}>الأوسمة والبطولات</h2>
          <div className={styles.searchControls}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input type="text" placeholder="بحث باسم الوسام..." className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={unlockedOnly} onChange={(e) => setUnlockedOnly(e.target.checked)} />
              <span>المقتنيات فقط</span>
            </label>
          </div>
          <div className={styles.selectGroup}>
            <div className={styles.customSelectWrapper} ref={rarityRef}>
              <div className={styles.selectTrigger} onClick={() => { setIsRarityOpen(!isRarityOpen); setIsFamilyOpen(false); }}>
                {rarities.find(r => r.id === rarityFilter)?.name}
                <FaChevronDown className={`${styles.arrowIcon} ${isRarityOpen ? styles.rotate : ''}`} />
              </div>
              <ul className={`${styles.dropdownMenu} ${isRarityOpen ? styles.open : ''}`}>
                {rarities.map((r) => (
                  <li key={r.id} className={`${styles.dropdownItem} ${rarityFilter === r.id ? styles.activeItem : ''}`} onClick={() => { setRarityFilter(r.id); setIsRarityOpen(false); }}>{r.name}</li>
                ))}
              </ul>
            </div>
            <div className={styles.customSelectWrapper} ref={familyRef}>
              <div className={styles.selectTrigger} onClick={() => { setIsFamilyOpen(!isFamilyOpen); setIsRarityOpen(false); }}>
                {familyFilter === 'all' ? 'كل الأنواع' : familyFilter}
                <FaChevronDown className={`${styles.arrowIcon} ${isFamilyOpen ? styles.rotate : ''}`} />
              </div>
              <ul className={`${styles.dropdownMenu} ${isFamilyOpen ? styles.open : ''}`}>
                <li className={`${styles.dropdownItem} ${familyFilter === 'all' ? styles.activeItem : ''}`} onClick={() => { setFamilyFilter('all'); setIsFamilyOpen(false); }}>كل الأنواع</li>
                {badgesData.badge_families.map(f => (
                  <li key={f.family_name} className={`${styles.dropdownItem} ${familyFilter === f.family_name ? styles.activeItem : ''}`} onClick={() => { setFamilyFilter(f.family_name); setIsFamilyOpen(false); }}>{f.family_name}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
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
                            <div className={styles.progressText}>{convertToArabicNumber(badge.progress.current)}/{convertToArabicNumber(badge.progress.target)}</div>
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

      <section ref={historySectionRef} className={styles.sectionWrapper}>
        {activitiesSummary && (
          <div className={styles.activitiesContainer}>
            <div className={styles.historyHeaderToggle}>
              <h2 className={styles.detailedHeader}>سجل النشاط </h2>
              <button className={styles.toggleVisibilityBtn} onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? <><FaEyeSlash /> إخفاء</> : <><FaEye /> إظهار</>}
              </button>
            </div>
            {showHistory && (
              <>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}><FaSignInAlt className={styles.icon} /><h3>تفاعل</h3><p>+{convertToArabicNumber(activitiesSummary.dailyActions.points)}</p></div>
                  <div className={styles.summaryCard}><FaBookOpen className={styles.icon} /><h3>دراسة</h3><p>+{convertToArabicNumber(activitiesSummary.reading.points)}</p></div>
                  <div className={styles.summaryCard}><FaMapMarkedAlt className={styles.icon} /><h3>خرائط</h3><p>+{convertToArabicNumber(activitiesSummary.maps.points)}</p></div>
                  <div className={styles.summaryCard}><FaTrophy className={styles.icon} /><h3>بونص</h3><p>+{convertToArabicNumber(activitiesSummary.bonuses.points)}</p></div>
                </div>
                <ul className={styles.activityList}>
                  {activitiesSummary.filteredHistory.length > 0 ? activitiesSummary.filteredHistory.map((item, i) => (
                    <li key={i} className={`${styles.activityItem} ${item.points > 0 ? styles.positiveActivity : styles.neutralActivity}`}>
                      <div className={styles.activityIconWrapper}>
                        {item.activity === 'share' && <FaShareAlt />}
                        {item.activity === 'search' && <FaSearch />}
                        {item.activity === 'mapExploration' && <FaMapMarkedAlt />}
                        {item.activity === 'dailyLogin' && <FaSignInAlt />}
                        {item.activity === 'dailyQuestion' && <FaFeatherAlt />}
                        {item.activity === 'completedChapter' && <FaCheckCircle />}
                        {item.activity === 'favouriteVerse' && <FaHeart />}
                      </div>
                      <div className={styles.activityInfo}>
                        <p>{item.description}</p>
                        <span>{item.timestamp.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={styles.activityPoints}>{item.points > 0 ? '+' : ''}{convertToArabicNumber(item.points)}</span>
                    </li>
                  )) : <p className={styles.noDataSection}>لا توجد بيانات سجل.</p>}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
