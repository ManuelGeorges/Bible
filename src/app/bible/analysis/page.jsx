'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './analysis.module.css';
import { Sparkles, Loader2, AlertCircle, Clock, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { kv, CACHE_KEYS } from '../../../lib/kv';
import { useLanguage } from '../../context/LanguageContext';

const fontOptionsMap = {
  'Cairo': "'Cairo', sans-serif",
  'Amiri': "'Amiri', serif",
  'Almarai': "'Almarai', sans-serif",
  'Tajawal': "'Tajawal', sans-serif",
  'ReemKufi': "'Reem Kufi', sans-serif"
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
        errorMsg.includes('fetch');

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
  const { strings, language, dir, formatNumber } = useLanguage();
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
  const [sectionAnchors, setSectionAnchors] = useState([]);
  const hasFetched = useRef(false);
  const sectionRefs = useRef({});

  const QUOTA_KEY = 'aiSearchTimestamps';

  useEffect(() => {
    const syncFont = () => {
      const savedFontId = localStorage.getItem('bibleFontFamily') || 'Cairo';
      document.documentElement.style.setProperty('--bible-font-family', fontOptionsMap[savedFontId] || fontOptionsMap['Cairo']);
    };
    syncFont();
    window.addEventListener('storage', syncFont);
    return () => window.removeEventListener('storage', syncFont);
  }, []);

  useEffect(() => {
    if (!analysis) {
      setSectionAnchors([]);
      return;
    }
    const lines = analysis.split('\n');
    const anchors = [];
    lines.forEach((line, i) => {
      let cleanLine = line.replace(/[#*]/g, '').trim();
      const headerMatch = cleanLine.match(/^([123456١٢٣٤٥٦]\.\s*[^:]{1,25}(?::|$))(.*)/);
      if (headerMatch) {
        anchors.push(`section-${i}`);
      }
    });
    setSectionAnchors(anchors);
  }, [analysis]);

  const fetchAnalysis = async () => {
    if (!book || !chapter) return;

    const cacheKeyBase = `${CACHE_KEYS.ANALYSIS}${book}:${chapter}:${verses || 'all'}`;

    try {
      const cachedRaw = await kv.get(cacheKeyBase);
      if (cachedRaw) {
        try {
          const parsed = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
          let content = '';
          if (typeof parsed === 'string') content = parsed;
          else if (parsed && parsed[language]) content = parsed[language];
          else if (parsed && parsed.en) content = parsed.en;

          if (content) {
            setAnalysis(content);
            analysisRef.current = content;
            setIsLoading(false);
            setCountdown(0);
            return;
          }
        } catch (e) {
          setAnalysis(cachedRaw);
          analysisRef.current = cachedRaw;
          setIsLoading(false);
          setCountdown(0);
          return;
        }
      }
    } catch (e) {
      console.error("KV Read Error:", e);
    }

    const requestTimes = JSON.parse(localStorage.getItem(QUOTA_KEY) || '[]');
    const now = Date.now();
    const oneMinute = 60000;
    const recentRequests = requestTimes.filter(time => now - time < oneMinute);

    if (recentRequests.length >= 2) {
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
    setCountdown(0);

    const updatedRequests = [...recentRequests, now];
    localStorage.setItem(QUOTA_KEY, JSON.stringify(updatedRequests));

    const targetText = verses
      ? `${book}\n${chapter}\n${verses}`
      : `${book}\n${chapter}`;

    const attemptGeneration = async (attemptIndex) => {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'analysis',
          lang: language,
          attempt: attemptIndex,
          payload: { targetText }
        })
      });

      if (!response.ok) throw new Error(await response.text());

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value);
        text += chunkText;
        setAnalysis(text);
        analysisRef.current = text;
      }

      if (text) {
        try {
          const existingRaw = await kv.get(cacheKeyBase);
          let storeObj = {};
          if (existingRaw) {
            try { storeObj = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw; } catch (e) { storeObj = {}; }
          }
          storeObj[language || 'en'] = text;
          await kv.set(cacheKeyBase, JSON.stringify(storeObj));
        } catch (e) {
          console.error("KV Write Error:", e);
        }
      }
      return text;
    };

    try {
      setStatus(strings.analysis.status_analyzing);
      await withRetry(
        attemptGeneration,
        (attempt) => setStatus(
            language === 'ar'
            ? `محاولة ${formatNumber(attempt)}: مساعد آجيوس الذكي يقوم بتحليل النص...`
            : `Attempt ${formatNumber(attempt)}: Agios AI is analyzing text...`
        ),
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
  }, [book, chapter, verses, language]);

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
      ? `${strings.analysis.title_prefix} ${book} ${formatNumber(chapter)} : ${formatNumber(verses)}`
      : `${strings.analysis.title_prefix} ${book} ${formatNumber(chapter)}`;

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

  const scrollToSection = (id) => {
    const target = sectionRefs.current[id];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      const headerMatch = cleanLine.match(/^([123456١٢٣٤٥٦]\.\s*[^:]{1,25}(?::|$))(.*)/);

      if (headerMatch) {
        const headerPart = headerMatch[1].trim();
        const contentPart = headerMatch[2].trim();
        const anchorId = `section-${i}`;

        if (contentPart) {
          return (
            <React.Fragment key={i}>
              <h3 id={anchorId} ref={(el) => { sectionRefs.current[anchorId] = el; }} className={styles.sectionHeader}>{headerPart}</h3>
              {renderParagraph(contentPart, `extra-${i}`, contentPart)}
            </React.Fragment>
          );
        }
        return <h3 id={anchorId} ref={(el) => { sectionRefs.current[anchorId] = el; }} key={i} className={styles.sectionHeader}>{headerPart}</h3>;
      }

      return renderParagraph(line, i, cleanLine);
    });
  };

  const displayTitle = verses
    ? `${strings.analysis.title_prefix} ${book} ${formatNumber(chapter)} : ${formatNumber(verses)}`
    : `${strings.analysis.title_prefix} ${book} ${formatNumber(chapter)}`;

  return (
    <div className={styles.container} dir={dir}>
      <header className={styles.header}>
        <div className={styles.headerRight}>
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
        {!isLoading && analysis && sectionAnchors.length > 0 && (
          <div className={styles.sectionNav}>
            {sectionAnchors.map((anchor, idx) => {
              const labels = [
                language === 'ar' ? 'مقدمة' : language === 'fr' ? 'Introduction' : language === 'de' ? 'Einleitung' : 'Introduction',
                language === 'ar' ? 'لغويات' : language === 'fr' ? 'Linguistique' : language === 'de' ? 'Linguistik' : 'Linguistics',
                language === 'ar' ? 'تاريخ' : language === 'fr' ? 'Contexte historique' : language === 'de' ? 'Historischer Hintergrund' : 'Historical background',
                language === 'ar' ? 'تفسير' : language === 'fr' ? 'Exégèse' : language === 'de' ? 'Exegese' : 'Exegesis',
                language === 'ar' ? 'تطبيق' : language === 'fr' ? 'Application' : language === 'de' ? 'Anwendung' : 'Application',
                language === 'ar' ? 'شبهات' : language === 'fr' ? 'Objections' : language === 'de' ? 'Einwände' : 'Objections'
              ];
              return (
                <button key={anchor} onClick={() => scrollToSection(anchor)} className={styles.sectionNavBtn}>
                  {labels[idx] || `${language === 'ar' ? 'قسم' : 'Section'} ${idx + 1}`}
                </button>
              );
            })}
          </div>
        )}

        {countdown > 0 ? (
          <div className={styles.loadingWrapper}>
            <div className={styles.countdownCircle}>
               <span className={styles.countdownNumber}>{formatNumber(countdown)}</span>
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
    <Suspense fallback={<div>Loading...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
