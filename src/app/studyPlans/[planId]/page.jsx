// src/app/studyPlans/[planId]/page.jsx

'use client'; 

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '/lib/firebase';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;

const allPlans = studyPlansData.plans;

export default function PlanDetailsPage() {
  const params = useParams();
  const { planId } = params;
  const readingsListRef = useRef(null);
  const [user, setUser] = useState(null);

  const plan = allPlans.find((p) => p.id === parseInt(planId));

  if (!plan) {
    notFound();
  }

  const [completedDays, setCompletedDays] = useState({});
  const [goToDay, setGoToDay] = useState('');

  const saveProgressToFirestore = useCallback(async (loggedInUser, currentPlanId, updatedCompletedDays) => {
    if (!loggedInUser || !firestore) return;
    try {
      const daysCompletedCount = Object.keys(updatedCompletedDays).filter(day => updatedCompletedDays[day].isCompleted).length;
      const totalDays = plan.readings.length;
      const completionPercentage = totalDays > 0 ? Math.round((daysCompletedCount / totalDays) * 100) : 0;
      
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      await setDoc(userRef, {
        completedPlans: {
          [currentPlanId]: {
            completedDays: updatedCompletedDays,
            completionPercentage: completionPercentage
          }
        }
      }, { merge: true });
      console.log("Progress saved to Firestore successfully!");
    } catch (error) {
      console.error("Error saving progress to Firestore:", error);
    }
  }, [plan]);

  const fetchCompletedDaysFromFirestore = useCallback(async (loggedInUser) => {
    if (!loggedInUser || !firestore) return;

    try {
      const userRef = doc(firestore, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().completedPlans?.[planId]) {
        const firestoreData = userSnap.data().completedPlans[planId].completedDays;
        setCompletedDays(firestoreData || {});
      } else {
        setCompletedDays({});
      }
    } catch (error) {
      console.error("Error fetching completed days from Firestore:", error);
    }
  }, [planId]);

  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((loggedInUser) => {
        setUser(loggedInUser);
        if (loggedInUser) {
          fetchCompletedDaysFromFirestore(loggedInUser);
        }
      });
      return () => unsubscribe();
    }
  }, [fetchCompletedDaysFromFirestore]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !user) {
      const storedCompletedDays = localStorage.getItem(`completedDays_${planId}`);
      if (storedCompletedDays) {
        setCompletedDays(JSON.parse(storedCompletedDays));
      }
    }
  }, [planId, user]);

  const handleCheck = (day) => {
    const isCompleted = completedDays[day]?.isCompleted;
    if (day > 1 && !completedDays[day - 1]?.isCompleted && !isCompleted) {
      return;
    }

    setCompletedDays((prevCompletedDays) => {
      const newCompletedDays = {
        ...prevCompletedDays,
        [day]: isCompleted 
          ? { isCompleted: false, dateCompleted: null }
          : { isCompleted: true, dateCompleted: new Date().toLocaleDateString('en-CA') }, // 'en-CA' for YYYY-MM-DD
      };
      
      if (isCompleted) { // If unchecking
        for (let i = day + 1; i <= plan.readings.length; i++) {
          newCompletedDays[i] = { isCompleted: false, dateCompleted: null };
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`completedDays_${planId}`, JSON.stringify(newCompletedDays));
      }
      if (user) {
        saveProgressToFirestore(user, planId, newCompletedDays);
      }
      return newCompletedDays;
    });
  };

  const handleGoToDayChange = (e) => {
    setGoToDay(e.target.value);
  };

  const handleGoToDaySubmit = (e) => {
    e.preventDefault();
    const day = parseInt(goToDay, 10);
    if (day > 0 && day <= plan.readings.length) {
      const dayElement = readingsListRef.current.querySelector(`[data-day="${day}"]`);
      if (dayElement) {
        dayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dayElement.classList.add(styles.highlight);
        setTimeout(() => {
          dayElement.classList.remove(styles.highlight);
        }, 2000);
      }
    }
  };

  const totalDays = plan.readings.length;
  const daysCompletedCount = Object.keys(completedDays).filter(day => completedDays[day]?.isCompleted).length;
  const completionPercentage = totalDays > 0 ? Math.round((daysCompletedCount / totalDays) * 100) : 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{plan.title}</h1>
        <p className={styles.description}>{plan.description}</p>
      </header>
      
      <div className={styles.details}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>المدة:</span>
          <span className={styles.detailValue}>{plan.duration}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>النوع:</span>
          <span className={styles.detailValue}>{plan.type}</span>
        </div>
      </div>

      <div className={styles.goToDayContainer}>
        <form onSubmit={handleGoToDaySubmit}>
          <input
            type="number"
            value={goToDay}
            onChange={handleGoToDayChange}
            placeholder="اذهب إلى يوم..."
            className={styles.goToDayInput}
            min="1"
            max={plan.readings.length}
          />
          <button type="submit" className={styles.goToDayButton}>اذهب</button>
        </form>
      </div>

      <div className={styles.completionSummary}>
        <div className={styles.completionText}>
          <span className={styles.completedCount}>{daysCompletedCount}</span> / {totalDays} يوم
        </div>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
        <div className={styles.percentageText}>{completionPercentage}%</div>
      </div>

      <main className={styles.mainContent}>
        <h2 className={styles.readingsTitle}>قراءات الخطة</h2>
        <ul className={styles.readingsList} ref={readingsListRef}>
          {plan.readings.map((reading) => {
            const isCompleted = completedDays[reading.day]?.isCompleted;
            const dateCompleted = completedDays[reading.day]?.dateCompleted;
            const canCheck = reading.day === 1 || completedDays[reading.day - 1]?.isCompleted;

            return (
              <li 
                key={reading.day} 
                data-day={reading.day}
                className={`${styles.readingItem} ${isCompleted ? styles.completedDay : ''} ${!canCheck && !isCompleted ? styles.disabledDay : ''}`}
              >
                <div className={styles.readingHeader}>
                  <div className={styles.dayNumber}>
                    يوم {reading.day} {dateCompleted && <span> - {dateCompleted}</span>}
                  </div>
                  <input
                    type="checkbox"
                    checked={isCompleted || false}
                    onChange={() => handleCheck(reading.day)}
                    className={styles.completionCheckbox}
                    disabled={!canCheck && !isCompleted}
                  />
                </div>
                <div className={styles.books}>
                  {reading.books.map((book, index) => {
                    const parts = book.split(/\s*(\d+)/).filter(Boolean);
                    const bookName = parts[0] ? parts[0].trim() : '';
                    const chapter = parts[1] ? parts[1].trim() : '';
                    
                    return (
                      <Link 
                        key={index} 
                        href={chapter ? `/bible?book=${encodeURIComponent(bookName)}&chapter=${encodeURIComponent(chapter)}` : `/bible?book=${encodeURIComponent(bookName)}`}
                        className={styles.book}
                      >
                        {book}
                      </Link>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}