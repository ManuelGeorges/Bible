'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import styles from './profile.module.css';

const calculatePoints = (data) => {
  let totalPoints = 0;
  const POINTS_PER_DAILY_QUESTION = 10;
  const POINTS_PER_FAVOURITE_VERSE = 10;
  const POINTS_PER_COMPLETED_CHAPTER = 20;
  const POINTS_PER_STUDY_PLAN_DAY = 30;

  if (data.answeredQuestions) {
    Object.values(data.answeredQuestions).forEach(q => { if (q?.isCorrect) totalPoints += POINTS_PER_DAILY_QUESTION; });
  }
  if (data.favorites?.verses) {
    totalPoints += Object.keys(data.favorites.verses).length * POINTS_PER_FAVOURITE_VERSE;
  }
  if (data.completedChapters) {
    Object.values(data.completedChapters).forEach(done => { if (done === true) totalPoints += POINTS_PER_COMPLETED_CHAPTER; });
  }
  if (data.completedPlans) {
    Object.values(data.completedPlans).forEach(plan => {
      if (plan?.completedDays) {
        const days = Object.values(plan.completedDays).filter(d => d.isCompleted).length;
        totalPoints += days * POINTS_PER_STUDY_PLAN_DAY;
      }
    });
  }
  return totalPoints;
};

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    verses: 0,
    chapters: 0,
    points: 0,
    plans: 0,
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
        const totalPoints = calculatePoints(data);

        setUserStats({
          verses: versesCount,
          chapters: completedChaptersCount,
          points: totalPoints,
          plans: activePlansCount,
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

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/intro');
  };

  if (loading) {
    return <div className={styles.loading}>جاري التحميل...</div>;
  }

  if (!user) return null;

  const userFeatures = [
    { title: 'الآيات المفضلة', count: userStats.verses, description: 'عدد الآيات التي قمت بحفظها.' },
    { title: 'إصحاحات مقروءة', count: userStats.chapters, description: 'عدد الإصحاحات التي انتهيت منها.' },
    { title: 'نقاطي', count: userStats.points, description: 'إجمالي النقاط التي جمعتها من نشاطك.' },
    { title: 'الخطط الدراسية', count: userStats.plans, description: 'عدد الخطط التي بدأت بمتابعتها.' },
  ];

  return (
    <div className={styles.container} dir="rtl">
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>

          <div className={styles.userInfo}>
            <h1 className={styles.userName}>{userData?.firstName || user.displayName || 'يا صديق'}</h1>
            <p className={styles.userEmail}>{user.email}</p>
          </div>
          <button onClick={handleLogout} className={styles.logoutButton}>
            تسجيل الخروج
          </button>
        </div>

        <section className={styles.statsSection}>
          <h2 className={styles.sectionTitle}>نظرة عامة على نشاطك</h2>
          <div className={styles.statsGrid}>
            {userFeatures.map((item, index) => (
              <div key={index} className={styles.statCard}>
                <h3 className={styles.statTitle}>{item.title}</h3>
                <p className={styles.statCount}>{item.count.toLocaleString('ar-EG')}</p>
                <p className={styles.statDescription}>{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;