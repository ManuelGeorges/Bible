'use client';

import { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { allQuestions } from './questionsData';
import styles from './competitions.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../lib/firebase'; 
import { doc, getDoc, updateDoc, arrayUnion, increment, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useBadge } from '../context/BadgeContext';
import { getCairoIsoString } from '../../lib/dateUtils';
import { StorageService, KEYS } from '../../lib/storage';
import { HapticService } from '../../lib/hapticsService';

// 1. تحسين الـ Normalize مع إضافة Cache للسرعة القصوى
const normalizationCache = new Map();
const normalizeArabic = (text) => {
  if (typeof text !== 'string') return '';
  if (normalizationCache.has(text)) return normalizationCache.get(text);

  const result = text
    .trim()
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[أإآ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ة]/g, 'ه')
    .replace(/[ء]/g, '')
    .replace(/\s+/g, ' ');

  normalizationCache.set(text, result);
  return result;
};

// 2. فهرسة الأسئلة مسبقاً (Pre-indexing) خارج الـ Component لمنع تكرار العملية
const INDEXED_QUESTIONS = new Map();
allQuestions.forEach(q => {
  const normCat = normalizeArabic(q.category);
  if (!INDEXED_QUESTIONS.has(normCat)) INDEXED_QUESTIONS.set(normCat, []);

  // حفظ الإجابات مخزنة بصيغة Normalized لتقليل وقت المعالجة أثناء المسابقة
  INDEXED_QUESTIONS.get(normCat).push({
    ...q,
    normCorrectAnswer: normalizeArabic(q.correctAnswer),
    options: q.options.map(opt => ({
      original: opt,
      normalized: normalizeArabic(opt)
    }))
  });
});

export default function CompetitionsPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPending, startTransition] = useTransition(); // لضمان سلاسة الـ UI أثناء التنقل
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        unsubSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCompletedQuizzes(data.completedQuizzes || []);
            setUserBadges(data.badges || []);
          }
          setAuthLoading(false);
        }, (error) => {
          setAuthLoading(false);
        });
      } else {
        const localQuizzes = await StorageService.get('completed_quizzes') || [];
        const localBadges = await StorageService.get('local_badges') || [];
        setCompletedQuizzes(localQuizzes);
        setUserBadges(localBadges);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubSnap) unsubSnap();
    };
  }, []);

  const unlockBadge = useCallback(async (badgeId) => {
    if (userBadges.includes(badgeId)) return;

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { badges: arrayUnion(badgeId) });
        triggerBadgeUnlock(badgeId);
        setUserBadges(prev => [...prev, badgeId]);
        HapticService.success(); // اهتزاز عند فتح وسام جديد
      } catch (e) { console.error(e); }
    } else {
      const localBadges = await StorageService.get('local_badges') || [];
      if (!localBadges.includes(badgeId)) {
        localBadges.push(badgeId);
        await StorageService.save('local_badges', localBadges);
        triggerBadgeUnlock(badgeId);
        setUserBadges(localBadges);
        HapticService.success();
      }
    }
  }, [user, userBadges, triggerBadgeUnlock]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const res = await fetch('/data/bookNames.json');
        const data = await res.json();
        setBookNamesData((data.ar || []).map(b => ({ ...b, name: b.name.trim() })));
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    loadInitialData();
  }, []);

  const handleAnswer = useCallback(async (selectedOption) => {
    if (quizState.answered || questions.length === 0) return;

    const currentQuestion = questions[quizState.currentIndex];
    // المقارنة الآن تتم بـ O(1) لأن القيم جاهزة مسبقاً
    const correct = selectedOption.normalized === currentQuestion.normCorrectAnswer;
    const newStreak = correct ? quizState.streak + 1 : 0;

    if (correct) {
      HapticService.success();
    } else {
      HapticService.error();
    }

    setQuizState(prev => ({
      ...prev,
      answered: true,
      isCorrect: correct,
      score: correct ? prev.score + 1 : prev.score,
      streak: newStreak
    }));

    if (newStreak === 10) await unlockBadge('rapid_10');
  }, [quizState.answered, quizState.currentIndex, quizState.streak, questions, unlockBadge]);

  const finalizeQuiz = async (record, isPerfect) => {
    let pointsToAdd = 30;
    let reason = `إكمال مسابقة: ${record.category}`;
    if (isPerfect) {
      pointsToAdd += 50;
      reason = `العلامة الكاملة: ${record.category}`;
      HapticService.success();
    }

    const updatedHistory = [record, ...completedQuizzes.filter(q => q.category !== record.category)];

    if (user) {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, {
          completedQuizzes: updatedHistory,
          totalPoints: increment(pointsToAdd),
          pointsHistory: arrayUnion({
            type: 'quiz',
            points: pointsToAdd,
            reason: reason,
            timestamp: getCairoIsoString()
          })
        });
      } catch (e) { console.error(e); }
    } else {
      setCompletedQuizzes(updatedHistory);
      await StorageService.save('completed_quizzes', updatedHistory);
      await StorageService.addPoints(pointsToAdd);
      const history = await StorageService.get('points_history') || [];
      history.push({ type: 'quiz', points: pointsToAdd, reason: reason, timestamp: getCairoIsoString() });
      await StorageService.save('points_history', history);
    }

    // Badge Logic for all users
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
    if (isPerfect && duration < 30) await unlockBadge('speed_demon');
  };

  const loadQuestionsByCategory = useCallback((categoryName) => {
    HapticService.light();
    startTransition(() => {
      const cleanName = normalizeArabic(categoryName);
      const filtered = INDEXED_QUESTIONS.get(cleanName) || [];

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
    });
  }, []);

  const nextQuestion = async () => {
    HapticService.light();
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
        date: getCairoIsoString()
      };
      setQuizState(prev => ({ ...prev, showResults: true }));
      await finalizeQuiz(record, finalScore === totalQuestions);
    }
  };

  const resetQuiz = () => {
    HapticService.medium();
    setQuizState({ category: null, currentIndex: 0, score: 0, answered: false, isCorrect: null, showResults: false, streak: 0, startTime: null });
    setQuestions([]);
    setUserAnswer('');
  };

  if (authLoading || isLoading) return <div className={styles.loading}>جاري التحميل...</div>;

  return (
    <div dir="rtl" className={styles.mainContainer} style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
      {copiedMessage && <div className={styles.toast}>{copiedMessage}</div>}
      
      <header className={styles.header}>
        <h1 className={styles.title}>مسابقات أجيوس</h1>
        <p className={styles.userBadge}>أهلاً، {user?.displayName || 'ضيف أجيوس'}</p>
      </header>

      {!quizState.category && (
        <div className={styles.controls}>
          <div className={styles.customSelectWrapper} ref={categoryRef}>
            <div className={styles.selectTrigger} onClick={() => { HapticService.selection(); setIsCategoryOpen(!isCategoryOpen); }}>
              {quizState.category || "اختر سفراً للبدء"}
            </div>
            <AnimatePresence>
              {isCategoryOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
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
                <h3>سجل نتائجك {user ? '☁️' : '📱'}</h3>
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
                    className={`${styles.optionButton} ${quizState.answered ? (opt.normalized === questions[quizState.currentIndex].normCorrectAnswer ? styles.correctAnswer : (opt.original === userAnswer ? styles.incorrectAnswer : '')) : ''}`}
                    onClick={() => { setUserAnswer(opt.original); handleAnswer(opt); }}
                  >{opt.original}</button>
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
