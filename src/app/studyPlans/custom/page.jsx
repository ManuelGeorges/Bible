'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDoc } from "firebase/firestore";
import styles from './customPlan.module.css';
import toast from 'react-hot-toast';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCairoIsoString } from '../../../lib/dateUtils';
import { Sparkles, Calendar, BookOpen, MessageCircle, Share2, User } from 'lucide-react';
import { StorageService, KEYS } from '../../../lib/storage';
import { kv, CACHE_KEYS } from '../../../lib/kv';

const apiKey = "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ";
const genAI = new GoogleGenerativeAI(apiKey);

export default function CustomPlanForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
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

    const durations = [
        { id: '3', label: '3 أيام' },
        { id: '7', label: 'أسبوع' },
        { id: '14', label: 'أسبوعين' },
        { id: '30', label: 'شهر' },
        { id: '90', label: '3 أشهر' },
        { id: '180', label: '6 أشهر' },
        { id: 'custom', label: 'مدة مخصصة' }
    ];

    const intensities = [
        { id: '1', label: 'أصحاح يومياً' },
        { id: '2', label: 'أصحاحين يومياً' },
        { id: '3', label: '3 أصحاحات يومياً' }
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
        try {
            const durationDays = data.duration === 'custom' ? data.customDays : data.duration;

            // 1. Check Cache first
            const cacheKey = `${CACHE_KEYS.STUDY_PLAN}${data.mood.trim().toLowerCase()}:${durationDays}:${data.level}`;
            try {
                const cached = await kv.get(cacheKey);
                if (cached) {
                    console.log("Plan loaded from cache");
                    return cached;
                }
            } catch (e) {
                console.error("Redis Read Error:", e);
            }

            const response = await fetch('/data/bookNames.json');
            const bookNamesData = await response.json();
            const allowedBooks = bookNamesData.ar.map(book => book.name).join(', ');

            const intensityLabel = intensities.find(i => i.id === data.level)?.label || 'أصحاح واحد يومياً';

            const prompt = `أنت هو "أجيوس"، خبير الإرشاد الروحي واللاهوتي. مهمتك هي صياغة رحلة قراءة كتابية مخصصة تلمس أعماق احتياج المستخدم.

### [بيانات الحالة]
- مدخلات المستخدم: "${data.mood}"
- مدة البرنامج: "${durationDays}" أيام.
- الكثافة: "${intensityLabel}".

### [قالب المخرجات JSON فقط]
{
  "title": "عنوان ملهم",
  "description": "رسالة قصيرة ملهمة تشجع المستخدم بناءً على حالته",
  "duration": "${durationDays} أيام",
  "readings": [
    { "day": 1, "books": ["اسم_السفر رقم_الأصحاح"] }
  ]
}

قائمة الأسفار المتاحة: [${allowedBooks}]
ملاحظة هامة:
1. يجب أن تكون النتيجة JSON صالح فقط وبدون أي نصوص إضافية.
2. يجب أن يحتوي مصفوفة readings على عدد كائنات يساوي تماماً عدد الأيام (${durationDays}).
3. إذا كان الموضوع متخصصاً جداً، ابدأ به ثم توسع لأسفار ومفاهيم روحية مرتبطة لضمان اكتمال الخطة بجودة عالية.`;

            const model = genAI.getGenerativeModel({
                model: "gemini-3.1-flash-lite",
                generationConfig: { temperature: 0.7 }
            });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Format Error");

            const planResult = JSON.parse(jsonMatch[0]);

            // 2. Save to Cache (for 7 days)
            try {
                await kv.set(cacheKey, planResult, { ex: 604800 });
            } catch (e) {
                console.error("Redis Write Error:", e);
            }

            return planResult;
        } catch (e) {
            console.error("Gemini Error:", e);
            return null;
        }
    };

    const handleSubmit = async () => {
        if (loading) return;

        const actualDuration = formData.duration === 'custom' ? parseInt(formData.customDays) : parseInt(formData.duration);

        if (!formData.mood.trim() || !formData.duration || !formData.level) {
            toast.error('من فضلك أكمل البيانات أولاً');
            return;
        }

        if (formData.duration === 'custom') {
            if (!formData.customDays || actualDuration <= 0) {
                toast.error('من فضلك حدد عدد الأيام');
                return;
            }
            if (actualDuration > 180) {
                toast.error('الحد الأقصى للمدة المخصصة هو 180 يوماً لضمان جودة الخطة');
                return;
            }
        }

        if (formData.mood.trim().length < 10) {
            toast.error("الوصف قصير جداً، أخبرنا بمزيد من التفاصيل لنصمم خطة أفضل.");
            return;
        }

        setLoading(true);

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
                    completionPercentage: 0
                };

                // 1. Save locally or to user profile
                if (currentUser) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    await setDoc(userRef, {
                        lastAIGenerated: serverTimestamp(),
                        customPlans: {
                            [planId]: newPlanObject
                        }
                    }, { merge: true });
                } else {
                    const localCustom = await StorageService.get(KEYS.CUSTOM_PLANS) || await StorageService.get('local_custom_plans') || {};
                    localCustom[planId] = newPlanObject;
                    await StorageService.save(KEYS.CUSTOM_PLANS, localCustom);
                }

                // 2. Public sharing (Available for both Guest and Registered)
                if (formData.isShared) {
                    const sharedPlanRef = collection(db, 'sharedPlans');
                    await addDoc(sharedPlanRef, {
                        ...newPlanObject,
                        authorId: currentUser ? currentUser.uid : 'guest',
                        authorName: (currentUser && formData.showAuthor) ? (userData?.displayName || 'مستخدم أجيوس') : 'مشارك مجهول',
                        isShared: true,
                        createdAt: serverTimestamp(),
                        originalPlanId: planId
                    });
                }

                toast.success("تم إنشاء خطتك بنجاح!");
                router.push(`/studyPlans/details?id=${planId}&type=custom`);
            } else {
                throw new Error("فشل الذكاء الاصطناعي في تكوين الخطة");
            }
        } catch (error) {
            toast.error(error.message || 'حدث خطأ أثناء إنشاء الخطة');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {loading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <h2 className={styles.sectionTitle}>أجيوس يصمم لك رحلة روحية خاصة...</h2>
                    <p className={styles.loadingSub}>قد يستغرق هذا بضع ثوانٍ</p>
                </div>
            )}

            <div className={styles.formCard}>
                <div className={styles.header}>
                    <div className={styles.iconCircle}>
                        <Sparkles className={styles.sparkleIcon} />
                    </div>
                    <h1 className={styles.mainTitle}>مُصمم الخطط الذكي</h1>
                    <p className={styles.subtitle}>أخبر "أجيوس" بما يمر به قلبك اليوم، وسيقترح لك قراءات كتابية مخصصة.</p>
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>
                        <MessageCircle size={18} /> بماذا تشعر حالياً؟ أو ما الموضوع الذي تبحث عنه؟
                    </label>
                    <div className={styles.inputWrapper}>
                        <textarea
                            className={styles.textInput}
                            rows="4"
                            maxLength={500}
                            disabled={loading}
                            placeholder="مثلاً: أشعر بالقلق من المستقبل، أو أريد دراسة عن الصبر.."
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
                        <Calendar size={18} /> ما هي المدة المفضلة للخطة؟
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
                                placeholder="مثلاً: 40"
                                value={formData.customDays}
                                onChange={(e) => handleSelect('customDays', e.target.value)}
                                min="1"
                                max="180"
                            />
                            <span className={styles.inputSuffix}>يوماً</span>
                            <p className={styles.limitHint}>(الحد الأقصى 180 يوماً)</p>
                        </div>
                    )}
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>
                        <BookOpen size={18} /> كم أصحاحاً تود قراءته يومياً؟
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
                        <Share2 size={18} /> خيارات المشاركة
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
                            <span className={styles.checkboxLabel}>مشاركة هذه الخطة مع الآخرين في قسم "خطط مشاركة"</span>
                        </label>

                        {formData.isShared && user && (
                            <div className={styles.authorOption}>
                                <label className={styles.checkboxContainer}>
                                    <input
                                        type="checkbox"
                                        checked={formData.showAuthor}
                                        onChange={(e) => handleSelect('showAuthor', e.target.checked)}
                                        disabled={loading}
                                    />
                                    <span className={styles.checkmark}></span>
                                    <span className={styles.checkboxLabel}>إظهار اسمي كمؤلف لهذه الخطة</span>
                                </label>
                                {formData.showAuthor && (
                                    <div className={styles.authorPreview}>
                                        <User size={14} /> ستظهر الخطة بواسطة: <strong>{userData?.displayName || 'مستخدم أجيوس'}</strong>
                                    </div>
                                )}
                            </div>
                        )}
                        {formData.isShared && !user && (
                            <p className={styles.authHint}>سيتم نشر الخطة كـ "مشارك مجهول" لأنك لست مسجلاً.</p>
                        )}
                    </div>
                </div>

                <button
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? 'جاري التحضير...' : 'ابدأ رحلتي المخصصة ✨'}
                </button>
            </div>
        </div>
    );
}
