"use client";
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, getCountFromServer, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useBadge } from '../app/context/BadgeContext';
import { getCairoDate, getCairoDateInfo, getCairoIsoString } from '../lib/dateUtils';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

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

  const checkPlanStreakBadges = (totalDays) => {
    const badges = [];
    if (totalDays >= 365) badges.push('plan_streak_365');
    if (totalDays >= 180) badges.push('plan_streak_180');
    if (totalDays >= 90) badges.push('plan_streak_90');
    if (totalDays >= 60) badges.push('plan_streak_60');
    if (totalDays >= 30) badges.push('plan_streak_30');
    if (totalDays >= 14) badges.push('plan_streak_14');
    if (totalDays >= 7) badges.push('plan_streak_7');
    if (totalDays >= 3) badges.push('plan_streak_3');
    if (totalDays >= 1) badges.push('plan_streak_1');
    return badges;
  };

  const checkPlanAchievementBadges = (finishedCount, startedCount) => {
    const badges = [];
    if (startedCount >= 1) badges.push('plan_start_1');
    if (finishedCount >= 1) badges.push('plan_finish_1');
    if (finishedCount >= 3) badges.push('plan_finish_3');
    if (finishedCount >= 5) badges.push('plan_finish_5');
    if (finishedCount >= 10) badges.push('plan_finish_10');
    if (finishedCount >= 20) badges.push('plan_finish_20');
    return badges;
  };

  const unlockBadge = async (badgeId, userData = null) => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const currentBadges = userData?.badges || (await getDoc(userRef)).data()?.badges || [];

      if (!currentBadges.includes(badgeId)) {
        await updateDoc(userRef, { badges: arrayUnion(badgeId) });
        triggerBadgeUnlock(badgeId);
        return true;
      }
    } catch (e) { console.error(e); }
    return false;
  };

  const syncUserData = async (user) => {
    const userRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userRef);
      const today = getCairoDate();
      const cairoInfo = getCairoDateInfo();

      let deviceInfo = {};
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await Device.getInfo();
          deviceInfo = {
            deviceModel: info.model,
            deviceManufacturer: info.manufacturer,
            deviceOS: info.operatingSystem,
            deviceOSVersion: info.osVersion,
            platform: Capacitor.getPlatform()
          };
        } catch (e) { console.error("Device Info Error:", e); }
      }

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
            createdAt: getCairoIsoString(),
            ...deviceInfo
        }, { merge: true });

        // تفعيل شاشة التهنئة لأوسمة الولاء فوراً للمستخدم الجديد
        loyaltyBadges.forEach(id => triggerBadgeUnlock(id));
      } else {
        let data = docSnap.data();
        const updates = { ...deviceInfo };

        if (data.stats) {
          const legacy = data.stats;
          updates.totalPoints = data.totalPoints || legacy.total_points || 0;
          updates.badges = data.badges || legacy.unlocked_badges || [];
          updates.streak = data.streak || legacy.current_streak || 0;
          updates.lastActiveDate = data.lastActiveDate || legacy.last_active_date || today;
          updates.stats = deleteField();
        }

        if (!data.email && user.email) {
          updates.email = user.email;
        }

        const lastActive = data.lastActiveDate;
        let currentStreak = data.streak || 0;

        if (lastActive !== today) {
          const now = new Date();
          const yesterdayObj = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          const yesterdayStr = getCairoDate(yesterdayObj);

          let newStreak = (lastActive === yesterdayStr) ? currentStreak + 1 : 1;
          updates.streak = newStreak;
          updates.lastActiveDate = today;

          const consistencyBadges = checkConsistencyBadges(newStreak);
          const currentBadges = data.badges || [];
          for (const id of consistencyBadges) {
            if (!currentBadges.includes(id)) {
                await unlockBadge(id, data);
            }
          }
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
        }

        const completedPlans = data.completedPlans || {};
        const customPlans = data.customPlans || {};
        const allPlans = { ...completedPlans, ...customPlans };

        let totalPlanDays = 0;
        let finishedCount = 0;
        let startedCount = Object.keys(allPlans).length;

        Object.values(allPlans).forEach(plan => {
          const doneDays = Object.values(plan.completedDays || {}).filter(d => d.isCompleted).length;
          totalPlanDays += doneDays;
          if (plan.completionPercentage === 100) finishedCount++;
        });

        const planStreakBadges = checkPlanStreakBadges(totalPlanDays);
        const planAchievementBadges = checkPlanAchievementBadges(finishedCount, startedCount);

        const currentBadges = data.badges || [];
        for (const id of [...planStreakBadges, ...planAchievementBadges]) {
          if (!currentBadges.includes(id)) {
            await unlockBadge(id, data);
          }
        }

        const hours = cairoInfo.hour;
        const minutes = cairoInfo.minute;

        if (hours < 7) await unlockBadge('early_bird', data);
        if (hours >= 0 && hours < 3) await unlockBadge('night_owl', data);

        if (hours === 3 && minutes === 0) {
            await unlockBadge('ghost_user', data);
        }

        const savedTheme = localStorage.getItem('theme') || 'system';
        const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        if (isDark) {
            const darkStart = localStorage.getItem('dark_mode_start');
            if (!darkStart) {
                localStorage.setItem('dark_mode_start', today);
            } else {
                const startParts = darkStart.split('-').map(Number);
                const startDate = new Date(startParts[0], startParts[1]-1, startParts[2]);
                const todayParts = today.split('-').map(Number);
                const todayDate = new Date(todayParts[0], todayParts[1]-1, todayParts[2]);

                const days = (todayDate - startDate) / (1000 * 60 * 60 * 24);
                if (days >= 30) await unlockBadge('shadow_reader', data);
            }
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
