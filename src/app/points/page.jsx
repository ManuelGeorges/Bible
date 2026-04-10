'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './points.module.css';
import { db } from '../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  FaBookOpen, FaFeatherAlt, FaHeart, FaCalendarCheck, 
  FaChevronDown, FaEye, FaEyeSlash, FaTrophy, FaChartLine, FaHistory 
} from 'react-icons/fa';
import Badge from '../../components/Badge/Badge';

const convertToArabicNumber = (num) => {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
};

const calculatePointsFromData = (data) => {
  let totalPoints = 0;
  const history = [];
  const POINTS_PER_DAILY_QUESTION = 10;
  const POINTS_PER_FAVOURITE_VERSE = 10;
  const POINTS_PER_COMPLETED_CHAPTER = 20;
  const POINTS_PER_STUDY_PLAN_DAY = 30;

  if (data.answeredQuestions) {
    Object.entries(data.answeredQuestions).forEach(([dateKey, q]) => {
      if (q && (q.correct === true || q.isCorrect === true)) {
        totalPoints += POINTS_PER_DAILY_QUESTION;
        history.push({
          activity: 'dailyQuestion',
          points: POINTS_PER_DAILY_QUESTION,
          description: `إجابة صحيحة على سؤال يوم ${dateKey}`,
          timestamp: q.timestamp || dateKey,
        });
      }
    });
  }

  if (data.favorites?.verses) {
    Object.values(data.favorites.verses).forEach(v => {
      if (v) {
        totalPoints += POINTS_PER_FAVOURITE_VERSE;
        history.push({
          activity: 'favouriteVerse',
          points: POINTS_PER_FAVOURITE_VERSE,
          description: `إضافة آية من "${v.bookName || 'الكتاب المقدس'}" للمفضلة`,
          timestamp: v.dateAdded || Date.now(),
        });
      }
    });
  }

  if (data.completedChapters) {
    Object.entries(data.completedChapters).forEach(([key, value]) => {
      const isDone = typeof value === 'boolean' ? value : value.isCompleted;
      if (isDone) {
        totalPoints += POINTS_PER_COMPLETED_CHAPTER;
        history.push({
          activity: 'completedChapter',
          points: POINTS_PER_COMPLETED_CHAPTER,
          description: `إكمال إصحاح في الكتاب المقدس`,
          timestamp: value.dateCompleted || Date.now(),
        });
      }
    });
  }

  if (data.completedPlans) {
    Object.values(data.completedPlans).forEach(plan => {
      if (plan?.completedDays) {
        Object.entries(plan.completedDays).forEach(([dayNum, dayInfo]) => {
          if (dayInfo?.isCompleted) {
            totalPoints += POINTS_PER_STUDY_PLAN_DAY;
            history.push({
              activity: 'studyPlanDay',
              points: POINTS_PER_STUDY_PLAN_DAY,
              description: `إكمال اليوم ${dayNum} في الخطة الدراسية`,
              timestamp: dayInfo.dateCompleted || Date.now(),
            });
          }
        });
      }
    });
  }

  return { 
    totalPoints, 
    history: history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    unlockedFromFirestore: data.stats?.unlocked_badges || [],
    rawStats: {
      questions: Object.keys(data.answeredQuestions || {}).length,
      chapters: Object.keys(data.completedChapters || {}).length,
      favorites: Object.keys(data.favorites?.verses || {}).length
    }
  };
};

const categorizeActivities = (history, timeframe) => {
  const now = new Date();
  let startDate = new Date();
  if (timeframe === 'day') startDate.setHours(0, 0, 0, 0);
  else if (timeframe === 'week') startDate.setDate(now.getDate() - 7);
  else if (timeframe === 'month') startDate.setMonth(now.getMonth() - 1);
  else startDate.setFullYear(now.getFullYear() - 1);

  const summary = {
    totalPoints: 0,
    dailyQuestions: { count: 0, points: 0 },
    completedChapters: { count: 0, points: 0 },
    favouriteVerses: { count: 0, points: 0 },
    studyPlanDays: { count: 0, points: 0 },
    filteredHistory: []
  };

  history.forEach(item => {
    const itemDate = new Date(item.timestamp);
    if (itemDate >= startDate) {
      summary.totalPoints += item.points;
      summary.filteredHistory.push(item);
      const keyMap = {
        dailyQuestion: 'dailyQuestions',
        completedChapter: 'completedChapters',
        favouriteVerse: 'favouriteVerses',
        studyPlanDay: 'studyPlanDays'
      };
      const category = keyMap[item.activity];
      if (category) {
        summary[category].count++;
        summary[category].points += item.points;
      }
    }
  });

  return summary;
};

export default function Points() {
  const [pointsData, setPointsData] = useState(null);
  const [badgesData, setBadgesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('day');
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
    { id: 'all', name: 'كل الندرة' },
    { id: 'عادي', name: 'عادي' },
    { id: 'مميز', name: 'مميز' },
    { id: 'نادر', name: 'نادر' },
    { id: 'أسطوري', name: 'أسطوري' },
    { id: 'خرافي', name: 'خرافي' }
  ];

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rarityRef.current && !rarityRef.current.contains(event.target)) setIsRarityOpen(false);
      if (familyRef.current && !familyRef.current.contains(event.target)) setIsFamilyOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetch('/data/badges.json')
      .then(res => res.json())
      .then(data => setBadgesData(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setPointsData(calculatePointsFromData(docSnap.data()));
          } else {
            setPointsData({ history: [], totalPoints: 0, unlockedFromFirestore: [], rawStats: { questions: 0, chapters: 0, favorites: 0 } });
          }
          setLoading(false);
        }, () => setLoading(false));
        return () => unsubFirestore();
      } else {
        setPointsData({ history: [], totalPoints: 0, unlockedFromFirestore: [], rawStats: { questions: 0, chapters: 0, favorites: 0 } });
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const activitiesSummary = useMemo(() => {
    return pointsData ? categorizeActivities(pointsData.history, timeframe) : null;
  }, [pointsData, timeframe]);

  const userUnlockedBadges = useMemo(() => {
    if (!pointsData) return [];
    return pointsData.unlockedFromFirestore;
  }, [pointsData]);

  const filteredBadges = useMemo(() => {
    if (!badgesData) return [];
    return badgesData.badge_families.map(family => {
      const badges = family.badges.filter(badge => {
        const isUnlocked = userUnlockedBadges.includes(badge.id);
        const matchesSearch = badge.name.includes(searchTerm);
        const matchesRarity = rarityFilter === 'all' || badge.rarity === rarityFilter;
        const matchesUnlocked = !unlockedOnly || isUnlocked;

        if (badge.rarity === "سري" && !isUnlocked && !searchTerm) return false;
        return matchesSearch && matchesRarity && matchesUnlocked;
      });
      return { ...family, badges };
    }).filter(family => {
      const matchesFamily = familyFilter === 'all' || family.family_name === familyFilter;
      return matchesFamily && family.badges.length > 0;
    });
  }, [badgesData, searchTerm, rarityFilter, familyFilter, userUnlockedBadges, unlockedOnly]);

  if (loading || !badgesData) return <div className={styles.loading}>جاري تحميل البيانات...</div>;

  return (
    <div className={styles.container} dir="rtl">
      <h1 className={styles.header}>النقاط والإنجازات</h1>
      <nav className={styles.topNav}>
        <button onClick={() => scrollToSection(pointsSectionRef)}><FaChartLine /> النقاط</button>
        <button onClick={() => scrollToSection(badgesSectionRef)}><FaTrophy /> الأوسمة</button>
        <button onClick={() => scrollToSection(historySectionRef)}><FaHistory /> السجل</button>
      </nav>
      <section ref={pointsSectionRef} className={styles.sectionWrapper}>
        <div className={styles.pointsSummary}>
          <div className={styles.pointsTotal}>
            <span className={styles.pointsNumber}>{convertToArabicNumber(activitiesSummary?.totalPoints || 0)}</span>
            <span className={styles.pointsLabel}>نقطة مكتسبة</span>
          </div>
          <div className={styles.timeframeButtons}>
            {['day', 'week', 'month', 'year'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} className={`${styles.timeframeButton} ${timeframe === t ? styles.active : ''}`}>
                {t === 'day' ? 'اليوم' : t === 'week' ? 'الأسبوع' : t === 'month' ? 'الشهر' : 'السنة'}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section ref={badgesSectionRef} className={styles.sectionWrapper}>
        <div className={styles.filterSection}>
          <h2 className={styles.detailedHeader}>البحث في الأوسمة</h2>
          <div className={styles.searchControls}>
            <input type="text" placeholder="بحث باسم الوسام..." className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={unlockedOnly} onChange={(e) => setUnlockedOnly(e.target.checked)} />
              <span>الأوسمة التي اقتنيتها فقط</span>
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
                  <li key={r.id} className={`${styles.dropdownItem} ${rarityFilter === r.id ? styles.activeItem : ''}`} onClick={() => { setRarityFilter(r.id); setIsRarityOpen(false); }}>
                    {r.name}
                  </li>
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
                  <li key={f.family_name} className={`${styles.dropdownItem} ${familyFilter === f.family_name ? styles.activeItem : ''}`} onClick={() => { setFamilyFilter(f.family_name); setIsFamilyOpen(false); }}>
                    {f.family_name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className={styles.badgesSection}>
          <div className={styles.badgesGrid}>
            {filteredBadges.length > 0 ? filteredBadges.map((family) => (
              <div key={family.family_name} className={styles.familyRow}>
                <h3 className={styles.familyTitleSmall}>{family.family_name}</h3>
                <div className={styles.badgesListHorizontal}>
                  {family.badges.map((badge) => (
                    <Badge key={badge.id} badge={badge} familyName={family.family_name} isUnlocked={userUnlockedBadges.includes(badge.id)} />
                  ))}
                </div>
              </div>
            )) : (
              <p className={styles.noDataSection}>لا توجد أوسمة تطابق بحثك.</p>
            )}
          </div>
        </div>
      </section>
      <section ref={historySectionRef} className={styles.sectionWrapper}>
        {activitiesSummary && (
          <div className={styles.activitiesContainer}>
            <div className={styles.historyHeaderToggle}>
              <h2 className={styles.detailedHeader}>سجل الأنشطة والملخص</h2>
              <button className={styles.toggleVisibilityBtn} onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? <><FaEyeSlash /> إخفاء السجل</> : <><FaEye /> إظهار السجل</>}
              </button>
            </div>
            {showHistory && (
              <>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <FaFeatherAlt className={styles.icon} />
                    <h3 className={styles.cardTitle}>أسئلة يومية</h3>
                    <p className={styles.cardCount}>{convertToArabicNumber(activitiesSummary.dailyQuestions.count)}<br /><span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.dailyQuestions.points)} نقطة)</span></p>
                  </div>
                  <div className={styles.summaryCard}>
                    <FaBookOpen className={styles.icon} />
                    <h3 className={styles.cardTitle}>إصحاحات مكتملة</h3>
                    <p className={styles.cardCount}>{convertToArabicNumber(activitiesSummary.completedChapters.count)}<br /><span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.completedChapters.points)} نقطة)</span></p>
                  </div>
                  <div className={styles.summaryCard}>
                    <FaHeart className={styles.icon} />
                    <h3 className={styles.cardTitle}>آيات مفضلة</h3>
                    <p className={styles.cardCount}>{convertToArabicNumber(activitiesSummary.favouriteVerses.count)}<br /><span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.favouriteVerses.points)} نقطة)</span></p>
                  </div>
                  <div className={styles.summaryCard}>
                    <FaCalendarCheck className={styles.icon} />
                    <h3 className={styles.cardTitle}>أيام خطط دراسية</h3>
                    <p className={styles.cardCount}>{convertToArabicNumber(activitiesSummary.studyPlanDays.count)}<br /><span className={styles.pointsSubText}>(+{convertToArabicNumber(activitiesSummary.studyPlanDays.points)} نقطة)</span></p>
                  </div>
                </div>
                <div className={styles.detailedHistory}>
                  {activitiesSummary.filteredHistory.length > 0 ? (
                    <ul className={styles.activityList}>
                      {activitiesSummary.filteredHistory.map((item, i) => (
                        <li key={i} className={styles.activityItem}>
                          <div className={styles.activityInfo}>
                            <p className={styles.activityDescription}>{item.description}</p>
                            <span className={styles.activityDate}>{new Date(item.timestamp).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                          <span className={styles.activityPoints}>+ {convertToArabicNumber(item.points)} نقطة</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.noDataSection}>لا توجد أنشطة مسجلة في هذه الفترة.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}