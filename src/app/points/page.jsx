'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './points.module.css';
import { db } from '../../lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  FaBookOpen, FaFeatherAlt, FaHeart, FaCalendarCheck, 
  FaChevronDown, FaEye, FaEyeSlash, FaTrophy, FaChartLine, 
  FaHistory, FaMapMarkedAlt, FaSearch, FaShareAlt, FaFire, FaSignInAlt
} from 'react-icons/fa';
import Badge from '../../components/Badge/Badge';

const convertToArabicNumber = (num) => {
  const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicNums[+d] || d).join('');
};

const calculatePointsFromData = (data) => {
  let totalPoints = data.totalPoints || 0;
  const history = [];

  const POINTS_MAP = {
    dailyLogin: 10,
    dailyQuestion: 20,
    completedChapter: 20,
    search: 5,
    share: 15,
    favouriteVerse: 5,
    mapExploration: 40,
    studyPlanDay: 30,
    streakBonus: 0 
  };

  if (data.pointsHistory) {
    Object.values(data.pointsHistory).forEach(item => {
      history.push({
        activity: item.type,
        points: item.points || POINTS_MAP[item.type] || 0,
        description: item.reason,
        timestamp: item.timestamp
      });
    });
  }

  if (data.answeredQuestions) {
    Object.entries(data.answeredQuestions).forEach(([dateKey, q]) => {
      if (q && (q.correct || q.isCorrect)) {
        const exists = history.some(h => h.timestamp === (q.timestamp || dateKey));
        if (!exists) {
          history.push({
            activity: 'dailyQuestion',
            points: POINTS_MAP.dailyQuestion,
            description: `إجابة صحيحة على سؤال يوم ${dateKey}`,
            timestamp: q.timestamp || dateKey,
          });
        }
      }
    });
  }

  return { 
    totalPoints, 
    history: history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    unlockedFromFirestore: data.stats.unlocked_badges || [],
    streak: data.streak || 0,
    rawStats: {
      questions: Object.keys(data.answeredQuestions || {}).length,
      maps: (data.visitedMapPoints || []).length,
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
    dailyActions: { count: 0, points: 0 },
    reading: { count: 0, points: 0 },
    maps: { count: 0, points: 0 },
    bonuses: { count: 0, points: 0 },
    filteredHistory: []
  };

  history.forEach(item => {
    const itemDate = new Date(item.timestamp);
    if (itemDate >= startDate) {
      summary.totalPoints += item.points;
      summary.filteredHistory.push(item);

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
            setPointsData({ history: [], totalPoints: 0, unlockedFromFirestore: [], streak: 0, rawStats: { questions: 0, maps: 0, favorites: 0 } });
          }
          setLoading(false);
        }, () => setLoading(false));
        return () => unsubFirestore();
      } else {
        setPointsData({ history: [], totalPoints: 0, unlockedFromFirestore: [], streak: 0, rawStats: { questions: 0, maps: 0, favorites: 0 } });
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const activitiesSummary = useMemo(() => {
    return pointsData ? categorizeActivities(pointsData.history, timeframe) : null;
  }, [pointsData, timeframe]);

  const userUnlockedBadges = useMemo(() => {
    return pointsData?.unlockedFromFirestore || [];
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
            <span className={styles.pointsNumber}>{convertToArabicNumber(pointsData?.totalPoints || 0)}</span>
            <span className={styles.pointsLabel}>نقطة إجمالية</span>
          </div>
          <div className={styles.streakBadge}>
            <FaFire className={styles.fireIcon} />
            <span>سلسلة تفاعل: {convertToArabicNumber(pointsData?.streak || 0)} يوم</span>
          </div>
          <div className={styles.timeframeButtons}>
            {['day', 'week', 'month', 'year'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} className={`${styles.timeframeButton} ${timeframe === t ? styles.active : ''}`}>
                {t === 'day' ? 'اليوم' : t === 'week' ? 'الأسبوع' : t === 'month' ? 'الشهر' : 'الكل'}
              </button>
            ))}
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
        <div className={styles.badgesGrid}>
          {filteredBadges.map((family) => (
            <div key={family.family_name} className={styles.familyRow}>
              <h3 className={styles.familyTitleSmall}>{family.family_name}</h3>
              <div className={styles.badgesListHorizontal}>
                {family.badges.map((badge) => (
                  <Badge key={badge.id} badge={badge} isUnlocked={userUnlockedBadges.includes(badge.id)} />
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
              <h2 className={styles.detailedHeader}>ملخص النشاط</h2>
              <button className={styles.toggleVisibilityBtn} onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? <><FaEyeSlash /> إخفاء</> : <><FaEye /> إظهار</>}
              </button>
            </div>
            {showHistory && (
              <>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <FaSignInAlt className={styles.icon} />
                    <h3>تفاعل</h3>
                    <p>+{convertToArabicNumber(activitiesSummary.dailyActions.points)}</p>
                  </div>
                  <div className={styles.summaryCard}>
                    <FaBookOpen className={styles.icon} />
                    <h3>دراسة</h3>
                    <p>+{convertToArabicNumber(activitiesSummary.reading.points)}</p>
                  </div>
                  <div className={styles.summaryCard}>
                    <FaMapMarkedAlt className={styles.icon} />
                    <h3>خرائط</h3>
                    <p>+{convertToArabicNumber(activitiesSummary.maps.points)}</p>
                  </div>
                  <div className={styles.summaryCard}>
                    <FaTrophy className={styles.icon} />
                    <h3>بونص</h3>
                    <p>+{convertToArabicNumber(activitiesSummary.bonuses.points)}</p>
                  </div>
                </div>
                <div className={styles.detailedHistory}>
                  {activitiesSummary.filteredHistory.length > 0 ? (
                    <ul className={styles.activityList}>
                      {activitiesSummary.filteredHistory.map((item, i) => (
                        <li key={i} className={styles.activityItem}>
                          <div className={styles.activityIconWrapper}>
                            {item.activity === 'share' && <FaShareAlt />}
                            {item.activity === 'search' && <FaSearch />}
                            {item.activity === 'mapExploration' && <FaMapMarkedAlt />}
                            {item.activity === 'dailyLogin' && <FaSignInAlt />}
                            {item.activity === 'dailyQuestion' && <FaFeatherAlt />}
                          </div>
                          <div className={styles.activityInfo}>
                            <p>{item.description}</p>
                            <span>{new Date(item.timestamp).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span>
                          </div>
                          <span className={styles.activityPoints}>+{convertToArabicNumber(item.points)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.noDataSection}>لا توجد بيانات لهذه الفترة.</p>
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