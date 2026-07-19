'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { useBadge } from '../../context/BadgeContext';
import { getCairoIsoString } from '../../../lib/dateUtils';
import { StorageService, KEYS } from '../../../lib/storage';
import { useLanguage } from '../../context/LanguageContext';

const allPlans = studyPlansData.plans;

/**
 * دالة لتنظيف النص وتوحيده للمقارنة المرنة جداً
 */
const flexibleNormalize = (text) => {
  if (!text) return "";
  let n = text.toString()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\u064B-\u0652]/g, "") // إزالة التشكيل
    .replace(/اول/g, '1')
    .replace(/ثاني/g, '2')
    .replace(/ثالث/g, '3')
    .replace(/\s+/g, '') // إزالة المسافات
    .toLowerCase()
    .trim();

  // إزالة البادئات والكلمات الموصلة الشائعة بشكل تكراري
  const wordsToRemove = ['رساله', 'سفر', 'انجيل', 'بشاره', 'ال', 'الي', 'الى', 'الرساله', 'من', 'عن'];
  let changed = true;
  while(changed) {
    changed = false;
    for (const w of wordsToRemove) {
      if (n.startsWith(w)) {
        n = n.substring(w.length);
        changed = true;
      }
    }
  }
  return n;
};

/**
 * قاموس الاختصارات العربية لأسفار الكتاب المقدس
 */
const arabicAbbreviations = {
  "تك": "التكوين", "خر": "الخروج", "لا": "اللاويين", "عد": "العدد", "تث": "التثنية",
  "يش": "يشوع", "قض": "القضاة", "رع": "راعوث", "صم1": "صموئيل الأول", "صم2": "صموئيل الثاني",
  "مل1": "الملوك الأول", "مل2": "الملوك الثاني", "اخ1": "أخبار الأيام الأول", "اخ2": "أخبار الأيام الثاني",
  "عز": "عزرا", "نح": "نحميا", "طو": "طوبيا", "يهو": "يهوديت", "اس": "أستير", "اي": "أيوب",
  "مز": "المزامير", "ام": "الأمثال", "جا": "الجامعة", "نش": "نشيد الأنشاد", "حك": "الحكمة",
  "سي": "يشوع بن سيراخ", "اش": "إشعياء", "ار": "إرميا", "مرا": "مراثي إرميا", "با": "باروخ",
  "حز": "حزقيال", "دا": "دانيال", "هو": "هوشع", "يوئ": "يوئيل", "عا": "عاموس", "عو": "عوبديا",
  "يون": "يونان", "مي": "ميخا", "نا": "ناحوم", "حب": "حبقوق", "صف": "صفنيا", "حج": "حجي",
  "زك": "زكريا", "ملا": "ملاخي", "مك1": "مكابيين أول", "مك2": "مكابيين ثاني",
  "مت": "متى", "مر": "مرقس", "لو": "لوقا", "يو": "يوحنا", "اع": "أعمال الرسل",
  "رو": "رسالة رومية", "كو1": "رسالة كورنثوس الأولى", "كو2": "رسالة كورنثوس الثانية", "غل": "غلاطية", "اف": "أفسس",
  "في": "رسالة فيلبي", "كل": "رسالة كولوسي", "تس1": "رسالة تسالونيكي الأولى", "تس2": "رسالة تسالونيكي الثانية",
  "تي1": "رسالة تيموثاوس الأولى", "تي2": "رسالة تيموثاوس الثانية", "تط": "رسالة تيطس", "فل": "رسالة فليمون",
  "عب": "رسالة العبرانيين", "يع": "رسالة يعقوب", "بط1": "رسالة بطرس الأولى", "بط2": "رسالة بطرس الثانية",
  "يو1": "رسالة يوحنا الأولى", "يو2": "رسالة يوحنا الثانية", "يو3": "رسالة يوحنا الثالثة", "يه": "رسالة يهوذا", "رؤ": "رؤيا يوحنا اللاهوتي",
  "كو": "رسالة كولوسي", "فلم": "رسالة فليمون"
};

function PlanDetailsContent() {
  const { strings, bookNames, language } = useLanguage();
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
  const [loading, setLoading] = useState(true);

  const getSharedPlanFromCache = async (id) => {
    const cachedPlans = await StorageService.get(KEYS.SHARED_PLANS_CACHE);
    if (cachedPlans && Array.isArray(cachedPlans)) {
      return cachedPlans.find(p => String(p.id) === String(id));
    }
    return null;
  };

  /**
   * البحث عن فهرس السفر بشكل مرن جداً
   */
  const findBookIndexFlexibly = useCallback((inputName) => {
    if (!bookNames || !bookNames.length) return -1;

    const rawInput = inputName.trim();
    const normalizedInput = flexibleNormalize(rawInput);

    // 1. محاولة التطابق مع book_id (Gen, Exo, etc.)
    let idx = bookNames.findIndex(b => b.book_id && b.book_id.toLowerCase() === rawInput.toLowerCase());
    if (idx !== -1) return idx;

    // 2. محاولة التطابق مع الاختصارات العربية
    if (arabicAbbreviations[normalizedInput]) {
      const fullArabicName = arabicAbbreviations[normalizedInput];
      idx = bookNames.findIndex(b => b.name === fullArabicName);
      if (idx !== -1) return idx;
    }

    // 3. محاولة التطابق التام مع الاسم الأصلي
    idx = bookNames.findIndex(b => b.name === rawInput);
    if (idx !== -1) return idx;

    // 4. محاولة التطابق بعد التوحيد (Normalization)
    idx = bookNames.findIndex(b => flexibleNormalize(b.name) === normalizedInput);
    if (idx !== -1) return idx;

    // 5. محاولة التطابق الجزئي
    idx = bookNames.findIndex(b => {
      const normName = flexibleNormalize(b.name);
      return normName.includes(normalizedInput) || normalizedInput.includes(normName);
    });

    return idx;
  }, [bookNames]);

  /**
   * دالة موحدة لتحليل نص القراءة (السفر والعدد) بشكل مرن
   */
  const parseReading = useCallback((readingStr) => {
    if (!readingStr) return null;
    const trimmed = readingStr.trim();

    // ريجكس لفصل اسم السفر عن رقم الأصحاح/الآيات
    const match = trimmed.match(/^(.+?)\s+(\d+.*)$/);
    if (!match) return null;

    return {
      bookNamePart: match[1].trim(),
      chapterPart: match[2].trim()
    };
  }, []);

  const loadLocalData = useCallback(async () => {
    try {
      const localChapters = await StorageService.get(KEYS.COMPLETED_CHAPTERS) || {};
      setCompletedChapters(localChapters);

      const localCompletedPlans = await StorageService.get(KEYS.COMPLETED_PLANS) || await StorageService.get('local_completed_plans') || {};
      const localCustomPlans = await StorageService.get(KEYS.CUSTOM_PLANS) || await StorageService.get('local_custom_plans') || {};
      const localBadges = await StorageService.get(KEYS.LOCAL_BADGES) || await StorageService.get('local_badges') || [];
      const localStreak = await StorageService.get(KEYS.STREAK) || await StorageService.get('userStreak') || 0;

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
      } else if (planType === 'shared') {
          const savedShared = localCompletedPlans[planId];
          if (savedShared && savedShared.readings) {
              setPlan(savedShared);
              setCompletedDays(savedShared.completedDays || {});
          } else {
              const cachedPlan = await getSharedPlanFromCache(planId);
              if (cachedPlan) {
                  setPlan(cachedPlan);
                  setCompletedDays({});
              } else {
                  const docRef = doc(db, 'sharedPlans', planId);
                  const snap = await getDoc(docRef);
                  if (snap.exists()) {
                      const data = snap.data();
                      setPlan({ ...data, id: planId, isShared: true });
                      setCompletedDays({});
                  }
              }
          }
      } else {
        const staticPlan = allPlans.find((p) => p.id === parseInt(planId));
        setPlan(staticPlan);
        const planData = localCompletedPlans[planId]?.completedDays || {};
        setCompletedDays(planData);
      }
    } catch (error) {
      console.error("Error loading local data:", error);
    } finally {
      setLoading(false);
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
      const localBadges = await StorageService.get(KEYS.LOCAL_BADGES) || await StorageService.get('local_badges') || [];
      if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save(KEYS.LOCAL_BADGES, localBadges);
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
    if (!planId) return;

    const auth = getAuth();
    let unsubSnap = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (loggedInUser) => {
      setUser(loggedInUser);
      
      if (loggedInUser) {
        const userRef = doc(db, 'users', loggedInUser.uid);
        unsubSnap = onSnapshot(userRef, async (docSnap) => {
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
            } else if (planType === 'shared') {
                const userCopy = data.completedPlans?.[planId];
                if (userCopy && userCopy.readings) {
                    setPlan(userCopy);
                    setCompletedDays(userCopy.completedDays || {});
                } else {
                    // محاولة الجلب من الكاش أولاً
                    const cachedPlan = await getSharedPlanFromCache(planId);
                    if (cachedPlan) {
                        setPlan(cachedPlan);
                        setCompletedDays({});
                    } else {
                        const docRef = doc(db, 'sharedPlans', planId);
                        const sharedSnap = await getDoc(docRef);
                        if (sharedSnap.exists()) {
                            const sharedData = sharedSnap.data();
                            setPlan({ ...sharedData, id: planId, isShared: true });
                            setCompletedDays({});
                        }
                    }
                }
            } else {
              const staticPlan = allPlans.find((p) => p.id === parseInt(planId));
              setPlan(staticPlan);
              const planData = data.completedPlans?.[planId]?.completedDays || {};
              setCompletedDays(planData);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore snapshot error:", error);
          setLoading(false);
        });
      } else {
        await loadLocalData();
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

  const isReadingDone = useCallback((readingStr) => {
    if (!bookNames.length || !completedChapters) return false;
    try {
      const parsed = parseReading(readingStr);
      if (!parsed) return false;

      const { bookNamePart, chapterPart } = parsed;

      const bookIndex = findBookIndexFlexibly(bookNamePart);
      if (bookIndex === -1) return false;

      let chaptersToNodes = [];
      const cleanChapters = chapterPart.split(/[:\s]/)[0]; // التعامل مع 1:1-5 ليصبح 1

      if (cleanChapters.includes('-')) {
        const [start, end] = cleanChapters.split('-').map(Number);
        for (let i = start; i <= end; i++) chaptersToNodes.push(i);
      } else if (cleanChapters.includes(',')) {
        chaptersToNodes = cleanChapters.split(',').map(c => Number(c.trim()));
      } else {
        chaptersToNodes.push(Number(cleanChapters));
      }
      return chaptersToNodes.every(c => completedChapters[`${bookIndex}-${c - 1}`]);
    } catch (e) { return false; }
  }, [bookNames, completedChapters, findBookIndexFlexibly, parseReading]);

  const isDayAutoCompleted = (reading) => {
    if (!reading.books || reading.books.length === 0) return false;
    return reading.books.every(b => isReadingDone(b));
  };

  const handleCheck = async (day) => {
    if (!plan) return;
    const isCurrentlyManual = completedDays[day]?.isCompleted;
    let newCompletedDays = { ...completedDays };

    if (isCurrentlyManual) {
      delete newCompletedDays[day];
      toast.success(strings.studyPlans.details.undo_manual);
    } else {
      newCompletedDays[day] = { 
        isCompleted: true, 
        dateCompleted: getCairoIsoString()
      };
      toast.success(strings.studyPlans.details.done_manual);
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
        const existingData = updatedUserData.completedPlans[planId] || {};
        updatedUserData.completedPlans[planId] = {
            ...existingData,
            completedDays: newCompletedDays,
            completionPercentage: percentage,
            id: planId,
            title: plan.title,
            type: plan.type || (planType === 'shared' ? 'shared' : 'static'),
            isShared: plan.isShared || planType === 'shared'
        };

        if (planType === 'shared' || plan.isShared) {
            updatedUserData.completedPlans[planId].readings = plan.readings;
            if (plan.description) updatedUserData.completedPlans[planId].description = plan.description;
            if (plan.authorName) updatedUserData.completedPlans[planId].authorName = plan.authorName;
        }
    }

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const fieldPath = planType === 'custom' ? `customPlans.${planId}` : `completedPlans.${planId}`;

        const updatePayload = {
          [`${fieldPath}.completedDays`]: newCompletedDays,
          [`${fieldPath}.completionPercentage`]: percentage,
          [`${fieldPath}.id`]: planId,
          [`${fieldPath}.title`]: plan.title,
          [`${fieldPath}.type`]: plan.type || (planType === 'shared' ? 'shared' : 'static'),
          [`${fieldPath}.isShared`]: plan.isShared || planType === 'shared'
        };

        if (planType === 'shared' || plan.isShared) {
            updatePayload[`${fieldPath}.readings`] = plan.readings;
            if (plan.description) updatePayload[`${fieldPath}.description`] = plan.description;
            if (plan.authorName) updatePayload[`${fieldPath}.authorName`] = plan.authorName;
            if (plan.createdAt) updatePayload[`${fieldPath}.createdAt`] = plan.createdAt;
        }

        await updateDoc(userRef, updatePayload);
        checkAndUnlockBadges(updatedUserData);
      } catch (e) {
        console.error(e);
        toast.error(strings.studyPlans.details.sync_error);
      }
    } else {
      if (planType === 'custom') {
        const localCustom = await StorageService.get(KEYS.CUSTOM_PLANS) || {};
        localCustom[planId] = updatedUserData.customPlans[planId];
        await StorageService.save(KEYS.CUSTOM_PLANS, localCustom);
      } else {
        const localCompletion = await StorageService.get(KEYS.COMPLETED_PLANS) || {};
        localCompletion[planId] = updatedUserData.completedPlans[planId];
        await StorageService.save(KEYS.COMPLETED_PLANS, localCompletion);
      }
      setUserData(updatedUserData);
      checkAndUnlockBadges(updatedUserData);
    }
  };

  if (loading) return <div className={styles.container}>{strings.studyPlans.details.loading}</div>;
  if (!plan) return <div className={styles.container}>{strings.studyPlans.details.not_found}</div>;

  const progressPercentage = Math.round(
    (plan.readings.filter(r => (completedDays[r.day]?.isCompleted || isDayAutoCompleted(r))).length / plan.readings.length) * 100
  );

  return (
    <div className={styles.container} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className={styles.title}>{plan.title}</h1>
      {plan.description && (
        <div className={styles.descriptionWrapper}>
          <p className={styles.description}>{plan.description}</p>
        </div>
      )}

      {(plan.isShared || planType === 'shared') && plan.authorName && (
          <div className={styles.authorSection}>
              {strings.studyPlans.details.by_author.replace('{name}', plan.authorName)}
          </div>
      )}

      <div className={styles.progressWrapper}>
        <div className={styles.progressInfo}>
          <span>{strings.studyPlans.details.progress_label}</span>
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
                <div className={styles.dayLabel}>{strings.studyPlans.details.day_label.replace('{day}', reading.day)}</div>
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
                  const parsed = parseReading(b);

                  let bookName = "Genesis";
                  let chapterNum = "1";
                  let displayLabel = b;

                  if (parsed) {
                    const { bookNamePart, chapterPart } = parsed;
                    chapterNum = chapterPart.split(/[:\s\-]/)[0]; // استخراج رقم الأصحاح الأول فقط

                    const foundIdx = findBookIndexFlexibly(bookNamePart);
                    if (foundIdx !== -1) {
                        bookName = bookNames[foundIdx].name;
                    } else {
                        bookName = bookNamePart;
                    }
                  }

                  return (
                    <Link
                      key={i}
                      href={`/bible?book=${encodeURIComponent(bookName)}&chapter=${chapterNum}&planId=${planId}&planType=${planType}&day=${reading.day}`}
                      className={`${styles.bookLink} ${isDone ? styles.bookDone : ''}`}
                    >
                      {displayLabel} {isDone && '✓'}
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
  const { strings } = useLanguage();
  return (
    <Suspense fallback={<div className={styles.container}>{strings.common.loading}</div>}>
      <PlanDetailsContent />
    </Suspense>
  );
}
