// src/app/studyPlans/[planId]/page.jsx

'use client'; 

import React, { useState, useEffect, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './PlanDetails.module.css';
import studyPlansData from '../studyPlansData.json';

const allPlans = studyPlansData.plans;

export default function PlanDetailsPage() {
  const params = useParams();
  const { planId } = params;
  const readingsListRef = useRef(null);

  const plan = allPlans.find((p) => p.id === parseInt(planId));

  if (!plan) {
    notFound();
  }

  const [completedDays, setCompletedDays] = useState({});
  const [goToDay, setGoToDay] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompletedDays = localStorage.getItem(`completedDays_${planId}`);
      if (storedCompletedDays) {
        setCompletedDays(JSON.parse(storedCompletedDays));
      }
    }
  }, [planId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(completedDays).length > 0) {
      localStorage.setItem(`completedDays_${planId}`, JSON.stringify(completedDays));
    }
  }, [completedDays, planId]);

  const handleCheck = (day) => {
    if (day > 1 && !completedDays[day - 1] && !completedDays[day]) {
      return;
    }

    setCompletedDays((prevCompletedDays) => {
      const newCompletedDays = {
        ...prevCompletedDays,
        [day]: !prevCompletedDays[day],
      };
      
      if (!newCompletedDays[day]) {
        for (let i = day + 1; i <= plan.readings.length; i++) {
          newCompletedDays[i] = false;
        }
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
  const daysCompletedCount = Object.values(completedDays).filter(Boolean).length;
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
            const isCompleted = completedDays[reading.day];
            const canCheck = reading.day === 1 || completedDays[reading.day - 1];

            return (
              <li 
                key={reading.day} 
                data-day={reading.day}
                className={`${styles.readingItem} ${isCompleted ? styles.completedDay : ''} ${!canCheck && !isCompleted ? styles.disabledDay : ''}`}
              >
                <div className={styles.readingHeader}>
                  <div className={styles.dayNumber}>يوم {reading.day}</div>
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