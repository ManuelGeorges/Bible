'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { allQuestions } from './questionsData';
import styles from './competitions.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../lib/firebase'; 
import { doc, getDoc, updateDoc, arrayUnion, increment, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useBadge } from '../context/BadgeContext';

const normalizeArabic = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ة]/g, 'ه')
    .replace(/[ء]/g, '')
    .replace(/\s+/g, ' ');
};

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const { triggerBadgeUnlock } = useBadge();

  const [quizState, setQuizState] = useState({
    category: null,
    currentIndex: 0,
    score: 0,
    answered: false,
    isCorrect: null,
    showResults: false,
    streak: 0,
    startTime: null,
  });

  const [questions, setQuestions] = useState([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [bookNamesData, setBookNamesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userBadges, setUserBadges] = useState([]);
  const [copiedMessage, setCopiedMessage] = useState('');
  const categoryRef = useRef(null);

  useEffect(() => {
    let unsubSnap = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/intro');
        setAuthLoading(false);
      } else {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        unsubSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCompletedQuizzes(data.completedQuizzes || []);
            setUserBadges(data.badges || []);
          }
          setAuthLoading(false);
        }, (error) => {
          console.error("Error in onSnapshot:", error);
          setAuthLoading(false);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubSnap) unsubSnap();
    };
  }, [router]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const res = await fetch('/data/bookNames.json');
        if (!res.ok) throw new Error('Failed to fetch book names');
        const data = await res.json();
        setBookNamesData((data.ar || []).map(b => ({ ...b, name: b.name.trim() })));
      } catch (e) {
        console.error("Error loading book names:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const unlockBadge = async (badgeId) => {
    if (!user || (userBadges && userBadges.includes(badgeId))) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        badges: arrayUnion(badgeId)
      });
      triggerBadgeUnlock(badgeId);
      setUserBadges(prev => [...prev, badgeId]);
    } catch (e) {
      console.error(e);
    }
  };

  const loadQuestionsByCategory = (categoryName) => {
    const cleanName = normalizeArabic(categoryName);
    let filtered = allQuestions.filter(q => {
      const qCat = normalizeArabic(q.category);
      return (qCat === cleanName || qCat.includes(cleanName) || cleanName.includes(qCat));
    });

    if (filtered.length === 0) {
      alert("عذراً، لا توجد أسئلة متوفرة حالياً لهذه الفئة.");
      return;
    }

    setQuestions(filtered);
    setQuizState({
      category: categoryName,
      currentIndex: 0,
      score: 0,
      answered: false,
      isCorrect: null,
      showResults: false,
      streak: 0,
      startTime: Date.now(),
    });
    setUserAnswer('');
  };

  const handleAnswer = async (answer) => {
    if (quizState.answered || questions.length === 0) return;
    const current = questions[quizState.currentIndex];
    const correct = normalizeArabic(answer) === normalizeArabic(current.correctAnswer);
    const newStreak = correct ? quizState.streak + 1 : 0;

    setQuizState(prev => ({
      ...prev,
      answered: true,
      isCorrect: correct,
      score: correct ? prev.score + 1 : prev.score,
      streak: newStreak
    }));

    if (newStreak === 10) await unlockBadge('rapid_10');
  };

  const nextQuestion = async () => {
    if (quizState.currentIndex + 1 < questions.length) {
      setQuizState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        answered: false,
        isCorrect: null,
      }));
      setUserAnswer('');
    } else {
      const finalScore = quizState.score;
      const totalQuestions = questions.length;
      const record = {
        category: quizState.category,
        score: finalScore,
        total: totalQuestions,
        date: new Date().toISOString()
      };
      setQuizState(prev => ({ ...prev, showResults: true }));
      await finalizeQuiz(record, finalScore === totalQuestions);
    }
  };

  const finalizeQuiz = async (record, isPerfect) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const updatedHistory = [record, ...completedQuizzes.filter(q => q.category !== record.category)];
    
    let pointsToAdd = 30; 
    let reason = `إكمال مسابقة: ${record.category}`;
    
    if (isPerfect) {
      pointsToAdd += 50;
      reason = `العلامة الكاملة: ${record.category}`;
    }

    try {
      await updateDoc(userRef, {
        completedQuizzes: updatedHistory,
        totalPoints: increment(pointsToAdd),
        pointsHistory: arrayUnion({
          type: 'quiz',
          points: pointsToAdd,
          reason: reason,
          timestamp: new Date().toISOString()
        })
      });

      if (updatedHistory.length >= 1) await unlockBadge('quiz_first');
      if (updatedHistory.length >= 3) await unlockBadge('scholar_3');
      if (updatedHistory.length >= 10) await unlockBadge('scholar_10');
      if (updatedHistory.length >= 30) await unlockBadge('scholar_30');
      if (updatedHistory.length >= 50) await unlockBadge('scholar_50');
      if (updatedHistory.length >= 73) await unlockBadge('bible_master');

      const perfectCount = updatedHistory.filter(q => q.score === q.total).length;
      if (isPerfect) await unlockBadge('perfect_1');
      if (perfectCount >= 10) await unlockBadge('perfect_10');
      if (perfectCount >= 73) await unlockBadge('perfect_all');

      const duration = (Date.now() - quizState.startTime) / 1000;
      if (isPerfect && duration < 30) {
        await unlockBadge('speed_demon');
      }

    } catch (e) {
      console.error(e);
    }
  };

  const resetQuiz = () => {
    setQuizState({ category: null, currentIndex: 0, score: 0, answered: false, isCorrect: null, showResults: false, streak: 0, startTime: null });
    setQuestions([]);
    setUserAnswer('');
  };

  if (authLoading || isLoading) return <div className={styles.loading}>جاري التحميل...</div>;

  return (
    <div dir="rtl" className={styles.mainContainer}>
      {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}
      
      <header className={styles.header}>
        <h1 className={styles.title}>مسابقات أجيوس</h1>
        {user && <p className={styles.userBadge}>أهلاً، {user.displayName || 'مستخدم أجيوس'}</p>}
      </header>

      {!quizState.category && (
        <div className={styles.controls}>
          <div className={styles.customSelectWrapper} ref={categoryRef}>
            <div className={styles.selectTrigger} onClick={() => setIsCategoryOpen(!isCategoryOpen)}>
              {quizState.category || "اختر سفراً للبدء"}
            </div>
            <AnimatePresence>
              {isCategoryOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={styles.dropdownMenu}
                >
                  {bookNamesData.map((book, i) => (
                    <li key={i} className={styles.dropdownItem} onClick={() => { loadQuestionsByCategory(book.name); setIsCategoryOpen(false); }}>
                      {book.name}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <main className={styles.quizContentWrapper}>
        {!quizState.category ? (
          <>
            <div className={styles.welcomeMessage}>
              <h2>تحدي أسفار الكتاب المقدس 📖</h2>
              <p>اختبر معلوماتك في كلمة الله واجمع النقاط والأوسمة</p>
            </div>

            {completedQuizzes.length > 0 && (
              <div className={styles.historyContainer}>
                <h3>سجل نتائجك ☁️</h3>
                {completedQuizzes.map((quiz, idx) => (
                  <div key={idx} className={styles.historyItem}>
                    <div className={styles.historyInfo}>
                      <span className={styles.historyCategory}>{quiz.category}</span>
                      <span className={styles.historyScore}>النتيجة: {quiz.score} / {quiz.total}</span>
                    </div>
                    <button className={styles.redoButton} onClick={() => loadQuestionsByCategory(quiz.category)}>إعادة</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : quizState.showResults ? (
          <div className={styles.resultsContainer}>
            <h2 className={styles.questionText}>النتائج النهائية 📊</h2>
            <div className={styles.mainScore}>{quizState.score} / {questions.length}</div>
            <button className={styles.playAgainButton} onClick={resetQuiz}>العودة للأسفار</button>
          </div>
        ) : (
          <div className={styles.quizActive}>
            <div className={styles.quizStats}>
              <span>السؤال {quizState.currentIndex + 1} من {questions.length}</span>
              <span>🔥 {quizState.streak} متتالي</span>
            </div>

            <div className={styles.questionCard}>
              <h3 className={styles.questionText}>{questions[quizState.currentIndex]?.questionText}</h3>
              <div className={styles.optionsContainer}>
                {questions[quizState.currentIndex]?.options.map((opt, i) => (
                  <button 
                    key={i} 
                    disabled={quizState.answered}
                    className={`${styles.optionButton} ${quizState.answered ? (normalizeArabic(opt) === normalizeArabic(questions[quizState.currentIndex].correctAnswer) ? styles.correctAnswer : (normalizeArabic(opt) === normalizeArabic(userAnswer) ? styles.incorrectAnswer : '')) : ''}`}
                    onClick={() => { setUserAnswer(opt); handleAnswer(opt); }}
                  >{opt}</button>
                ))}
              </div>
              
              {quizState.answered && (
                <div className={styles.feedbackContainer}>
                  <p className={quizState.isCorrect ? styles.correctFeedback : styles.incorrectFeedback}>
                    {quizState.isCorrect ? 'إجابة صحيحة ✅' : `الإجابة الصحيحة هي: ${questions[quizState.currentIndex].correctAnswer}`}
                  </p>
                </div>
              )}

              <div className={styles.quizActions}>
                {quizState.answered && <button onClick={nextQuestion} className={styles.nextButton}>السؤال التالي</button>}
                <button className={styles.cancelButton} onClick={resetQuiz}>إلغاء المسابقة</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}