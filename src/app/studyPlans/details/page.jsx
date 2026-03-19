'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from '../../../lib/firebase';

const allPlans = studyPlansData.plans;

function PlanDetailsContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('id');
  
  const readingsListRef = useRef(null);
  const [user, setUser] = useState(null);
  const [completedDays, setCompletedDays] = useState({});

  const plan = useMemo(() => {
    if (!planId) return null;
    return allPlans.find((p) => p.id === parseInt(planId));
  }, [planId]);

  useEffect(() => {
    if (!planId) return;

    const auth = getAuth();
    let unsubSnap = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (loggedInUser) => {
      setUser(loggedInUser);
      if (loggedInUser) {
        const userRef = doc(db, 'users', loggedInUser.uid);
        unsubSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data().completedPlans?.[planId]?.completedDays || {};
            setCompletedDays(data);
          }
        }, (err) => console.error(err));
      }
    });

    return () => {
      unsubscribeAuth();
      unsubSnap();
    };
  }, [planId]);

  if (!planId || !plan) return notFound();

  const handleCheck = async (day) => {
    if (!user) return;
    const isCurrentlyCompleted = completedDays[day]?.isCompleted;
    const newCompletedDays = { ...completedDays };

    if (isCurrentlyCompleted) {
      for (let i = day; i <= plan.readings.length; i++) {
        delete newCompletedDays[i];
      }
    } else {
      newCompletedDays[day] = { 
        isCompleted: true, 
        dateCompleted: new Date().toISOString() 
      };
    }

    const totalDays = plan.readings.length;
    const daysDone = Object.values(newCompletedDays).filter(d => d.isCompleted).length;
    const percentage = Math.round((daysDone / totalDays) * 100);

    setCompletedDays(newCompletedDays);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [`completedPlans.${planId}`]: {
          completedDays: newCompletedDays,
          completionPercentage: percentage
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const progressPercentage = Math.round(
    (Object.values(completedDays).filter(d => d.isCompleted).length / plan.readings.length) * 100
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{plan.title}</h1>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }}></div>
      </div>
      <ul className={styles.readingsList} ref={readingsListRef}>
        {plan.readings.map((reading) => {
          const isCompleted = completedDays[reading.day]?.isCompleted;
          const canCheck = reading.day === 1 || completedDays[reading.day - 1]?.isCompleted;
          return (
            <li key={reading.day} className={`${styles.readingItem} ${isCompleted ? styles.completed : ''}`}>
              <div className={styles.dayInfo}>
                <span>يوم {reading.day}</span>
                <input
                  type="checkbox"
                  checked={isCompleted || false}
                  disabled={!canCheck && !isCompleted}
                  onChange={() => handleCheck(reading.day)}
                />
              </div>
              <div className={styles.books}>
                {reading.books.map((b, i) => {
                  const parts = b.trim().split(' ');
                  const chapterNum = parts[parts.length - 1];
                  const bookName = parts.slice(0, parts.length - 1).join(' ');
                  
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
    <Suspense fallback={<div>Loading...</div>}>
      <PlanDetailsContent />
    </Suspense>
  );
}