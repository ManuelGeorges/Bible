'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from '../../../lib/firebase';
import toast, { Toaster } from 'react-hot-toast';

const allPlans = studyPlansData.plans;

function PlanDetailsContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('id');
  const planType = searchParams.get('type');
  
  const readingsListRef = useRef(null);
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState(null);
  const [completedDays, setCompletedDays] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return;

    const auth = getAuth();
    let unsubSnap = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (loggedInUser) => {
      setUser(loggedInUser);
      
      if (planType === 'custom') {
        if (loggedInUser) {
          const userRef = doc(db, 'users', loggedInUser.uid);
          unsubSnap = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data();
              const aiPlan = userData.customPlans?.[planId];
              if (aiPlan) {
                setPlan(aiPlan);
                setCompletedDays(aiPlan.completedDays || {});
              }
            }
            setLoading(false);
          });
        }
      } else {
        const staticPlan = allPlans.find((p) => p.id === parseInt(planId));
        setPlan(staticPlan);
        
        if (loggedInUser) {
          const userRef = doc(db, 'users', loggedInUser.uid);
          unsubSnap = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data().completedPlans?.[planId]?.completedDays || {};
              setCompletedDays(data);
            }
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubSnap();
    };
  }, [planId, planType]);

  const handleCheck = async (day) => {
    if (!user) {
      toast.error("يرجى تسجيل الدخول لحفظ تقدمك");
      return;
    }

    const isCurrentlyCompleted = completedDays[day]?.isCompleted;
    let newCompletedDays = { ...completedDays };

    if (isCurrentlyCompleted) {
      Object.keys(newCompletedDays).forEach(key => {
        if (parseInt(key) >= day) delete newCompletedDays[key];
      });
      toast.success("تم تحديث التقدم");
    } else {
      newCompletedDays[day] = { 
        isCompleted: true, 
        dateCompleted: new Date().toISOString() 
      };
      
      if (day === plan.readings.length) {
        toast.success("تهانينا! لقد أتممت الخطة بنجاح 🎉", { duration: 5000 });
      }
    }

    const totalDays = plan.readings.length;
    const daysDone = Object.values(newCompletedDays).filter(d => d.isCompleted).length;
    const percentage = Math.round((daysDone / totalDays) * 100);

    setCompletedDays(newCompletedDays);

    try {
      const userRef = doc(db, 'users', user.uid);
      const fieldPath = planType === 'custom' 
        ? `customPlans.${planId}` 
        : `completedPlans.${planId}`;

      await updateDoc(userRef, {
        [`${fieldPath}.completedDays`]: newCompletedDays,
        [`${fieldPath}.completionPercentage`]: percentage
      });
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء مزامنة البيانات");
    }
  };

  if (loading) return <div className={styles.container}>جاري تحميل خطتك...</div>;
  if (!plan) return notFound();

  const progressPercentage = Math.round(
    (Object.values(completedDays).filter(d => d.isCompleted).length / plan.readings.length) * 100
  );

  return (
    <div className={styles.container}>
      <Toaster position="top-center" />
      <h1 className={styles.title}>{plan.title}</h1>
      
      <div className={styles.progressWrapper}>
        <div className={styles.progressInfo}>
          <span>نسبة الإنجاز</span>
          <span>%{progressPercentage}</span>
        </div>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ 
              width: `${progressPercentage}%`,
              backgroundColor: progressPercentage === 100 ? '#4CAF50' : ''
            }}
          ></div>
        </div>
      </div>

      <ul className={styles.readingsList} ref={readingsListRef}>
        {plan.readings.map((reading) => {
          const isCompleted = completedDays[reading.day]?.isCompleted;
          const canCheck = reading.day === 1 || completedDays[reading.day - 1]?.isCompleted;
          
          return (
            <li key={reading.day} className={`${styles.readingItem} ${isCompleted ? styles.completed : ''}`}>
              <div className={styles.dayHeader}>
                <div className={styles.dayLabel}>اليوم {reading.day}</div>
                <div className={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    id={`day-${reading.day}`}
                    checked={isCompleted || false}
                    disabled={!canCheck && !isCompleted}
                    onChange={() => handleCheck(reading.day)}
                  />
                  <label htmlFor={`day-${reading.day}`}></label>
                </div>
              </div>
              <div className={styles.booksGrid}>
                {reading.books.map((b, i) => {
                  const parts = b.trim().split(' ');
                  const chapterNum = parts.pop();
                  const bookName = parts.join(' ');
                  
                  return (
                    <Link 
                      key={i} 
                      href={`/bible?book=${encodeURIComponent(bookName)}&chapter=${chapterNum}`}
                      className={styles.bookLink}
                    >
                      {b}
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