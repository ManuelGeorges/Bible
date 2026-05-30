'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { useBadge } from '../../context/BadgeContext';
import { getCairoIsoString } from '../../../lib/dateUtils';
import { StorageService, KEYS } from '../../../lib/storage';

const allPlans = studyPlansData.plans;

function PlanDetailsContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('id');
  const planType = searchParams.get('type');
  const { triggerBadgeUnlock } = useBadge();

  const readingsListRef = useRef(null);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [plan, setPlan] = useState(null);
  const [completedDays, setCompletedDays] = useState({});
  const [completedChapters, setCompletedChapters] = useState({});
  const [bookNames, setBookNames] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLocalData = useCallback(async () => {
    const localChapters = await StorageService.get(KEYS.COMPLETED_CHAPTERS) || {};
    setCompletedChapters(localChapters);

    const localCompletedPlans = await StorageService.get('local_completed_plans') || {};
    const localCustomPlans = await StorageService.get('local_custom_plans') || {};
    const localBadges = await StorageService.get('local_badges') || [];
    const localStreak = await StorageService.get('userStreak') || 0;

    setUserData({
      completedPlans: localCompletedPlans,
      customPlans: localCustomPlans,
      badges: localBadges,
      userStreak: localStreak
    });

    if (planType === 'custom') {
      const aiPlan = localCustomPlans[planId];
      if (aiPlan) {
        setPlan(aiPlan);
        setCompletedDays(aiPlan.completedDays || {});
      }
    } else {
      const staticPlan = allPlans.find((p) => p.id === parseInt(planId));
      setPlan(staticPlan);
      setCompletedDays(localCompletedPlans[planId]?.completedDays || {});
    }
  }, [planId, planType]);

  const unlockBadge = useCallback(async (badgeId, currentBadges) => {
    if (user) {
      if (currentBadges?.includes(badgeId)) return;
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { badges: arrayUnion(badgeId) });
        triggerBadgeUnlock(badgeId);
      } catch (e) { console.error(e); }
    } else {
      const localBadges = await StorageService.get('local_badges') || [];
      if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save('local_badges', localBadges);
        triggerBadgeUnlock(badgeId);
      }
    }
  }, [user, triggerBadgeUnlock]);

  const checkAndUnlockBadges = useCallback((data) => {
    const currentBadges = data.badges || [];
    const allUserPlans = { ...(data.completedPlans || {}), ...(data.customPlans || {}) };

    let totalPlanDays = 0;
    let finishedCount = 0;
    let startedCount = 0;

    Object.values(allUserPlans).forEach(p => {
      const done = Object.values(p.completedDays || {}).filter(d => d.isCompleted).length;
      totalPlanDays += done;
      if (done > 0) startedCount++;
      if (p.completionPercentage === 100) finishedCount++;
    });

    const dayMilestones = [
      { d: 365, id: 'plan_streak_365' }, { d: 180, id: 'plan_streak_180' },
      { d: 90, id: 'plan_streak_90' }, { d: 60, id: 'plan_streak_60' },
      { d: 30, id: 'plan_streak_30' }, { d: 14, id: 'plan_streak_14' },
      { d: 7, id: 'plan_streak_7' }, { d: 3, id: 'plan_streak_3' },
      { d: 1, id: 'plan_streak_1' }
    ];

    dayMilestones.forEach(m => {
      if (totalPlanDays >= m.d) unlockBadge(m.id, currentBadges);
    });

    const userStreak = data.userStreak || 0;
    const streakMilestones = [
      { s: 365, id: 'streak_365' }, { s: 180, id: 'streak_180' },
      { s: 90, id: 'streak_90' }, { s: 60, id: 'streak_60' },
      { s: 30, id: 'streak_30' }, { s: 15, id: 'streak_15' },
      { s: 7, id: 'streak_7' }, { s: 3, id: 'streak_3' }
    ];

    streakMilestones.forEach(m => {
      if (userStreak >= m.s) unlockBadge(m.id, currentBadges);
    });

    if (startedCount >= 1) unlockBadge('plan_start_1', currentBadges);
    if (finishedCount >= 1) unlockBadge('plan_finish_1', currentBadges);
    if (finishedCount >= 3) unlockBadge('plan_finish_3', currentBadges);
    if (finishedCount >= 5) unlockBadge('plan_finish_5', currentBadges);
    if (finishedCount >= 10) unlockBadge('plan_finish_10', currentBadges);
    if (finishedCount >= 20) unlockBadge('plan_finish_20', currentBadges);
  }, [unlockBadge]);

  useEffect(() => {
    fetch('/data/bookNames.json')
      .then(res => res.json())
      .then(data => setBookNames(data.ar || []))
      .catch(err => console.error("Error loading book names:", err));
  }, []);

  useEffect(() => {
    if (!planId) return;

    const auth = getAuth();
    let unsubSnap = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (loggedInUser) => {
      setUser(loggedInUser);
      
      if (loggedInUser) {
        const userRef = doc(db, 'users', loggedInUser.uid);
        unsubSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setCompletedChapters(data.completedChapters || {});

            if (planType === 'custom') {
              const aiPlan = data.customPlans?.[planId];
              if (aiPlan) {
                setPlan(aiPlan);
                setCompletedDays(aiPlan.completedDays || {});
              }
            } else {
              const staticPlan = allPlans.find((p) => p.id === parseInt(planId));
              setPlan(staticPlan);
              const planData = data.completedPlans?.[planId]?.completedDays || {};
              setCompletedDays(planData);
            }
          }
          setLoading(false);
        });
      } else {
        await loadLocalData();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubSnap();
    };
  }, [planId, planType, loadLocalData]);

  useEffect(() => {
    if (!user) {
      const handleFocus = () => {
        loadLocalData();
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [user, loadLocalData]);

  const isReadingDone = (readingStr) => {
    if (!bookNames.length || !completedChapters) return false;
    try {
      const trimmed = readingStr.trim();
      const parts = trimmed.split(' ');
      const chaptersPart = parts.pop();
      const bookName = parts.join(' ');
      const bookIndex = bookNames.findIndex(b => b.name === bookName);
      if (bookIndex === -1) return false;

      let chaptersToNodes = [];
      if (chaptersPart.includes('-')) {
        const [start, end] = chaptersPart.split('-').map(Number);
        for (let i = start; i <= end; i++) chaptersToNodes.push(i);
      } else if (chaptersPart.includes(',')) {
        chaptersToNodes = chaptersPart.split(',').map(Number);
      } else {
        chaptersToNodes.push(Number(chaptersPart));
      }
      return chaptersToNodes.every(c => completedChapters[`${bookIndex}-${c - 1}`]);
    } catch (e) { return false; }
  };

  const isDayAutoCompleted = (reading) => {
    if (!reading.books || reading.books.length === 0) return false;
    return reading.books.every(b => isReadingDone(b));
  };

  const handleCheck = async (day) => {
    const isCurrentlyManual = completedDays[day]?.isCompleted;
    let newCompletedDays = { ...completedDays };

    if (isCurrentlyManual) {
      delete newCompletedDays[day];
      toast.success("تم إلغاء التحديد اليدوي");
    } else {
      newCompletedDays[day] = { 
        isCompleted: true, 
        dateCompleted: getCairoIsoString()
      };
      toast.success("تم التحديد يدوياً");
    }

    const totalDays = plan.readings.length;
    const daysDoneCount = plan.readings.filter(r => {
        return newCompletedDays[r.day]?.isCompleted || isDayAutoCompleted(r);
    }).length;
    const percentage = Math.round((daysDoneCount / totalDays) * 100);

    setCompletedDays(newCompletedDays);

    const updatedUserData = { ...userData };
    if (planType === 'custom') {
        updatedUserData.customPlans = updatedUserData.customPlans || {};
        updatedUserData.customPlans[planId] = { ...(updatedUserData.customPlans[planId] || plan), completedDays: newCompletedDays, completionPercentage: percentage };
    } else {
        updatedUserData.completedPlans = updatedUserData.completedPlans || {};
        updatedUserData.completedPlans[planId] = { completedDays: newCompletedDays, completionPercentage: percentage };
    }

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const fieldPath = planType === 'custom' ? `customPlans.${planId}` : `completedPlans.${planId}`;
        await updateDoc(userRef, {
          [`${fieldPath}.completedDays`]: newCompletedDays,
          [`${fieldPath}.completionPercentage`]: percentage
        });
        checkAndUnlockBadges(updatedUserData);
      } catch (e) {
        console.error(e);
        toast.error("حدث خطأ أثناء مزامنة البيانات");
      }
    } else {
      if (planType === 'custom') {
        const localCustom = await StorageService.get('local_custom_plans') || {};
        localCustom[planId] = updatedUserData.customPlans[planId];
        await StorageService.save('local_custom_plans', localCustom);
      } else {
        const localCompletion = await StorageService.get('local_completed_plans') || {};
        localCompletion[planId] = updatedUserData.completedPlans[planId];
        await StorageService.save('local_completed_plans', localCompletion);
      }
      setUserData(updatedUserData);
      checkAndUnlockBadges(updatedUserData);
    }
  };

  if (loading) return <div className={styles.container}>جاري تحميل خطتك...</div>;
  if (!plan) return notFound();

  const progressPercentage = Math.round(
    (plan.readings.filter(r => (completedDays[r.day]?.isCompleted || isDayAutoCompleted(r))).length / plan.readings.length) * 100
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{plan.title}</h1>
      {plan.description && (
        <div className={styles.descriptionWrapper}>
          <p className={styles.description}>{plan.description}</p>
        </div>
      )}
      <div className={styles.progressWrapper}>
        <div className={styles.progressInfo}>
          <span>نسبة الإنجاز</span>
          <span>%{progressPercentage}</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercentage}%`, backgroundColor: progressPercentage === 100 ? '#4CAF50' : '' }}></div>
        </div>
      </div>

      <ul className={styles.readingsList} ref={readingsListRef}>
        {plan.readings.map((reading) => {
          const isManual = completedDays[reading.day]?.isCompleted;
          const isAuto = isDayAutoCompleted(reading);
          const isCompleted = isManual || isAuto;

          return (
            <li key={reading.day} className={`${styles.readingItem} ${isCompleted ? styles.completed : ''}`}>
              <div className={styles.dayHeader}>
                <div className={styles.dayLabel}>اليوم {reading.day}</div>
                <div className={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    id={`day-${reading.day}`}
                    checked={isCompleted || false}
                    onChange={() => handleCheck(reading.day)}
                  />
                </div>
              </div>
              <div className={styles.booksGrid}>
                {reading.books.map((b, i) => {
                  const isDone = isReadingDone(b);
                  const parts = b.trim().split(' ');
                  const chapterNum = parts.pop();
                  const bookName = parts.join(' ');
                  return (
                    <Link key={i} href={`/bible?book=${encodeURIComponent(bookName)}&chapter=${chapterNum.split('-')[0]}&planId=${planId}&planType=${planType}&day=${reading.day}`} className={`${styles.bookLink} ${isDone ? styles.bookDone : ''}`}>
                      {b} {isDone && '✓'}
                    </Link>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PlanDetailsPage() {
  return (
    <Suspense fallback={<div className={styles.container}>جاري التحميل...</div>}>
      <PlanDetailsContent />
    </Suspense>
  );
}
