'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { getCairoDate, getCairoIsoString } from '../lib/dateUtils';
import { Capacitor } from '@capacitor/core';
import { StorageService } from '../lib/storage';
import { useLanguage } from '../app/context/LanguageContext';

const auth = typeof window !== 'undefined' ? getAuth() : null;

export default function UserTracker() {
  const { strings, formatNumber, language } = useLanguage();

  useEffect(() => {
    const trackActivity = async (user) => {
      try {
        const today = getCairoDate();

        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const userName = user.displayName || strings.common.default_first_name;

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: userName,
              email: user.email,
              photoURL: user.photoURL,
              streak: 1,
              lastLoginDate: today,
              totalPoints: 10,
              dailyInteractionPoints: 0,
              badges: [],
              createdAt: serverTimestamp(),
              favorites: { verses: {} },
              completedChapters: {},
              completedPlans: {}
            });
            await StorageService.updateStreak(1);
            toast(strings.home.toasts.welcome_new, { icon: '✨' });
          } else {
            const userData = userSnap.data();
            const lastLogin = userData.lastLoginDate;

            if (lastLogin !== today) {
              let newStreak = (userData.streak || 0) + 1;

              if (lastLogin) {
                const diffDays = calculateDiffDays(lastLogin, today);
                if (diffDays > 1) newStreak = 1;
              }

              const streakBonuses = { 3: 50, 7: 150, 15: 400, 30: 1000, 90: 3000 };
              let bonusPoints = streakBonuses[newStreak] || 0;

              const streakMilestones = {
                3: { id: 'streak_3', name: language === 'ar' ? 'المواظب المبتدئ (3 أيام)' : 'Beginner Diligent (3 days)' },
                7: { id: 'streak_7', name: language === 'ar' ? 'المجتهد (أسبوع)' : 'Hardworking (Week)' },
                15: { id: 'streak_15', name: language === 'ar' ? 'المثابر (15 يوم)' : 'Perserverant (15 days)' },
                30: { id: 'streak_30', name: language === 'ar' ? 'الوفي (شهر)' : 'Loyal (Month)' },
                90: { id: 'streak_90', name: language === 'ar' ? 'الأسطورة (3 شهور)' : 'Legend (3 months)' }
              };

              let updates = {
                lastLoginDate: today,
                streak: newStreak,
                totalPoints: increment(10 + bonusPoints),
                dailyInteractionPoints: 0
              };

              if (bonusPoints > 0) {
                toast.success(strings.home.toasts.streak_bonus.replace('{points}', formatNumber(bonusPoints)));
              }

              if (streakMilestones[newStreak] && !userData.badges?.includes(streakMilestones[newStreak].id)) {
                updates.badges = arrayUnion(streakMilestones[newStreak].id);
                toast.success(strings.home.toasts.badge_unlocked.replace('{badgeName}', streakMilestones[newStreak].name), { icon: '🔥' });
              }

              await updateDoc(userRef, updates);
              await StorageService.updateStreak(newStreak);
              toast(strings.home.toasts.good_morning.replace('{userName}', userName), { icon: '💰' });
            }
          }
        } else {
          const localStats = await StorageService.getLocalStats();
          const lastActive = await StorageService.get('agios_last_active');

          if (lastActive !== today) {
            let newStreak = (localStats.streak || 0) + 1;

            if (lastActive) {
              const diffDays = calculateDiffDays(lastActive, today);
              if (diffDays > 1) newStreak = 1;
            }

            await StorageService.updateStreak(newStreak);
            await StorageService.save('agios_last_active', today);
            await StorageService.addPoints(10);

            // إضافة النشاط للسجل المحلي ليظهر كمكتمل في صفحة النقاط
            const history = await StorageService.get('points_history') || [];
            history.push({
              type: 'dailyLogin',
              points: 10,
              reason: strings.points?.points_reasons?.daily_login || 'Daily login',
              timestamp: getCairoIsoString()
            });
            await StorageService.save('points_history', history);

            toast(strings.home.toasts.welcome_back.replace('{streak}', formatNumber(newStreak)), { icon: '✨' });
          }
        }

        // تحديث إحصائيات الويدجت (النقاط، الستريك، الخطط)
        if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateUserStats) {
          const userData = user ? (await getDoc(doc(db, 'users', user.uid))).data() : null;
          const currentStreak = userData ? userData.streak : (await StorageService.get('agios_streak'));
          const currentPoints = userData ? (userData.totalPoints || 0) : (await StorageService.getLocalStats()).points;

          window.AgiosScannerNative.updateUserStats(currentStreak || 0, null, currentPoints || 0);
        }

      } catch (error) {
        console.error("Tracker Error:", error);
      }
    };

    const calculateDiffDays = (lastDate, today) => {
      const lastParts = lastDate.split('-').map(Number);
      const todayParts = today.split('-').map(Number);
      const lastDateObj = new Date(lastParts[0], lastParts[1] - 1, lastParts[2]);
      const todayDateObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
      const diffTime = Math.abs(todayDateObj - lastDateObj);
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, trackActivity);
    if (!auth.currentUser) trackActivity(null);
    return () => unsubscribe();
  }, [strings, formatNumber, language]);

  return null; 
}
