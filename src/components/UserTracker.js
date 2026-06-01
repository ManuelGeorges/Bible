'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { getCairoDate } from '../lib/dateUtils';
import { Capacitor } from '@capacitor/core';
import { StorageService } from '../lib/storage';

const auth = typeof window !== 'undefined' ? getAuth() : null;

export default function UserTracker() {
  useEffect(() => {
    const trackActivity = async (user) => {
      try {
        const today = getCairoDate();

        if (user) {
          // --- منطق المستخدم المسجل ---
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const userName = user.displayName || 'مستخدم أجيوس';

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
            toast(`أهلاً بك في أجيوس! 📖`, { icon: '✨' });
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
                3: { id: 'streak_3', name: 'المواظب المبتدئ (3 أيام)' },
                7: { id: 'streak_7', name: 'المجتهد (أسبوع)' },
                15: { id: 'streak_15', name: 'المثابر (15 يوم)' },
                30: { id: 'streak_30', name: 'الوفي (شهر)' },
                90: { id: 'streak_90', name: 'الأسطورة (3 شهور)' }
              };

              let updates = {
                lastLoginDate: today,
                streak: newStreak,
                totalPoints: increment(10 + bonusPoints),
                dailyInteractionPoints: 0
              };

              if (bonusPoints > 0) toast.success(`بونص الاستمرارية! +${bonusPoints} نقطة 🔥`);

              if (streakMilestones[newStreak] && !userData.badges?.includes(streakMilestones[newStreak].id)) {
                updates.badges = arrayUnion(streakMilestones[newStreak].id);
                toast.success(`🎉 مبروك! حصلت على بادج: ${streakMilestones[newStreak].name}`, { icon: '🔥' });
              }

              await updateDoc(userRef, updates);
              await StorageService.updateStreak(newStreak);
              toast(`صباح الخير يا ${userName}! +10 نقاط ☀️`, { icon: '💰' });
            }
          }
        } else {
          // --- منطق الزائر (Locally) ---
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

            toast(`أهلاً بك مجدداً! ستريك اليوم: ${newStreak} 🔥`, { icon: '✨' });
          }
        }

        // تحديث الستريك في الواجهة الأصلية (Native)
        if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateUserStats) {
          const currentStreak = user ? (await getDoc(doc(db, 'users', user.uid))).data().streak : (await StorageService.get('agios_streak'));
          window.AgiosScannerNative.updateUserStats(currentStreak);
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

    // تشغيل التتبع لمرة واحدة عند التحميل للزوار في حال لم يتغير Auth
    if (!auth.currentUser) trackActivity(null);

    return () => unsubscribe();
  }, []);

  return null; 
}