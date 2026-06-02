'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import styles from './studyPlans.module.css';
import studyPlansData from './studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, deleteField, arrayUnion } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {Sparkles } from 'lucide-react';
import { useBadge } from '../context/BadgeContext';
import { StorageService, KEYS } from '../../lib/storage';

const staticPlans = studyPlansData.plans;
const filtersList = ['الكل', 'مخصصة', ...new Set(staticPlans.map(plan => plan.type))];

export default function StudyPlans() {
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [completionData, setCompletionData] = useState({});
  const [customPlans, setCustomPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const filterRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const unlockBadge = async (badgeId, currentBadges) => {
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
  };

  const checkPlanBadges = (userData) => {
    const currentBadges = userData.badges || [];
    const allPlans = { ...(userData.completedPlans || {}), ...(userData.customPlans || {}) };

    let totalPlanDays = 0;
    let finishedCount = 0;
    let startedCount = 0;

    Object.values(allPlans).forEach(plan => {
      const doneDays = Object.values(plan.completedDays || {}).filter(d => d.isCompleted).length;
      totalPlanDays += doneDays;
      if (doneDays > 0) startedCount++;
      if (plan.completionPercentage === 100) finishedCount++;
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

    if (startedCount >= 1) unlockBadge('plan_start_1', currentBadges);
    if (finishedCount >= 1) unlockBadge('plan_finish_1', currentBadges);
    if (finishedCount >= 3) unlockBadge('plan_finish_3', currentBadges);
    if (finishedCount >= 5) unlockBadge('plan_finish_5', currentBadges);
    if (finishedCount >= 10) unlockBadge('plan_finish_10', currentBadges);
    if (finishedCount >= 20) unlockBadge('plan_finish_20', currentBadges);
  };

  useEffect(() => {
    const auth = getAuth();
    let unsubFirestore = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (loggedInUser) => {
      setUser(loggedInUser);
      if (loggedInUser) {
        const userRef = doc(db, 'users', loggedInUser.uid);
        unsubFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCompletionData(data.completedPlans || {});
            setCustomPlans(data.customPlans || {});
            checkPlanBadges(data);
          }
          setLoading(false);
        }, () => setLoading(false));
      } else {
        // تحميل البيانات المحلية للضيف
        const localCompletion = await StorageService.get('local_completed_plans') || {};
        const localCustom = await StorageService.get('local_custom_plans') || {};
        const localBadges = await StorageService.get('local_badges') || [];
        setCompletionData(localCompletion);
        setCustomPlans(localCustom);
        checkPlanBadges({ completedPlans: localCompletion, customPlans: localCustom, badges: localBadges });
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubFirestore();
    };
  }, []);

  const checkScroll = () => {
    if (filterRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = filterRef.current;
      const canScrollFurther = Math.abs(scrollLeft) < (scrollWidth - clientWidth - 15);
      setShowScrollHint(canScrollFurther);
    }
  };

  useEffect(() => {
    const el = filterRef.current;
    if (el && !loading) {
      const timer = setTimeout(checkScroll, 500);
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        clearTimeout(timer);
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [loading]);

  const handleScrollClick = () => {
    if (filterRef.current) {
      filterRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleDeletePlan = async (e, planId) => {
    e.preventDefault();
    e.stopPropagation();

    toast((t) => (
      <div style={{ direction: 'rtl', textAlign: 'center' }}>
        <p style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '1.1rem' }}>
          هل تريد حذف هذه الخطة نهائياً؟
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              if (user) {
                const userRef = doc(db, "users", user.uid);
                await updateDoc(userRef, { [`customPlans.${planId}`]: deleteField() });
              } else {
                const localCustom = await StorageService.get('local_custom_plans') || {};
                delete localCustom[planId];
                await StorageService.save('local_custom_plans', localCustom);
                setCustomPlans(localCustom);
              }
              toast.success("تم الحذف بنجاح");
            }}
            style={{ 
              background: '#ef4444', color: '#fff', border: 'none', 
              padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '1rem'
            }}
          >
            تأكيد
          </button>
          <button onClick={() => toast.dismiss(t.id)} style={{ background: 'var(--color-bg-end)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontSize: '1rem' }}>
            تراجع
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center', style: { background: 'var(--color-card-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '20px', minWidth: '300px' } });
  };

  const allAvailablePlans = useMemo(() => {
    const customPlansArray = Object.values(customPlans)
      .map(plan => ({ ...plan, isCustom: true }))
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
    return [...customPlansArray, ...staticPlans];
  }, [customPlans]);

  const filteredPlans = allAvailablePlans.filter(plan => 
    activeFilter === 'الكل' ? true : (plan.isCustom ? activeFilter === 'مخصصة' : plan.type === activeFilter)
  );

  if (loading) return <div className={styles.container}><div className={styles.loading}>جاري التحميل...</div></div>;

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.title}>خطط القراءة</h1>
        <Link href="/studyPlans/custom" className={styles.aiCreateButton}>
          <Sparkles size={18} /> صمم خطة ذكية الآن
        </Link>
      </div>

      <div className={styles.filterWrapper}>
        <div className={styles.filterSection} ref={filterRef}>
          {filtersList.map(filter => (
            <button key={filter} className={`${styles.filterButton} ${activeFilter === filter ? styles.activeFilter : ''}`} onClick={() => setActiveFilter(filter)}>
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.plansGrid}>
        {filteredPlans.length > 0 ? (
          filteredPlans.map(plan => {
            const progress = plan.isCustom 
              ? { percent: plan.completionPercentage || 0, done: Object.values(plan.completedDays || {}).filter(d => d.isCompleted).length }
              : { percent: completionData[plan.id]?.completionPercentage || 0, done: Object.values(completionData[plan.id]?.completedDays || {}).filter(d => d.isCompleted).length };

            const hasStarted = progress.done > 0;
            const planUrl = plan.isCustom ? `/studyPlans/details?id=${plan.id}&type=custom` : `/studyPlans/details?id=${plan.id}`;

            return (
              <div key={plan.id} className={`${styles.card} ${plan.isCustom ? styles.customCard : ''}`}>
                {plan.isCustom && <button className={styles.deleteBtn} onClick={(e) => handleDeletePlan(e, plan.id)}>✕</button>}
                <div className={styles.cardContent}>
                  {plan.isCustom && <span className={styles.aiBadge}><Sparkles size={14} /> مساعد آجيوس الذكي</span>}
                  <h3 className={styles.cardTitle}>{plan.title}</h3>
                  <p className={styles.cardType}>{plan.isCustom ? 'خطة شخصية' : plan.type}</p>
                  {hasStarted && <div className={styles.progressContainer}><div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progress.percent}%` }}></div></div><span className={styles.percentageText}>{progress.percent}% مكتمل</span></div>}
                  <Link href={planUrl} className={styles.cardButton}>{hasStarted ? 'متابعة' : 'ابدأ الآن'}</Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}><h3>لا توجد خطط حالياً</h3></div>
        )}
      </div>
    </div>
  );
}
