'use client';

import { useState, useEffect, useCallback } from 'react';
import { allQuestions } from './questionsData';
import styles from './competitions.module.css';

const getStem = (word) => {
  if (!word) return '';
  const normalized = word.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/[يى]/g, 'ي').replace(/[ة]/g, 'ه');
  const prefixes = ['ال', 'ب', 'ك', 'ف', 'و', 'س', 'ل'];
  const suffixes = ['ين', 'ون', 'ات', 'ان', 'ها', 'هم', 'هن', 'كم', 'ك', 'ي'];
  
  let stemmed = normalized;

  for (const prefix of prefixes) {
    if (stemmed.startsWith(prefix)) {
      stemmed = stemmed.substring(prefix.length);
      break;
    }
  }

  for (const suffix of suffixes) {
    if (stemmed.endsWith(suffix)) {
      stemmed = stemmed.substring(0, stemmed.length - suffix.length);
      break;
    }
  }

  return stemmed;
};

const normalizeArabicText = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ة]/g, 'ه')
    .replace(/[ء]/g, '')
    .replace(/\s+/g, ' ');
};

const areAnswersSimilar = (userAnswer, correctAnswer) => {
  if (!userAnswer || !correctAnswer) return false;
  
  const normalizedUser = normalizeArabicText(userAnswer);
  const normalizedCorrect = normalizeArabicText(correctAnswer);

  if (normalizedUser === normalizedCorrect) return true;

  const userWords = normalizedUser.split(' ');
  const correctWords = normalizedCorrect.split(' ');

  if (userWords.length !== correctWords.length) return false;

  for (let i = 0; i < userWords.length; i++) {
    const userStem = getStem(userWords[i]);
    const correctStem = getStem(correctWords[i]);
    if (userStem !== correctStem) {
      return false;
    }
  }

  return true;
};

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function HomePage() {
  const [quizType, setQuizType] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);
  const [highScores, setHighScores] = useState({});
  const [savedQuizStates, setSavedQuizStates] = useState({});
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timedMode, setTimedMode] = useState(false);
  const [answerHistory, setAnswerHistory] = useState([]);

  useEffect(() => {
    try {
      const storedHighScores = localStorage.getItem('bibleQuizHighScores');
      if (storedHighScores) setHighScores(JSON.parse(storedHighScores));
      
      const storedQuizStates = localStorage.getItem('savedQuizStates');
      if (storedQuizStates) setSavedQuizStates(JSON.parse(storedQuizStates));
      
      const storedMaxStreak = localStorage.getItem('maxStreak');
      if (storedMaxStreak) setMaxStreak(parseInt(storedMaxStreak, 10));
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    let timer;
    if (timedMode && timeLeft > 0 && !answered && quizType && !showResults) {
      timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timedMode && timeLeft === 0 && !answered) {
      handleTimeUp();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, answered, timedMode, quizType, showResults]);

  const handleTimeUp = () => {
    const currentQuestion = questions[currentQuestionIndex];
    setAnswered(true);
    setIsCorrect(false);
    setStreak(0);
    setAnswerHistory(prev => [...prev, {
      question: currentQuestion?.questionText || 'السؤال',
      userAnswer: userAnswer || 'لم يتم الإجابة',
      correctAnswer: currentQuestion?.correctAnswer || '',
      isCorrect: false,
      timeTaken: 30
    }]);
  };

  const saveQuizState = useCallback((type, state) => {
    const newSavedStates = { ...savedQuizStates, [type]: state };
    try {
      localStorage.setItem('savedQuizStates', JSON.stringify(newSavedStates));
      setSavedQuizStates(newSavedStates);
    } catch (error) {
      console.error('Failed to save quiz state:', error);
    }
  }, [savedQuizStates]);

  const saveHighScores = (newScores) => {
    try {
      localStorage.setItem('bibleQuizHighScores', JSON.stringify(newScores));
      setHighScores(newScores);
    } catch (error) {
      console.error('Failed to save high scores to localStorage:', error);
    }
  };

  const saveMaxStreak = (newMaxStreak) => {
    try {
      localStorage.setItem('maxStreak', newMaxStreak.toString());
      setMaxStreak(newMaxStreak);
    } catch (error) {
      console.error('Failed to save max streak:', error);
    }
  };

  const getDifficultyBasedQuestions = (type, difficulty = 'mixed') => {
    let filteredQuestions = allQuestions.filter(q => q.type === type);
    
    if (difficulty === 'easy') {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty === 'easy' || !q.difficulty);
    } else if (difficulty === 'hard') {
      filteredQuestions = filteredQuestions.filter(q => q.difficulty === 'hard');
    }
    return shuffleArray(filteredQuestions);
  };

  const startQuiz = (type, options = {}) => {
    const { difficulty = 'mixed', timed = false, resume = false } = options;
    
    setQuizType(type);
    setShowResults(false);
    setUserAnswer('');
    setAnswered(false);
    setIsCorrect(null);
    setShowHint(false);
    setTimedMode(timed);
    setAnswerHistory([]);

    const savedState = savedQuizStates[type];
    if (savedState && resume && !timed) {
      setCurrentQuestionIndex(savedState.currentQuestionIndex);
      setScore(savedState.score);
      setQuestions(savedState.questions);
      setStreak(savedState.streak || 0);
      setAnswerHistory(savedState.answerHistory || []);
    } else {
      setCurrentQuestionIndex(0);
      setScore(0);
      setStreak(0);
      const questionsToUse = getDifficultyBasedQuestions(type, difficulty);
      setQuestions(questionsToUse.slice(0, timed ? 10 : questionsToUse.length));
      if (timed) setTimeLeft(30);
      if (savedState) {
        const newSavedStates = { ...savedQuizStates };
        delete newSavedStates[type];
        localStorage.setItem('savedQuizStates', JSON.stringify(newSavedStates));
        setSavedQuizStates(newSavedStates);
      }
    }
  };

  const handleAnswer = (answer) => {
    if (answered) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrectAnswer = currentQuestion.type === 'multiple_choice' 
      ? normalizeArabicText(answer) === normalizeArabicText(currentQuestion.correctAnswer)
      : areAnswersSimilar(answer, currentQuestion.correctAnswer);
    
    setAnswered(true);
    setIsCorrect(isCorrectAnswer);
    
    if (isCorrectAnswer) {
      setScore(prevScore => prevScore + 1);
      setStreak(prevStreak => {
        const newStreak = prevStreak + 1;
        if (newStreak > maxStreak) {
          saveMaxStreak(newStreak);
        }
        return newStreak;
      });
    } else {
      setStreak(0);
    }

    setAnswerHistory(prev => [...prev, {
      question: currentQuestion.questionText,
      userAnswer: answer || userAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: isCorrectAnswer,
      timeTaken: timedMode ? (30 - timeLeft) : null
    }]);
  };

  const handleNextQuestion = () => {
    const nextQuestionIndex = currentQuestionIndex + 1;

    if (quizType && questions.length > 0 && !showResults && !timedMode) {
      const quizState = {
        currentQuestionIndex: nextQuestionIndex,
        score,
        questions,
        streak,
        answerHistory
      };
      saveQuizState(quizType, quizState);
    }

    if (nextQuestionIndex < questions.length) {
      setCurrentQuestionIndex(nextQuestionIndex);
      setUserAnswer('');
      setAnswered(false);
      setIsCorrect(null);
      setShowHint(false);
      if (timedMode) setTimeLeft(30);
    } else {
      setShowResults(true);
      const currentHighScore = highScores[quizType] || 0;
      if (score > currentHighScore) {
        saveHighScores({ ...highScores, [quizType]: score });
      }
      const newSavedStates = { ...savedQuizStates };
      delete newSavedStates[quizType];
      try {
        localStorage.setItem('savedQuizStates', JSON.stringify(newSavedStates));
        setSavedQuizStates(newSavedStates);
      } catch (error) {
        console.error('Failed to clear quiz state:', error);
      }
    }
  };

  const resetQuiz = () => {
    setQuizType(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowResults(false);
    setUserAnswer('');
    setAnswered(false);
    setIsCorrect(null);
    setStreak(0);
    setShowHint(false);
    setTimeLeft(null);
    setTimedMode(false);
    setAnswerHistory([]);
  };

  const getHint = () => {
    setShowHint(true);
  };

  const getScoreMessage = (score, total) => {
    const percentage = (score / total) * 100;
    if (percentage === 100) return 'مثالي! أداء رائع جداً! 🏆';
    if (percentage >= 90) return 'ممتاز جداً! أداء مميز! 🌟';
    if (percentage >= 80) return 'جيد جداً! استمر هكذا! 👏';
    if (percentage >= 70) return 'جيد! يمكنك تحسين أدائك! 👍';
    if (percentage >= 60) return 'مقبول، تحتاج لمراجعة أكثر! 📚';
    return 'تحتاج للمزيد من الدراسة! لا تستسلم! 💪';
  };

  const renderQuizContent = () => {
    if (!quizType && questions.length === 0) {
      return (
        <div className={styles.welcomeMessage}>
          <h2>أهلاً بك في مسابقات الكتاب المقدس! 📖</h2>
          <p>اختر نوع المسابقة والمستوى المناسب لك</p>
          <div className={styles.statsContainer}>
            <div className={styles.statItem}>
              <span>أطول سلسلة إجابات صحيحة:</span>
              <span className={styles.statValue}>{maxStreak}</span>
            </div>
          </div>
        </div>
      );
    }

    if (showResults) {
      const totalQuestions = questions.length;
      const percentage = ((score / totalQuestions) * 100).toFixed(1);
      const isPerfectScore = score === totalQuestions;
      const isNewHighScore = score > (highScores[quizType] || 0);

      const maxStreakInQuiz = answerHistory.reduce((max, current) => {
        const lastStreak = max.lastStreak;
        const newLastStreak = current.isCorrect ? lastStreak + 1 : 0;
        return { max: Math.max(max.max, newLastStreak), lastStreak: newLastStreak };
      }, { max: 0, lastStreak: 0 }).max;
      
      return (
        <div className={`${styles.resultsContainer} ${isPerfectScore ? styles.confetti : ''}`}>
          <h2>انتهت المسابقة! 🎉</h2>
          <div className={styles.scoreDetails}>
            <p className={styles.mainScore}>النتيجة: {score} من {totalQuestions} ({percentage}%)</p>
            <p className={styles.scoreMessage}>{getScoreMessage(score, totalQuestions)}</p>
            {isNewHighScore && <p className={styles.newHighScoreMessage}>🏆 رقم قياسي جديد!</p>}
          </div>
          
          <div className={styles.detailedStats}>
            <div className={styles.statRow}>
              <span>أطول سلسلة صحيحة في هذه المسابقة:</span>
              <span>{maxStreakInQuiz}</span>
            </div>
            <div className={styles.statRow}>
              <span>أعلى نتيجة سابقة:</span>
              <span>{highScores[quizType] || 0}</span>
            </div>
            {timedMode && (
              <div className={styles.statRow}>
                <span>متوسط الوقت المستغرق:</span>
                <span>
                  {(answerHistory.filter(a => a.timeTaken !== null).reduce((sum, ans) => sum + ans.timeTaken, 0) / answerHistory.length).toFixed(1)} ثانية
                </span>
              </div>
            )}
          </div>

          <div className={styles.answerReview}>
            <h3>مراجعة الإجابات:</h3>
            {answerHistory.map((answer, index) => (
              <div key={index} className={`${styles.reviewItem} ${answer.isCorrect ? styles.correctReview : styles.incorrectReview}`}>
                <div className={styles.reviewQuestion}>س{index + 1}: {answer.question}</div>
                <div className={styles.reviewAnswer}>
                  <span>إجابتك: {answer.userAnswer}</span>
                  {!answer.isCorrect && (
                    <span>الإجابة الصحيحة: {answer.correctAnswer}</span>
                  )}
                  {timedMode && answer.timeTaken !== null && <span>الوقت: {answer.timeTaken}ث</span>}
                </div>
              </div>
            ))}
          </div>

          <button className={styles.playAgainButton} onClick={resetQuiz}>
            ابدأ مسابقة جديدة
          </button>
        </div>
      );
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    const totalQuestions = questions.length;
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;

    const renderProgressBar = () => (
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
        </div>
        <span className={styles.progressText}>{currentQuestionIndex + 1} / {totalQuestions}</span>
      </div>
    );
    
    const renderFeedback = () => {
      if (answered) {
        return (
          <div className={styles.feedbackContainer}>
            <div className={`${styles.feedbackMessage} ${isCorrect ? styles.correctFeedback : styles.incorrectFeedback}`}>
              {isCorrect ? '✅ إجابة صحيحة!' : `❌ إجابة خاطئة`}
              {!isCorrect && (
                <div className={styles.correctAnswerShow}>
                  الإجابة الصحيحة: <strong>{currentQuestion.correctAnswer}</strong>
                </div>
              )}
            </div>
            {currentQuestion.verseReference && (
              <p className={styles.verseReference}>
                📖 الآية المرجعية: {currentQuestion.verseReference}
              </p>
            )}
            {isCorrect && streak > 1 && (
              <p className={styles.streakMessage}>
                🔥 سلسلة إجابات صحيحة: {streak}
              </p>
            )}
            <button className={styles.nextButton} onClick={handleNextQuestion}>
              {currentQuestionIndex + 1 < totalQuestions ? 'السؤال التالي ←' : 'عرض النتائج 🏁'}
            </button>
          </div>
        );
      }
      return null;
    };

    const renderQuestionCard = () => {
      const question = questions[currentQuestionIndex];
      if (!question) return null;

      switch (question.type) {
        case 'multiple_choice':
          return (
            <div className={styles.questionCard}>
              <h3 className={styles.questionText}>{question.questionText}</h3>
              {showHint && question.hint && (
                <div className={styles.hintBox}>
                  💡 تلميح: {question.hint}
                </div>
              )}
              <div className={styles.optionsContainer}>
                {question.options.map((option, index) => (
                  <button
                    key={index}
                    className={`${styles.optionButton} ${
                      answered 
                        ? normalizeArabicText(option) === normalizeArabicText(question.correctAnswer)
                          ? styles.correctAnswer 
                          : normalizeArabicText(option) === normalizeArabicText(userAnswer) && !isCorrect 
                            ? styles.incorrectAnswer 
                            : ''
                        : ''
                    }`}
                    onClick={() => handleAnswer(option)}
                    disabled={answered}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {renderFeedback()}
            </div>
          );
        
        case 'complete_verse':
        case 'who_is_it':
          return (
            <div className={styles.questionCard}>
              <h3 className={styles.questionText}>{question.questionText}</h3>
              {showHint && question.hint && (
                <div className={styles.hintBox}>
                  💡 تلميح: {question.hint}
                </div>
              )}
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className={`${styles.textInput} ${
                    answered 
                      ? isCorrect 
                        ? styles.correctInput 
                        : styles.incorrectInput 
                      : ''
                  }`}
                  placeholder="اكتب إجابتك هنا..."
                  disabled={answered}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && userAnswer.trim() !== '' && !answered) {
                      handleAnswer(userAnswer);
                    }
                  }}
                />
                {!answered && (
                  <div className={styles.inputActions}>
                    <button
                      className={styles.submitButton}
                      onClick={() => handleAnswer(userAnswer)}
                      disabled={userAnswer.trim() === ''}
                    >
                      إرسال ✓
                    </button>
                    {question.hint && !showHint && (
                      <button
                        className={styles.hintButton}
                        onClick={getHint}
                      >
                        تلميح 💡
                      </button>
                    )}
                  </div>
                )}
              </div>
              {renderFeedback()}
            </div>
          );
        
        default:
          return null;
      }
    };
    
    return (
      <div className={styles.quizContentWrapper}>
        <div className={styles.quizHeader}>
          <div className={styles.quizStats}>
            <span>النتيجة: {score}</span>
            <span>أعلى نتيجة: {highScores[quizType] || 0}</span>
            <span>السلسلة الحالية: {streak}</span>
            {timedMode && timeLeft !== null && (
              <span className={`${styles.timer} ${timeLeft <= 10 ? styles.timerWarning : ''}`}>
                ⏰ {timeLeft}ث
              </span>
            )}
          </div>
        </div>
        {renderProgressBar()}
        {renderQuestionCard()}
      </div>
    );
  };

  const renderQuizOptions = (type) => {
    const savedState = savedQuizStates[type];
    return (
      <div className={styles.quizOptions}>
        {savedState && (
          <button className={styles.resumeButton} onClick={() => startQuiz(type, { resume: true })}>
            استئناف 
          </button>
        )}
        <button onClick={() => startQuiz(type, { difficulty: 'mixed' })}>
          عادي
        </button>
        <button onClick={() => startQuiz(type, { difficulty: 'easy' })}>
          سهل
        </button>
        <button onClick={() => startQuiz(type, { difficulty: 'hard' })}>
          صعب
        </button>
        <button onClick={() => startQuiz(type, { timed: true })}>
          تحدي الوقت ⏰
        </button>
      </div>
    );
  };

  return (
    <div className={styles.mainContainer}>
      <header className={styles.header}>
        <h1>📖 مسابقات الكتاب المقدس</h1>
      </header>

      <nav className={styles.navbar}>
        <div className={styles.navItem}>
          <button 
            className={quizType === 'multiple_choice' ? styles.active : ''} 
            onClick={() => setQuizType(prev => prev === 'multiple_choice' ? null : 'multiple_choice')}
          >
            أسئلة متعددة الاختيارات
          </button>
          {quizType === 'multiple_choice' && renderQuizOptions('multiple_choice')}
        </div>
        
        <div className={styles.navItem}>
          <button 
            className={quizType === 'complete_verse' ? styles.active : ''} 
            onClick={() => setQuizType(prev => prev === 'complete_verse' ? null : 'complete_verse')}
          >
            تحدي إكمال الآية
          </button>
          {quizType === 'complete_verse' && renderQuizOptions('complete_verse')}
        </div>
        
        <div className={styles.navItem}>
          <button 
            className={quizType === 'who_is_it' ? styles.active : ''} 
            onClick={() => setQuizType(prev => prev === 'who_is_it' ? null : 'who_is_it')}
          >
            من هو؟
          </button>
          {quizType === 'who_is_it' && renderQuizOptions('who_is_it')}
        </div>
      </nav>

      <main>
        {renderQuizContent()}
      </main>
    </div>
  );
}