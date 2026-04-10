'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { allQuestions } from './questionsData';
import styles from './competitions.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../lib/firebase'; 
import { doc, setDoc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/intro');
      } else {
        setUser(currentUser);
        fetchUserData(currentUser.uid);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchUserData = async (uid) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompletedQuizzes(data.completedQuizzes || []);
        setUserBadges(data.stats?.unlocked_badges || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const res = await fetch('/data/bookNames.json');
        const data = await res.json();
        setBookNamesData((data.ar || []).map(b => ({ ...b, name: b.name.trim() })));
        setIsLoading(false);
      } catch (e) {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const showBadgeToast = (message) => {
    setCopiedMessage(message);
    setTimeout(() => setCopiedMessage(''), 4000);
    if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);
  };

  const unlockBadge = async (badgeId, badgeName, rarity) => {
    if (!user || userBadges.includes(badgeId)) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        "stats.unlocked_badges": arrayUnion(badgeId)
      });
      setUserBadges(prev => [...prev, badgeId]);
      showBadgeToast(`🎉 لقد حصلت على وسام: ${badgeName} (${rarity})`);
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
      alert("عذراً، لا توجد أسئلة متوفرة حالياً.");
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

    if (newStreak === 10) await unlockBadge('rapid_10', 'سريع الاشتعال', 'مميز');
    
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      await unlockBadge('ghost_user', 'المستخدم الشبح', 'سري');
    }
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
      const timeTaken = (Date.now() - quizState.startTime) / 1000;
      const finalScore = quizState.score;
      const totalQuestions = questions.length;
      const isPerfect = finalScore === totalQuestions;

      const record = {
        category: quizState.category,
        score: finalScore,
        total: totalQuestions,
        date: new Date().toISOString()
      };

      setQuizState(prev => ({ ...prev, showResults: true }));
      await finalizeQuiz(record, isPerfect, timeTaken);
    }
  };

  const finalizeQuiz = async (record, isPerfect, timeTaken) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const updatedHistory = [record, ...completedQuizzes.filter(q => q.category !== record.category)];
    
    await updateDoc(userRef, {
      completedQuizzes: updatedHistory,
      "stats.total_points": increment(record.score * 10)
    });

    setCompletedQuizzes(updatedHistory);

    await unlockBadge('quiz_first', 'أول خطوة', 'عادي');
    
    if (updatedHistory.length >= 3) await unlockBadge('scholar_3', 'الباحث المبتدئ', 'عادي');
    if (updatedHistory.length >= 10) await unlockBadge('scholar_10', 'المتفرغ', 'مميز');
    if (updatedHistory.length >= 30) await unlockBadge('scholar_30', 'الدارس', 'نادر');
    if (updatedHistory.length >= 50) await unlockBadge('scholar_50', 'العلامة', 'أسطوري');
    if (updatedHistory.length >= 73) await unlockBadge('bible_master', 'خاتم الأسفار', 'خرافي');

    if (isPerfect) {
      await unlockBadge('perfect_1', 'العلامة الكاملة', 'عادي');
      const perfectCount = updatedHistory.filter(q => q.score === q.total).length;
      if (perfectCount >= 10) await unlockBadge('perfect_10', 'القناص', 'مميز');
      if (perfectCount >= 73) await unlockBadge('perfect_all', 'القاموس', 'أسطوري');
    }

    if (timeTaken < 30 && isPerfect) {
      await unlockBadge('flawless_victory', 'لا يُقهر', 'نادر');
      await unlockBadge('speed_demon', 'بطل السرعة', 'سري');
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

      <div className={styles.controls}>
        <div className={styles.customSelectWrapper} ref={categoryRef}>
          <div className={styles.selectTrigger} onClick={() => setIsCategoryOpen(!isCategoryOpen)}>
            {quizState.category || "اختر السفر"}
          </div>
          <AnimatePresence>
            {isCategoryOpen && (
              <motion.ul initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={styles.dropdownMenu}>
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

      <main className={styles.quizContentWrapper}>
        {!quizState.category ? (
          <div className={styles.welcomeMessage}>
            <h2>تحدي أسفار الكتاب المقدس 📖</h2>
            <p>اختر سفراً للبدء في الاختبار</p>
          </div>
        ) : quizState.showResults ? (
          <div className={styles.resultsContainer}>
            <h2 className={styles.questionText}>النتائج النهائية 📊</h2>
            <p className={styles.mainScore}>{quizState.score} / {questions.length}</p>
            <button className={styles.playAgainButton} onClick={resetQuiz}>العودة للأسفار</button>
          </div>
        ) : (
          <div className={styles.quizActive}>
            <div className={styles.quizStats}>
              <span>السؤال: {quizState.currentIndex + 1} / {questions.length}</span>
              <span>🔥 {quizState.streak}</span>
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
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'center' }}>
                <button className={styles.actionBtn} onClick={() => { if(quizState.currentIndex > 0) setQuizState(p => ({...p, currentIndex: p.currentIndex - 1}))}} disabled={quizState.currentIndex === 0 || quizState.answered}>السابق</button>
                {quizState.answered && <button onClick={nextQuestion} className={styles.nextButton}>التالي</button>}
                <button className={styles.actionBtn} onClick={resetQuiz} style={{ background: '#666' }}>إلغاء</button>
              </div>

              {quizState.answered && (
                <div className={styles.feedbackContainer}>
                  <p className={quizState.isCorrect ? styles.correctFeedback : styles.incorrectFeedback}>
                    {quizState.isCorrect ? 'إجابة صحيحة ✅' : `الصح: ${questions[quizState.currentIndex].correctAnswer}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {completedQuizzes.length > 0 && !quizState.category && (
          <div className={styles.historyContainer} style={{ marginTop: '40px' }}>
            <h3>سجل نتائجك ☁️</h3>
            {completedQuizzes.map((quiz, idx) => (
              <div key={idx} className={styles.historyItem} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#fff', margin: '5px 0', borderRadius: '8px', borderBottom: '2px solid #eee' }}>
                <span>{quiz.category}</span>
                <strong>{quiz.score} / {quiz.total}</strong>
                <button onClick={() => loadQuestionsByCategory(quiz.category)} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}>إعادة</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}