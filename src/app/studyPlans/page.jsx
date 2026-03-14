'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './studyPlans.module.css';
import studyPlansData from './studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';

const allPlans = studyPlansData.plans;

export default function StudyPlans() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [completionData, setCompletionData] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
      if (!loggedInUser) {
        router.push('/intro');
      } else {
        setUser(loggedInUser);
        const userRef = doc(db, 'users', loggedInUser.uid);
        const unsubFirestore = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setCompletionData(docSnap.data().completedPlans || {});
          }
          setLoading(false);
        });
        return () => unsubFirestore();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const filteredPlans = allPlans.filter(plan => 
    activeFilter === 'الكل' ? true : plan.type === activeFilter
  );

  const filters = ['الكل', ...new Set(allPlans.map(plan => plan.type))];

  if (loading) return <div style={{textAlign: 'center', padding: '50px'}}>جاري التحميل...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.title}>خطط قراءة الكتاب المقدس</h1>
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
        {filteredPlans.map(plan => {
          const planData = completionData[plan.id] || { completionPercentage: 0, completedDays: {} };
          const daysDone = Object.values(planData.completedDays || {}).filter(d => d.isCompleted).length;
          const hasStarted = daysDone > 0;
          return (
            <div key={plan.id} className={styles.card}>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{plan.title}</h3>
                {hasStarted && (
                  <div className={styles.completionStatus}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${planData.completionPercentage}%` }}></div>
                    </div>
                    <span>{planData.completionPercentage}%</span>
                  </div>
                )}
                <Link href={`/studyPlans/${plan.id}`} className={styles.cardButton}>
                  {hasStarted ? 'متابعة' : 'ابدأ الآن'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}