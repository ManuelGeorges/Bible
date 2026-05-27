'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleGenerativeAI } from "@google/generative-ai";
import styles from './analysis.module.css';
import { ArrowRight, Sparkles, Loader2, AlertCircle, Clock, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const apiKeys = [
  "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ",
  "AIzaSyB9a0OiIJGdlwcDdna511QZTLPp14gWoic"
];

const getGenAI = (index) => {
  const key = apiKeys[index % apiKeys.length];
  return new GoogleGenerativeAI(key);
};

async function withRetry(fn, onRetry, maxAttempts = 5, baseDelayMs = 2000) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const errorMsg = err.message?.toLowerCase() || "";
      const isRetryable = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('busy') || errorMsg.includes('timeout') || errorMsg.includes('network') || errorMsg.includes('fetch');

      if (attempt < maxAttempts - 1 && isRetryable) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        if (onRetry) onRetry(attempt + 1, maxAttempts);
        await new Promise(r => setTimeout(r, delay));
      } else if (!isRetryable) {
        throw err;
      }
    }
  }
  throw lastError;
}

function AnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const book = searchParams.get('book');
  const chapter = searchParams.get('chapter');
  const verses = searchParams.get('verses');

  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState(false);
  const hasFetched = useRef(false);

  const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num?.toString().split('').map(d => arabicNums[+d] || d).join('') || '';
  };

  const fetchAnalysis = async () => {
    if (!book || !chapter) return;

    // Check rate limit (3 requests per minute)
    const requestTimes = JSON.parse(localStorage.getItem('aiRequestTimestamps') || '[]');
    const now = Date.now();
    const oneMinute = 60000;

    // Filter for requests within the last minute
    const recentRequests = requestTimes.filter(time => now - time < oneMinute);

    if (recentRequests.length >= 3) {
      const oldestInWindow = Math.min(...recentRequests);
      const remaining = Math.ceil((oneMinute - (now - oldestInWindow)) / 1000);
      setCountdown(remaining);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis('');

    // Update request times immediately when starting
    const updatedRequests = [...recentRequests, now];
    localStorage.setItem('aiRequestTimestamps', JSON.stringify(updatedRequests));

    const targetText = verses
      ? `السفر: ${book}\nالإصحاح: ${chapter}\nالآيات المحددة: ${verses}`
      : `السفر: ${book}\nالإصحاح: ${chapter}`;

    const prompt = `أنت لاهوتي ومؤرخ ومترجم كتابي خبير ومحترف اسمك "مساعد آجيوس الذكي". مهمتك الوحيدة والحصرية هي تحليل وشرح آية أو آيات أو إصحاحات الكتاب المقدس التي يرسلها المستخدم لك وركز جيداً على التركيز فيها وعدم الانخراط في الحديث عن السفر بكثرة او عن بقية الاصحاح او الايات الاخرى بكثرة, تحدث عما يطلبه منك المستخدم.

# TARGET
${targetText}

# STRUCTURE (التزم بهذا التنسيق تماماً)
١. المقدمة والترحيب: قدم نفسك دوماً كمساعد آجيوس الذكي الخبير في دراسات الكتاب المقدس
٢.  المنهجية اللغوية وأصل الكلمات اليوناني او العبري او الآرامي للآيات المحددة.
٣. الخلفية التاريخية والبيئية للنص المطلوب.
٤.  التفسير الروحي واللاهوتي القبطي الأرثوذكسي للآيات المذكورة مثل التفسيرات الآبائية التي تعترف لها الكنيسة القبطية وتفسيرات ابونا تادرس يعقوب ملطي وابونا انطونيوس فكري.
٥. التطبيق العملي والمعاصر للآيات المحددة: (يجب أن تنتهي بـ: ودائماً ننصح بالرجوع لأب اعترافك للإرشاد والتدقيق في حالة وجود أي تساؤل أو شك)
٦. تفكيك الشبهات والرد على الاعتراضات المتعلقة بهذا النص تحديداً.

# RULES
- لا تستخدم رموز Markdown مثل ## أو # في العناوين.
- استخدم الترقيم العربي (١. ، ٢. ، إلخ) لبدء كل قسم.
- اجعل الأقسام واضحة ومنفصلة.
- ركز تركيزاً تاماً على الآيات المطلوبة ولا تشتت المستخدم بأجزاء أخرى من السفر إلا للضرورة القصوى.`;

    const attemptGeneration = async (attemptIndex) => {
      const genAI = getGenAI(attemptIndex);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

      const result = await model.generateContentStream(prompt);
      let text = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        text += chunkText;
        setAnalysis(text);
      }
      return text;
    };

    try {
      setStatus('مساعد آجيوس الذكي يقوم بتحليل النص الآن...');
      await withRetry(
        attemptGeneration,
        () => setStatus('مساعد آجيوس الذكي يقوم بتحليل النص الآن...'),
        5
      );
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setError('حدث خطأ أثناء تحميل التحليل. يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetched.current && book && chapter) {
      hasFetched.current = true;
      fetchAnalysis();
    }
  }, [book, chapter, verses]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && hasFetched.current && !analysis && !isLoading && !error) {
      fetchAnalysis();
    }
  }, [countdown, analysis, isLoading, error]);

  const handleCopy = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    toast.success('تم نسخ التحليل بنجاح');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!analysis) return;
    const shareTitle = verses
      ? `دراسة ${book} ${convertToArabicNumber(chapter)} : ${convertToArabicNumber(verses)}`
      : `دراسة ${book} ${convertToArabicNumber(chapter)}`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: shareTitle,
          text: analysis,
          url: window.location.href,
          dialogTitle: 'مشاركة التحليل عبر...',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: analysis,
          url: window.location.href,
        });
      } else {
        handleCopy();
      }
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const shareText = async (text) => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          text: text,
          dialogTitle: 'مشاركة النص...',
        });
      } else if (navigator.share) {
        await navigator.share({
          text: text
        });
      } else {
        navigator.clipboard.writeText(text);
        toast.success('تم النسخ');
      }
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const parseAndRender = (text) => {
    if (!text) return null;

    return text.split('\n').map((line, i) => {
      let cleanLine = line.replace(/[#*]/g, '').trim();
      if (!cleanLine) return <div key={i} className={styles.spacer} />;

      const isHeader = /^[١٢٣٤٥٦]\./.test(cleanLine);

      if (isHeader) {
        return <h3 key={i} className={styles.sectionHeader}>{cleanLine}</h3>;
      }

      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        return part.replace(/[#*]/g, '');
      });

      return (
        <div key={i} className={styles.paragraphWrapper}>
          <p className={styles.paragraph}>
            {formattedLine}
          </p>
          <div className={styles.paragraphActions}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(cleanLine);
                toast.success('تم نسخ الفقرة');
              }}
              className={styles.miniActionBtn}
              title="نسخ"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => shareText(cleanLine)}
              className={styles.miniActionBtn}
              title="مشاركة"
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>
      );
    });
  };

  const displayTitle = verses
    ? `دراسة ${book} ${convertToArabicNumber(chapter)} : ${convertToArabicNumber(verses)}`
    : `دراسة ${book} ${convertToArabicNumber(chapter)}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRight}>
          <button onClick={() => router.back()} className={styles.backBtn} title="رجوع">
            <ArrowRight size={24} />
          </button>
          <div className={styles.titleInfo}>
            <h1 className={styles.title}>{displayTitle}</h1>
            <span className={styles.aiBadge}><Sparkles size={12} /> مدعوم بالذكاء الاصطناعي</span>
          </div>
        </div>

        {!isLoading && analysis && (
          <div className={styles.actionButtons}>
            <button onClick={handleShare} className={styles.iconBtn} title="مشاركة">
              <Share2 size={20} />
            </button>
            <button onClick={handleCopy} className={styles.iconBtn} title="نسخ">
              {copied ? <Check size={20} color="#4caf50" /> : <Copy size={20} />}
            </button>
          </div>
        )}
      </header>

      <main className={styles.contentCard}>
        {countdown > 0 ? (
          <div className={styles.loadingWrapper}>
            <div className={styles.countdownCircle}>
               <span className={styles.countdownNumber}>{convertToArabicNumber(countdown)}</span>
            </div>
            <h2 className={styles.waitTitle}>يرجى الانتظار قليلاً</h2>
            <p className={styles.statusText}>
              لحماية الخادم، يرجى الانتظار قبل طلب تحليل جديد. سيتم بدء التحليل تلقائياً بعد انتهاء العد التنازلي.
            </p>
          </div>
        ) : isLoading && !analysis ? (
          <div className={styles.loadingWrapper}>
            <div className={styles.aiLoadingIcon}>
               <Sparkles size={50} className={styles.pulseIcon} />
            </div>
            <p className={styles.statusText}>{status}</p>
            <div className={styles.loadingBarContainer}>
               <div className={styles.loadingBarProgress}></div>
            </div>
          </div>
        ) : error ? (
          <div className={styles.errorWrapper}>
            <AlertCircle size={50} className={styles.errorIcon} />
            <h3>عذراً، حدث خطأ</h3>
            <p>{error}</p>
            <button onClick={() => { hasFetched.current = false; fetchAnalysis(); }} className={styles.retryBtn}>إعادة المحاولة</button>
          </div>
        ) : (
          <div className={styles.analysisContainer}>
            <div className={styles.analysisText}>
              {parseAndRender(analysis)}
            </div>
            {isLoading && (
               <div className={styles.streamingIndicator}>
                  <div className={styles.typingDots}>
                    <span></span><span></span><span></span>
                  </div>
                  <span>مساعد أجيوس الذكي يكتب لك الآن...</span>
               </div>
            )}

            {!isLoading && (
              <footer className={styles.analysisFooter}>
                 <p className={styles.disclaimer}>
                   هذا التحليل تم توليده بواسطة الذكاء الاصطناعي للمساعدة في الدراسة. دائماً يرجى الرجوع للآباء الكهنة وكتب التفسير المعتمدة للكنيسة القبطية.
                 </p>
              </footer>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>جاري التحميل...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
