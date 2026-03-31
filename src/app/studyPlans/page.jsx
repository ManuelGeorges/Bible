'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import styles from './studyPlans.module.css';
import studyPlansData from './studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const staticPlans = studyPlansData.plans;

export default function StudyPlans() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [completionData, setCompletionData] = useState({});
  const [customPlans, setCustomPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    let unsubFirestore = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (loggedInUser) => {
      if (!loggedInUser) {
        router.replace('/intro');
      } else {
        setUser(loggedInUser);
        const userRef = doc(db, 'users', loggedInUser.uid);
        unsubFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCompletionData(data.completedPlans || {});
            setCustomPlans(data.customPlans || {});
          }
          setLoading(false);
        }, (error) => {
          setLoading(false);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubFirestore();
    };
  }, [router]);

  const handleDeletePlan = async (e, planId) => {
    e.preventDefault();
    e.stopPropagation();

    toast((t) => (
      <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>هل تريد حذف هذه الخطة نهائياً؟</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                  [`customPlans.${planId}`]: deleteField()
                });
                toast.success("تم الحذف بنجاح");
              } catch (error) {
                toast.error("حدث خطأ أثناء الحذف");
              }
            }}
            style={{ 
              background: '#ff4d4d', color: '#fff', border: 'none', 
              padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 'bold', flex: 1 , marginTop: 'calc(env(safe-area-inset-top) + 10px)',
            }}
          >
            تأكيد
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)}
            style={{ 
              background: 'rgba(255,255,255,0.1)', color: 'inherit', 
              border: '1px solid var(--color-border)', padding: '6px 12px', 
              borderRadius: '8px', cursor: 'pointer', flex: 1 
            }}
          >
            تراجع
          </button>
        </div>
      </div>
    ), { duration: 5000 });
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

  const filters = ['الكل', 'مخصصة', ...new Set(staticPlans.map(plan => plan.type))];

  if (loading) return (
    <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>جاري التحميل...</p>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.title}>خطط القراءة</h1>
        <Link href="/studyPlans/custom" className={styles.aiCreateButton}>
          ✨ صمم خطة ذكية الآن
        </Link>
      </div>

      <div className={styles.filterSection}>
        {filters.map(filter => (
          <button
            key={filter}
            className={`${styles.filterButton} ${activeFilter === filter ? styles.activeFilter : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className={styles.plansGrid}>
        {filteredPlans.length > 0 ? (
          filteredPlans.map(plan => {
            const progress = plan.isCustom 
              ? { percent: plan.completionPercentage || 0, done: Object.values(plan.completedDays || {}).filter(d => d.isCompleted).length }
              : { percent: completionData[plan.id]?.completionPercentage || 0, done: Object.values(completionData[plan.id]?.completedDays || {}).filter(d => d.isCompleted).length };

            const hasStarted = progress.done > 0;

            return (
              <div key={plan.id} className={`${styles.card} ${plan.isCustom ? styles.customCard : ''}`}>
                {plan.isCustom && (
                  <button 
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeletePlan(e, plan.id)}
                    type="button"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                )}
                
                <div className={styles.cardContent}>
                  {plan.isCustom && <span className={styles.aiBadge}> مساعد آجيوس الذكي✨</span>}
                  <h3 className={styles.cardTitle}>{plan.title}</h3>
                  <p className={styles.cardType}>{plan.isCustom ? 'خطة شخصية' : plan.type}</p>
                  
                  {hasStarted && (
                    <div className={styles.completionStatus}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${progress.percent}%` }}></div>
                      </div>
                      <span className={styles.percentageText}>{progress.percent}% مكتمل</span>
                    </div>
                  )}

                  <Link 
                    href={`/studyPlans/details?id=${plan.id}${plan.isCustom ? '&type=custom' : ''}`} 
                    className={styles.cardButton}
                  >
                    {hasStarted ? 'متابعة' : 'ابدأ الآن'}
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <h3>لا توجد خطط</h3>
          </div>
        )}
      </div>
    </div>
  );
}