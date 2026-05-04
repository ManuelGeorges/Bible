"use client";
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getCountFromServer, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useBadge } from '../app/context/BadgeContext';

export default function StatsWatcher() {
  const pathname = usePathname();
  const isInitialMount = useRef(true);
  const { triggerBadgeUnlock } = useBadge();

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
      const unlocked = docSnap.data()?.badges || [];
      if (!unlocked.includes(badgeId)) {
        await updateDoc(userRef, { badges: arrayUnion(badgeId) });
        triggerBadgeUnlock(badgeId);
      }
    } catch (e) { console.error(e); }
  };

  const syncUserData = async (user) => {
    const userRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userRef);
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      if (!docSnap.exists()) {
        const coll = collection(db, "users");
        const snapshot = await getCountFromServer(coll);
        const userNumber = snapshot.data().count;
        let loyaltyBadges = [];
        if (userNumber <= 20) loyaltyBadges.push('agios_pioneer');
        if (userNumber <= 100) loyaltyBadges.push('agios_legend');
        if (userNumber <= 1000) loyaltyBadges.push('agios_og');

        await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            totalPoints: 10,
            streak: 1,
            lastActiveDate: today,
            badges: loyaltyBadges,
            createdAt: new Date().toISOString()
        }, { merge: true });
      } else {
        let data = docSnap.data();

        if (data.stats) {
          const legacy = data.stats;
          const migrationUpdates = {
            totalPoints: data.totalPoints || legacy.total_points || 0,
            badges: data.badges || legacy.unlocked_badges || [],
            streak: data.streak || legacy.current_streak || 0,
            lastActiveDate: data.lastActiveDate || legacy.last_active_date || today,
            stats: deleteField()
          };
          await updateDoc(userRef, migrationUpdates);
          data = { ...data, ...migrationUpdates };
        }

        if (!data.email && user.email) {
          await updateDoc(userRef, { email: user.email });
        }

        const lastActive = data.lastActiveDate;
        let currentStreak = data.streak || 0;

        if (lastActive !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          let newStreak = (lastActive === yesterdayStr) ? currentStreak + 1 : 1;

          await updateDoc(userRef, {
            streak: newStreak,
            lastActiveDate: today
          });

          const consistencyBadges = checkConsistencyBadges(newStreak);
          const currentBadges = data.badges || [];
          for (const id of consistencyBadges) {
            if (!currentBadges.includes(id)) {
                await unlockBadge(id);
            }
          }
        }

        if (now.getHours() < 7) await unlockBadge('early_bird');
        if (now.getHours() >= 0 && now.getHours() < 3) await unlockBadge('night_owl');

        if (now.getHours() === 3 && now.getMinutes() === 0) {
            await unlockBadge('ghost_user');
        }

        const isDark = localStorage.getItem('theme') !== 'light';
        if (isDark) {
            const darkStart = localStorage.getItem('dark_mode_start');
            if (!darkStart) {
                localStorage.setItem('dark_mode_start', today);
            } else {
                const days = (new Date() - new Date(darkStart)) / (1000 * 60 * 60 * 24);
                if (days >= 30) await unlockBadge('shadow_reader');
            }
        } else {
            localStorage.removeItem('dark_mode_start');
        }
      }
    } catch (error) { console.error("StatsWatcher Sync Error:", error); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isInitialMount.current) {
        syncUserData(user);
        isInitialMount.current = false;
      }
    });

    return () => unsubscribe();
  }, [triggerBadgeUnlock]);

  return null;
}