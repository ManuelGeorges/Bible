'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import styles from './profile.module.css';
import studyPlansData from '../studyPlans/studyPlansData.json';

const allPlans = studyPlansData.plans;

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    verses: 0,
    chapters: 0,
    notes: 0,
    plans: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let statsToUse = null;

        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data());
          if (userDocSnap.data().stats) {
            // First priority: get data from Firestore
            statsToUse = userDocSnap.data().stats;
          }
        }

        if (!statsToUse) {
          // Second priority: If no stats in Firestore, use localStorage as a fallback
          try {
            const favouriteVerses = JSON.parse(localStorage.getItem('favourite_verses')) || {};
            const favouriteChapters = JSON.parse(localStorage.getItem('favourite_chapters')) || {};
            const userNotes = JSON.parse(localStorage.getItem('user_notes')) || {};
            const startedPlans = allPlans.filter(plan => {
              const storedCompletedDays = localStorage.getItem(`completedDays_${plan.id}`);
              if (storedCompletedDays) {
                const completedDays = JSON.parse(storedCompletedDays);
                return Object.values(completedDays).filter(Boolean).length > 0;
              }
              return false;
            });

            statsToUse = {
              verses: Object.keys(favouriteVerses).length,
              chapters: Object.keys(favouriteChapters).length,
              notes: Object.keys(userNotes).length,
              plans: startedPlans.length,
            };

            // Update Firestore with the data from localStorage
            setDoc(userDocRef, { stats: statsToUse }, { merge: true }).catch(e => {
              console.error('Failed to update user stats in Firestore:', e);
            });
          } catch (e) {
            console.error('Failed to load local stats:', e);
          }
        }
        setUserStats(statsToUse);
      } else {
        router.push('/intro');
      }
      setLoading(false);
    });

    const handleStorageChange = () => {
      // Re-fetch stats from localStorage on storage change and sync to Firestore
      try {
        const favouriteVerses = JSON.parse(localStorage.getItem('favourite_verses')) || {};
        const favouriteChapters = JSON.parse(localStorage.getItem('favourite_chapters')) || {};
        const userNotes = JSON.parse(localStorage.getItem('user_notes')) || {};
        const startedPlans = allPlans.filter(plan => {
          const storedCompletedDays = localStorage.getItem(`completedDays_${plan.id}`);
          return storedCompletedDays && Object.values(JSON.parse(storedCompletedDays)).filter(Boolean).length > 0;
        });

        const statsToSync = {
          verses: Object.keys(favouriteVerses).length,
          chapters: Object.keys(favouriteChapters).length,
          notes: Object.keys(userNotes).length,
          plans: startedPlans.length,
        };
        setUserStats(statsToSync);

        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          setDoc(userDocRef, { stats: statsToSync }, { merge: true });
        }
      } catch (e) {
        console.error('Failed to update stats on storage change:', e);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router, user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/intro');
  };

  if (loading || !user) {
    return <div className={styles.loading}>جاري التحميل...</div>;
  }

  const userFeatures = [
    { title: 'الآيات المفضلة', count: userStats.verses, description: 'عدد الآيات التي قمت بحفظها.' },
    { title: 'الاصحاحات المفضلة', count: userStats.chapters, description: 'عدد الاصحاحات التي قمت بحفظها.' },
    { title: 'نقاطي', count: userStats.notes, description: 'عدد نقاطك من القراءة والخطط وغيرها' },
    { title: 'الخطط الدراسية', count: userStats.plans, description: 'عدد الخطط التي تشارك فيها.' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <img src={user.photoURL || '/images/default-avatar.png'} alt="User Avatar" className={styles.avatar} />
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
                <p className={styles.statCount}>{item.count}</p>
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