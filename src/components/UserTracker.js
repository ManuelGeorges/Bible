'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

const auth = typeof window !== 'undefined' ? getAuth() : null;

export default function UserTracker() {
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            const lastLogin = userData.lastLoginDate;
            const today = new Date().toISOString().split('T')[0];

            if (lastLogin !== today) {
              let newStreak = (userData.streak || 0) + 1;
              
              if (lastLogin) {
                const lastDate = new Date(lastLogin);
                const currentDate = new Date(today);
                const diffTime = Math.abs(currentDate - lastDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 1) {
                  newStreak = 1;
                }
              }

              const streakMilestones = {
                3: { id: 'streak_3', name: 'المواظب المبتدئ (3 أيام)' },
                7: { id: 'streak_7', name: 'المجتهد (أسبوع)' },
                15: { id: 'streak_15', name: 'المثابر (15 يوم)' },
                30: { id: 'streak_30', name: 'الوفي (شهر)' },
                60: { id: 'streak_60', name: 'البطل (شهرين)' },
                90: { id: 'streak_90', name: 'الأسطورة (3 شهور)' },
                180: { id: 'streak_180', name: 'العملاق (نصف سنة)' },
                365: { id: 'streak_365', name: 'القديس المعاصر (سنة كاملة)' }
              };

              let updates = {
                lastLoginDate: today,
                streak: newStreak,
                totalPoints: increment(10)
              };

              if (streakMilestones[newStreak] && !userData.badges?.includes(streakMilestones[newStreak].id)) {
                updates.badges = arrayUnion(streakMilestones[newStreak].id);
                toast.success(`🎉 مبروك! حصلت على بادج: ${streakMilestones[newStreak].name}`, {
                  icon: '🔥',
                  duration: 5000
                });
              }

              await updateDoc(userRef, updates);
              toast(`صباح الخير! +10 نقاط مكافأة الدخول اليومي ☀️`, { icon: '💰' });
            }
          }
        } catch (error) {
          console.error("Tracker Error:", error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return null; 
}