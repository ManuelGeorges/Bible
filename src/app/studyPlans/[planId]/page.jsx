'use client'; 

import React, { useState, useEffect, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from '../../../lib/firebase';

const allPlans = studyPlansData.plans;

export default function PlanDetailsPage() {
  const { planId } = useParams();
  const readingsListRef = useRef(null);
  const [user, setUser] = useState(null);
  const [completedDays, setCompletedDays] = useState({});
  const plan = allPlans.find((p) => p.id === parseInt(planId));

  if (!plan) notFound();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
      setUser(loggedInUser);
      if (loggedInUser) {
        const userRef = doc(db, 'users', loggedInUser.uid);
        const unsubSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data().completedPlans?.[planId]?.completedDays || {};
            setCompletedDays(data);
          }
        });
        return () => unsubSnap();
      }
    });
    return () => unsubscribe();
  }, [planId]);

  const handleCheck = async (day) => {
    if (!user) return;

    const isCurrentlyCompleted = completedDays[day]?.isCompleted;
    const newCompletedDays = { ...completedDays };

    if (isCurrentlyCompleted) {
      // إلغاء التعليم: نمسح اليوم وكل الأيام اللي بعده (منطق الخطة)
      for (let i = day; i <= plan.readings.length; i++) {
        delete newCompletedDays[i];
      }
    } else {
      // تعليم كـ مكتمل
      newCompletedDays[day] = { 
        isCompleted: true, 
        dateCompleted: new Date().toISOString() 
      };
    }

    const totalDays = plan.readings.length;
    const daysDone = Object.values(newCompletedDays).filter(d => d.isCompleted).length;
    const percentage = Math.round((daysDone / totalDays) * 100);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [`completedPlans.${planId}`]: {
          completedDays: newCompletedDays,
          completionPercentage: percentage
        }
      });
    } catch (e) {
      console.error("Error updating plan:", e);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{plan.title}</h1>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${Math.round((Object.values(completedDays).filter(d => d.isCompleted).length / plan.readings.length) * 100)}%` }}></div>
      </div>

      <ul className={styles.readingsList} ref={readingsListRef}>
        {plan.readings.map((reading) => {
          const isCompleted = completedDays[reading.day]?.isCompleted;
          const canCheck = reading.day === 1 || completedDays[reading.day - 1]?.isCompleted;

          return (
            <li key={reading.day} className={`${styles.readingItem} ${isCompleted ? styles.completed : ''}`}>
              <span>يوم {reading.day}</span>
              <input
                type="checkbox"
                checked={isCompleted || false}
                disabled={!canCheck && !isCompleted}
                onChange={() => handleCheck(reading.day)}
              />
              <div className={styles.books}>
                {reading.books.map((b, i) => <Link key={i} href={`/bible?query=${b}`}>{b}</Link>)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}