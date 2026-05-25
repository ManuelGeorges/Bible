'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { getCairoDate, getCairoDateInfo } from '../lib/dateUtils';

const auth = typeof window !== 'undefined' ? getAuth() : null;

export default function UserTracker() {
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          // توحيد التاريخ بتوقيت القاهرة
          const today = getCairoDate();

          await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            const userName = user.displayName || 'مستخدم';

            if (userSnap.exists()) {
              const userData = userSnap.data();
              const lastLogin = userData.lastLoginDate;

              if (lastLogin !== today) {
                let newStreak = (userData.streak || 0) + 1;
                
                if (lastLogin) {
                  // حساب الفرق بالأيام بناءً على تواريخ القاهرة
                  const lastParts = lastLogin.split('-').map(Number);
                  const todayParts = today.split('-').map(Number);

                  const lastDateObj = new Date(lastParts[0], lastParts[1] - 1, lastParts[2]);
                  const todayDateObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

                  const diffTime = Math.abs(todayDateObj - lastDateObj);
                  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diffDays > 1) {
                    newStreak = 1;
                  }
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

                let totalDailyAward = 10 + bonusPoints;
                
                let updates = {
                  displayName: userName,
                  lastLoginDate: today,
                  streak: newStreak,
                  totalPoints: increment(totalDailyAward),
                  dailyInteractionPoints: 0 
                };

                if (bonusPoints > 0) {
                  toast.success(`بونص الاستمرارية! +${bonusPoints} نقطة 🔥`);
                }

                if (streakMilestones[newStreak] && !userData.badges?.includes(streakMilestones[newStreak].id)) {
                  updates.badges = arrayUnion(streakMilestones[newStreak].id);
                  toast.success(`🎉 مبروك يا ${userName}! حصلت على بادج: ${streakMilestones[newStreak].name}`, { icon: '🔥', duration: 5000 });
                }

                transaction.update(userRef, updates);
                toast(`صباح الخير يا ${userName}! +10 نقاط ☀️`, { icon: '💰' });
              }
            } else {
              transaction.set(userRef, {
                displayName: userName,
                email: user.email,
                photoURL: user.photoURL,
                streak: 1,
                lastLoginDate: today,
                totalPoints: 10,
                dailyInteractionPoints: 0,
                badges: [],
                createdAt: serverTimestamp()
              });
              toast(`أهلاً بك في أجيوس! 📖`, { icon: '✨' });
            }
          });
        } catch (error) {
          console.error("Tracker Error:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return null; 
}