'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import styles from './studyPlans.module.css';
import studyPlansData from './studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronLeft, Sparkles } from 'lucide-react';

const staticPlans = studyPlansData.plans;
// نقل التعريف للخارج لتجنب ReferenceError وضمان التوفر في كل مكان
const filtersList = ['الكل', 'مخصصة', ...new Set(staticPlans.map(plan => plan.type))];

export default function StudyPlans() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [completionData, setCompletionData] = useState({});
  const [customPlans, setCustomPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const filterRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

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
            const serverCompletion = data.completedPlans || {};
            setCompletionData(serverCompletion);
            setCustomPlans(data.customPlans || {});

            Object.keys(serverCompletion).forEach(planId => {
              const planProgress = serverCompletion[planId];
              if (planProgress.completedDays) {
                const simpleProgress = {};
                Object.keys(planProgress.completedDays).forEach(day => {
                  simpleProgress[day] = planProgress.completedDays[day].isCompleted;
                });
                localStorage.setItem(`completedDays_${planId}`, JSON.stringify(simpleProgress));
              }
            });
            window.dispatchEvent(new Event('storage'));
          }
          setLoading(false);
        }, () => {
          setLoading(false);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubFirestore();
    };
  }, [router]);

  const checkScroll = () => {
    if (filterRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = filterRef.current;
      // في نظام RTL: التمرير يبدأ من 0 ويتجه للسالب.
      // نتحقق مما إذا كان هناك محتوى متبقي جهة اليسار
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
      // تحريك القائمة بمقدار 200 بكسل لليسار عند الضغط
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
              try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                  [`customPlans.${planId}`]: deleteField()
                });
                localStorage.removeItem(`completedDays_${planId}`);
                window.dispatchEvent(new Event('storage'));
                toast.success("تم الحذف بنجاح");
              } catch (error) {
                toast.error("حدث خطأ أثناء الحذف");
              }
            }}
            style={{ 
              background: '#ef4444', color: '#fff', border: 'none', 
              padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '1rem'
            }}
          >
            تأكيد
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)}
            style={{ 
              background: 'var(--color-bg-end)', color: 'var(--color-text-primary)', 
              border: '1px solid var(--color-border)', 
              padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            تراجع
          </button>
        </div>
      </div>
    ), { 
      duration: 6000, 
      position: 'top-center',
      style: {
        background: 'var(--color-card-bg)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)',
        backdropFilter: 'blur(15px)',
        borderRadius: '20px',
        minWidth: '300px',
        boxShadow: '0 20px 40px var(--color-shadow-medium)'
      }
    });
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

  if (loading) return (
    <div className={styles.container}>
      <div className={styles.loading}>جاري التحميل...</div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.title}>خطط القراءة</h1>
        <Link href="/studyPlans/custom" className={styles.aiCreateButton}>
          <Sparkles size={18} /> صمم خطة ذكية الآن
        </Link>
      </div>

      <div className={styles.filterWrapper}>
        <div
          className={styles.filterSection}
          ref={filterRef}
        >
          {filtersList.map(filter => (
            <button
              key={filter}
              className={`${styles.filterButton} ${activeFilter === filter ? styles.activeFilter : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        {showScrollHint && (
          <button
            className={styles.scrollHint}
            onClick={handleScrollClick}
            type="button"
            aria-label="عرض المزيد من الأقسام"
          >
            <ChevronLeft size={22} />
          </button>
        )}
      </div>

      <div className={styles.plansGrid}>
        {filteredPlans.length > 0 ? (
          filteredPlans.map(plan => {
            const progress = plan.isCustom 
              ? { 
                  percent: plan.completionPercentage || 0, 
                  done: Object.values(plan.completedDays || {}).filter(d => d.isCompleted).length 
                }
              : { 
                  percent: completionData[plan.id]?.completionPercentage || 0, 
                  done: Object.values(completionData[plan.id]?.completedDays || {}).filter(d => d.isCompleted).length 
                };

            const hasStarted = progress.done > 0;

            const planUrl = plan.isCustom
              ? `/studyPlans/details?id=${plan.id}&type=custom`
              : `/studyPlans/details?id=${plan.id}`;

            return (
              <div key={plan.id} className={`${styles.card} ${plan.isCustom ? styles.customCard : ''}`}>
                {plan.isCustom && (
                  <button 
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeletePlan(e, plan.id)}
                    type="button"
                  >
                    ✕
                  </button>
                )}
                
                <div className={styles.cardContent}>
                  {plan.isCustom && <span className={styles.aiBadge}><Sparkles size={14} /> مساعد آجيوس الذكي</span>}
                  <h3 className={styles.cardTitle}>{plan.title}</h3>
                  <p className={styles.cardType}>{plan.isCustom ? 'خطة شخصية' : plan.type}</p>
                  
                  {hasStarted && (
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${progress.percent}%` }}></div>
                      </div>
                      <span className={styles.percentageText}>{progress.percent}% مكتمل</span>
                    </div>
                  )}

                  <Link 
                    href={planUrl} 
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
            <h3>لا توجد خطط حالياً</h3>
          </div>
        )}
      </div>
    </div>
  );
}
