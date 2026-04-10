"use client";
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getCountFromServer } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function StatsWatcher() {
  const pathname = usePathname();
  const isInitialMount = useRef(true);

  const checkConsistencyBadges = (streak) => {
    const badges = [];
    if (streak >= 365) badges.push('streak_365');
    else if (streak >= 180) badges.push('streak_180');
    else if (streak >= 90) badges.push('streak_90');
    else if (streak >= 60) badges.push('streak_60');
    else if (streak >= 30) badges.push('streak_30');
    else if (streak >= 15) badges.push('streak_15');
    else if (streak >= 7) badges.push('streak_7');
    else if (streak >= 3) badges.push('streak_3');
    return badges;
  };

  const unlockBadge = async (badgeId) => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const docSnap = await getDoc(userRef);
      const unlocked = docSnap.data()?.stats?.unlocked_badges || [];
      if (!unlocked.includes(badgeId)) {
        await updateDoc(userRef, { "stats.unlocked_badges": arrayUnion(badgeId) });
      }
    } catch (e) { console.error(e); }
  };

  const syncUserData = async (user) => {
    const userStatsRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userStatsRef);
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      if (!docSnap.exists() || !docSnap.data().stats) {
        const coll = collection(db, "users");
        const snapshot = await getCountFromServer(coll);
        const userNumber = snapshot.data().count;
        let loyaltyBadges = [];
        if (userNumber <= 20) loyaltyBadges.push('agios_pioneer');
        if (userNumber <= 100) loyaltyBadges.push('agios_legend');
        if (userNumber <= 1000) loyaltyBadges.push('agios_og');

        const initialStats = {
          current_streak: 1,
          last_active_date: today,
          total_points: 0,
          chapters_read: 0,
          quizzes_done: 0,
          perfect_quizzes: 0,
          map_points: 0,
          app_shares: 0,
          unlocked_badges: loyaltyBadges
        };
        await setDoc(userStatsRef, { 
            stats: initialStats,
            email: user.email // إضافة الإيميل للمستخدم الجديد
        }, { merge: true });
      } else {
        const data = docSnap.data();
        const stats = data.stats;

        // تصحيح: إضافة الإيميل لو مكنش موجود للمستخدم القديم
        if (!data.email && user.email) {
          await updateDoc(userStatsRef, { email: user.email });
        }

        const loyaltyIds = ['agios_pioneer', 'agios_legend', 'agios_og'];
        const hasLoyaltyBadge = loyaltyIds.some(id => stats.unlocked_badges.includes(id));
        if (!hasLoyaltyBadge) {
          const coll = collection(db, "users");
          const snapshot = await getCountFromServer(coll);
          const userNumber = snapshot.data().count;
          if (userNumber <= 20) await unlockBadge('agios_pioneer');
          else if (userNumber <= 100) await unlockBadge('agios_legend');
          else if (userNumber <= 1000) await unlockBadge('agios_og');
        }

        const lastActive = stats.last_active_date;
        let newStreak = stats.current_streak;
        if (lastActive !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          newStreak = (lastActive === yesterdayStr) ? newStreak + 1 : 1;
          await updateDoc(userStatsRef, {
            "stats.current_streak": newStreak,
            "stats.last_active_date": today
          });
        }

        const consistencyBadges = checkConsistencyBadges(newStreak);
        for (const id of consistencyBadges) {
          if (!stats.unlocked_badges.includes(id)) { await unlockBadge(id); }
        }

        if (now.getHours() < 7) await unlockBadge('early_bird');
        if (now.getHours() >= 0 && now.getHours() < 3) await unlockBadge('night_owl');
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isInitialMount.current) {
        syncUserData(user);
        isInitialMount.current = false;
      }
    });

    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) { unlockBadge('ghost_user'); }

    let pointsTimer;
    if (pathname === '/points') { pointsTimer = setTimeout(() => unlockBadge('deep_diver'), 600000); }
    if (pathname === '/settings') {
      const dailyCount = parseInt(sessionStorage.getItem('settings_clicks') || '0') + 1;
      sessionStorage.setItem('settings_clicks', dailyCount);
      if (dailyCount >= 10) unlockBadge('data_obsessive');
    }

    return () => {
      unsubscribe();
      if (pointsTimer) clearTimeout(pointsTimer);
    };
  }, [pathname]);

  return null;
}