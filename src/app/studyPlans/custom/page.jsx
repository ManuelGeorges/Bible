'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDoc } from "firebase/firestore";
import styles from './customPlan.module.css';
import toast from 'react-hot-toast';
import { getCairoIsoString } from '../../../lib/dateUtils';
import { Sparkles, Calendar, BookOpen, MessageCircle, Share2, User } from 'lucide-react';
import { StorageService, KEYS } from '../../../lib/storage';
import { kv, CACHE_KEYS } from '../../../lib/kv';
import { useLanguage } from '../../context/LanguageContext';

// الدومين الأساسي لطلبات الـ API ليعمل على الموبايل (Android/iOS)
const API_BASE_URL = 'https://www.agiosbible.com';

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
        errorMsg.includes('503') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('busy') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('deadline');

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

export default function CustomPlanForm() {
    const { strings, bookNames, language, formatNumber } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [status, setStatus] = useState('');
    const [formData, setFormData] = useState({
        mood: '',
        duration: '',
        customDays: '',
        level: '',
        isShared: false,
        showAuthor: true
    });

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                const userRef = doc(db, 'users', u.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    setUserData(snap.data());
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const intensities = [
        { id: '1', label: strings.studyPlans.custom.intensities['1'] },
        { id: '2', label: strings.studyPlans.custom.intensities['2'] },
        { id: '3', label: strings.studyPlans.custom.intensities['3'] }
    ];

    const durations = [
        { id: '3', label: strings.studyPlans.custom.durations['3'] },
        { id: '7', label: strings.studyPlans.custom.durations['7'] },
        { id: '14', label: strings.studyPlans.custom.durations['14'] },
        { id: '30', label: strings.studyPlans.custom.durations['30'] },
        { id: '90', label: strings.studyPlans.custom.durations['90'] },
        { id: '180', label: strings.studyPlans.custom.durations['180'] },
        { id: 'custom', label: strings.studyPlans.custom.durations['custom'] }
    ];

    const handleSelect = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const cleanPlanData = (plan) => {
        if (!plan.readings || !Array.isArray(plan.readings)) return plan;
        return {
            ...plan,
            readings: plan.readings.map(reading => ({
                ...reading,
                books: Array.isArray(reading.books)
                    ? reading.books.map(book => book.replace(/إنجيل\s+/g, '').replace(/سفر\s+/g, '').trim())
                    : []
            }))
        };
    };

    const generatePlanWithAI = async (data) => {
        const durationDays = data.duration === 'custom' ? data.customDays : data.duration;
        const cacheKey = `${CACHE_KEYS.STUDY_PLAN}${language}:${data.mood.trim().toLowerCase()}:${durationDays}:${data.level}`;

        try {
            // 1. التحقق من Redis أولاً (Client-side cache check)
            const cached = await kv.get(cacheKey);
            if (cached) return cached;

            const allowedBooks = bookNames.map(book => book.name).join(', ');
            const intensityLabel = intensities.find(i => i.id === data.level)?.label || strings.studyPlans.custom.intensities.default;

            const attemptGeneration = async (attemptIndex) => {
                // 2. طلب السيرفر بدلاً من طلب Gemini مباشرة
                const response = await fetch(`${API_BASE_URL}/api/gemini`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task: 'studyPlan',
                        lang: language,
                        attempt: attemptIndex,
                        payload: {
                            mood: data.mood,
                            durationDays,
                            intensityLabel,
                            allowedBooks
                        }
                    })
                });

                if (!response.ok) throw new Error(await response.text());
                const { text } = await response.json();

                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Format Error");

                const planResult = JSON.parse(jsonMatch[0]);

                // 3. تخزين النتيجة في Redis بعد النجاح
                await kv.set(cacheKey, planResult);
                return planResult;
            };

            return await withRetry(
                attemptGeneration,
                (attempt) => setStatus(
                    language === 'ar'
                    ? `محاولة ${formatNumber(attempt)}: أجيوس يصمم لك رحلة روحية...`
                    : `Attempt ${formatNumber(attempt)}: Agios is designing your journey...`
                )
            );
        } catch (e) {
            console.error("Plan Generation Error:", e);
            return null;
        }
    };

    const handleSubmit = async () => {
        if (loading) return;
        const actualDuration = formData.duration === 'custom' ? parseInt(formData.customDays) : parseInt(formData.duration);

        if (!formData.mood.trim() || !formData.duration || !formData.level) {
            toast.error(strings.studyPlans.custom.error_incomplete);
            return;
        }

        if (formData.mood.trim().length < 10) {
            toast.error(strings.studyPlans.custom.error_mood_short);
            return;
        }

        setLoading(true);
        setStatus(strings.studyPlans.custom.loading_title);

        try {
            const rawPlan = await generatePlanWithAI(formData);

            if (rawPlan && rawPlan.readings) {
                const plan = cleanPlanData(rawPlan);
                const planId = `ai_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
                const currentUser = auth.currentUser;

                const newPlanObject = {
                    ...plan,
                    id: planId,
                    type: 'custom',
                    createdAt: getCairoIsoString(),
                    completedDays: {},
                    completionPercentage: 0,
                    language: language
                };

                if (currentUser) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    await setDoc(userRef, {
                        lastAIGenerated: serverTimestamp(),
                        customPlans: { [planId]: newPlanObject }
                    }, { merge: true });
                } else {
                    const localCustom = await StorageService.get(KEYS.CUSTOM_PLANS) || await StorageService.get('local_custom_plans') || {};
                    localCustom[planId] = newPlanObject;
                    await StorageService.save(KEYS.CUSTOM_PLANS, localCustom);
                }

                if (formData.isShared) {
                    const sharedPlanRef = collection(db, 'sharedPlans');
                    await addDoc(sharedPlanRef, {
                        ...newPlanObject,
                        authorId: currentUser ? currentUser.uid : 'guest',
                        authorName: (currentUser && formData.showAuthor) ? (userData?.displayName || strings.studyPlans.custom.author_default) : (language === 'ar' ? 'مشارك مجهول' : 'Anonymous User'),
                        isShared: true,
                        createdAt: serverTimestamp(),
                        originalPlanId: planId,
                        language: language
                    });
                }

                toast.success(strings.studyPlans.custom.success_toast);
                router.push(`/studyPlans/details?id=${planId}&type=custom`);
            } else {
                throw new Error(strings.studyPlans.custom.ai_error);
            }
        } catch (error) {
            toast.error(error.message || strings.studyPlans.custom.generic_error);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <div className={styles.container}>
            {loading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <h2 className={styles.sectionTitle}>{status || strings.studyPlans.custom.loading_title}</h2>
                    <p className={styles.loadingSub}>{strings.studyPlans.custom.loading_sub}</p>
                </div>
            )}

            <div className={styles.formCard}>
                <div className={styles.header}>
                    <div className={styles.iconCircle}>
                        <Sparkles className={styles.sparkleIcon} />
                    </div>
                    <h1 className={styles.mainTitle}>{strings.studyPlans.custom.form_title}</h1>
                    <p className={styles.subtitle}>{strings.studyPlans.custom.form_subtitle}</p>
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>
                        <MessageCircle size={18} /> {strings.studyPlans.custom.mood_label}
                    </label>
                    <div className={styles.inputWrapper}>
                        <textarea
                            className={styles.textInput}
                            rows="4"
                            maxLength={500}
                            disabled={loading}
                            placeholder={strings.studyPlans.custom.mood_placeholder}
                            value={formData.mood}
                            onChange={(e) => handleSelect('mood', e.target.value)}
                        ></textarea>
                        <div className={`${styles.charCount} ${formData.mood.length > 450 ? styles.limit : ''}`}>
                            {formData.mood.length}/500
                        </div>
                    </div>
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>
                        <Calendar size={18} /> {strings.studyPlans.custom.duration_label}
                    </label>
                    <div className={styles.optionsGrid}>
                        {durations.map(d => (
                            <button
                                key={d.id}
                                type="button"
                                disabled={loading}
                                className={`${styles.optionCard} ${formData.duration === d.id ? styles.selected : ''}`}
                                onClick={() => handleSelect('duration', d.id)}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>

                    {formData.duration === 'custom' && (
                        <div className={styles.customDaysInputWrapper}>
                            <input
                                type="number"
                                className={styles.customDaysInput}
                                placeholder={strings.studyPlans.custom.duration_custom_placeholder}
                                value={formData.customDays}
                                onChange={(e) => handleSelect('customDays', e.target.value)}
                                min="1"
                                max="180"
                            />
                            <span className={styles.inputSuffix}>{strings.studyPlans.custom.duration_suffix}</span>
                        </div>
                    )}
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>
                        <BookOpen size={18} /> {strings.studyPlans.custom.intensity_label}
                    </label>
                    <div className={styles.optionsGrid}>
                        {intensities.map(l => (
                            <button
                                key={l.id}
                                type="button"
                                disabled={loading}
                                className={`${styles.optionCard} ${formData.level === l.id ? styles.selected : ''}`}
                                onClick={() => handleSelect('level', l.id)}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>
                        <Share2 size={18} /> {strings.studyPlans.custom.share_label}
                    </label>
                    <div className={styles.shareOptions}>
                        <label className={styles.checkboxContainer}>
                            <input
                                type="checkbox"
                                checked={formData.isShared}
                                onChange={(e) => handleSelect('isShared', e.target.checked)}
                                disabled={loading}
                            />
                            <span className={styles.checkmark}></span>
                            <span className={styles.checkboxLabel}>{strings.studyPlans.custom.share_check}</span>
                        </label>
                    </div>
                </div>

                <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? strings.studyPlans.custom.submitting : strings.studyPlans.custom.submit_btn}
                </button>
            </div>
        </div>
    );
}
