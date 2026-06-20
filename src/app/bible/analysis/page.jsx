'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleGenerativeAI } from "@google/generative-ai";
import styles from './analysis.module.css';
import { ArrowRight, Sparkles, Loader2, AlertCircle, Clock, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { kv, CACHE_KEYS } from '../../../lib/kv';
import strings from '../../data/ar.json';

const apiKeys = [
  "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ",
  "AIzaSyB9a0OiIJGdlwcDdna511QZTLPp14gWoic",
  "AQ.Ab8RN6J4tMmUaO2fXNoMSI3ZzAjJJzSdsonV8BJwA4hU8Qd-lg",
  "AQ.Ab8RN6LcBmsh2-JOPw2nFABcCLRDuydaBPFsAtQktLh_UB654g"
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
      const isRetryable =
        errorMsg.includes('429') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('500') ||
        errorMsg.includes('502') ||
        errorMsg.includes('503') ||
        errorMsg.includes('504') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('busy') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('deadline') ||
        errorMsg.includes('network') ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('stream');

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
  const analysisRef = useRef('');
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

    const cacheKey = `${CACHE_KEYS.ANALYSIS}${book}:${chapter}:${verses || 'all'}`;

    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        setAnalysis(cached);
        analysisRef.current = cached;
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.error("KV Read Error:", e);
    }

    const requestTimes = JSON.parse(localStorage.getItem('aiRequestTimestamps') || '[]');
    const now = Date.now();
    const oneMinute = 60000;
    const recentRequests = requestTimes.filter(time => now - time < oneMinute);

    if (recentRequests.length >= 1) {
      const oldestInWindow = Math.min(...recentRequests);
      const remaining = Math.ceil((oneMinute - (now - oldestInWindow)) / 1000);
      setCountdown(remaining);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis('');
    analysisRef.current = '';

    const updatedRequests = [...recentRequests, now];
    localStorage.setItem('aiRequestTimestamps', JSON.stringify(updatedRequests));

    const targetText = verses
      ? `السفر: ${book}\nالإصحاح: ${chapter}\nالآيات المحددة: ${verses}`
      : `السفر: ${book}\nالإصحاح: ${chapter}`;

    const prompt = `أنت "مساعد آجيوس الذكي". مهمتك: تفسير النص المرفق لاهوتياً ولغوياً بدقة، مع التركيز حصراً على النص المطلوب وتجنب الاستطراد.

# نص البحث:
${targetText}

# المنهجية (محتوى الأقسام):
١. مقدمة: رحب بصفتك "مساعد آجيوس".
٢. لغويات: أصل الكلمات (يوناني/عبري/آرامي) للنص فقط.
٣. تاريخ: الخلفية البيئية للنص.
٤. تفسير: لاهوتي/آبائي (القبطية الأرثوذكسية، أ. تادرس ملطي، أ. أنطونيوس فكري).
٥. تطبيق: عملي معاصر.
٦. شبهات: تفكيك أي اعتراض على النص المذكور فقط.

# قواعد التنسيق (صارمة جداً):
- يجب أن يكون رقم القسم وعنوانه (مثلاً: ١. مقدمة) في سطر مستقل تماماً.
- يمنع منعاً باتاً كتابة أي نص بجانب العنوان في نفس السطر.
- ابدأ محتوى القسم دائماً في سطر جديد كلياً بعد العنوان.
- ممنوع استخدام Markdown (مثل #).
- التزم بالتركيز المطلق على النص دون تشتيت.
- في نهاية قسم التطبيق، أضف دائماً: "ودائماً ننصح بالرجوع لأب اعترافك".`;

    const attemptGeneration = async (attemptIndex) => {
      const genAI = getGenAI(attemptIndex);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite" ,
        generationConfig: {
          maxOutputTokens: 2048,
        }
      });

      const result = await model.generateContentStream(prompt);
      let text = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        text += chunkText;
        setAnalysis(text);
        analysisRef.current = text;
      }

      if (text) {
        kv.set(cacheKey, text).catch(e => console.error("KV Write Error:", e));
      }
      return text;
    };

    try {
      setStatus(strings.analysis.status_analyzing);
      await withRetry(
        attemptGeneration,
        (attempt) => setStatus(`محاولة ${convertToArabicNumber(attempt)}: مساعد آجيوس الذكي يقوم بتحليل النص...`),
        5
      );
      setIsLoading(false);
    } catch (e) {
      console.error("Final Analysis Error:", e);
      if (analysisRef.current.length > 100) {
        setIsLoading(false);
        toast.error(strings.analysis.error_incomplete);
      } else {
        setError(strings.analysis.error_generic);
        setIsLoading(false);
      }
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
    toast.success(strings.analysis.toast_copy);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!analysis) return;
    const shareTitle = verses
      ? `${strings.analysis.title_prefix} ${book} ${convertToArabicNumber(chapter)} : ${convertToArabicNumber(verses)}`
      : `${strings.analysis.title_prefix} ${book} ${convertToArabicNumber(chapter)}`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: shareTitle,
          text: analysis,
          url: window.location.href,
          dialogTitle: strings.share_preview.share_dialog,
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
          dialogTitle: strings.share_preview.share_dialog,
        });
      } else if (navigator.share) {
        await navigator.share({
          text: text
        });
      } else {
        navigator.clipboard.writeText(text);
        toast.success(strings.common.copied);
      }
    } catch (err) {
      console.error('Share error', err);
    }
  };

  const parseAndRender = (text) => {
    if (!text) return null;

    const renderParagraph = (content, key, originalRaw) => {
      const parts = content.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        return part.replace(/[#*]/g, '');
      });

      return (
        <div key={key} className={styles.paragraphWrapper}>
          <p className={styles.paragraph}>
            {formattedLine}
          </p>
          <div className={styles.paragraphActions}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(originalRaw.replace(/[#*]/g, '').trim());
                toast.success(strings.analysis.toast_copy_paragraph);
              }}
              className={styles.miniActionBtn}
              title={strings.common.copy}
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => shareText(originalRaw.replace(/[#*]/g, '').trim())}
              className={styles.miniActionBtn}
              title={strings.common.share}
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>
      );
    };

    return text.split('\n').map((line, i) => {
      let cleanLine = line.replace(/[#*]/g, '').trim();
      if (!cleanLine) return <div key={i} className={styles.spacer} />;

      const headerMatch = cleanLine.match(/^([١٢٣٤٥٦]\.\s*[^:]{1,25}(?::|$))(.*)/);

      if (headerMatch) {
        const headerPart = headerMatch[1].trim();
        const contentPart = headerMatch[2].trim();

        if (contentPart) {
          return (
            <React.Fragment key={i}>
              <h3 className={styles.sectionHeader}>{headerPart}</h3>
              {renderParagraph(contentPart, `extra-${i}`, contentPart)}
            </React.Fragment>
          );
        }
        return <h3 key={i} className={styles.sectionHeader}>{headerPart}</h3>;
      }

      return renderParagraph(line, i, cleanLine);
    });
  };

  const displayTitle = verses
    ? `${strings.analysis.title_prefix} ${book} ${convertToArabicNumber(chapter)} : ${convertToArabicNumber(verses)}`
    : `${strings.analysis.title_prefix} ${book} ${convertToArabicNumber(chapter)}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRight}>
          <button onClick={() => router.back()} className={styles.backBtn} title={strings.common.back}>
            <ArrowRight size={24} />
          </button>
          <div className={styles.titleInfo}>
            <h1 className={styles.title}>{displayTitle}</h1>
            <span className={styles.aiBadge}><Sparkles size={12} /> {strings.analysis.ai_badge}</span>
          </div>
        </div>

        {!isLoading && analysis && (
          <div className={styles.actionButtons}>
            <button onClick={handleShare} className={styles.iconBtn} title={strings.common.share}>
              <Share2 size={20} />
            </button>
            <button onClick={handleCopy} className={styles.iconBtn} title={strings.common.copy}>
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
            <h2 className={styles.waitTitle}>{strings.analysis.wait_title}</h2>
            <p className={styles.statusText}>
              {strings.analysis.wait_desc}
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
        ) : (error && !analysis) ? (
          <div className={styles.errorWrapper}>
            <AlertCircle size={50} className={styles.errorIcon} />
            <h3>{strings.common.error_occurred}</h3>
            <p>{error}</p>
            <button onClick={() => { hasFetched.current = false; fetchAnalysis(); }} className={styles.retryBtn}>{strings.common.retry}</button>
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
                  <span>{strings.analysis.streaming_text}</span>
               </div>
            )}

            {!isLoading && (
              <footer className={styles.analysisFooter}>
                 <p className={styles.disclaimer}>
                   {strings.analysis.disclaimer}
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
    <Suspense fallback={<div>{strings.common.loading}</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
