'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import styles from './customPlan.module.css';
import toast from 'react-hot-toast';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCairoIsoString } from '../../../lib/dateUtils';
import { ArrowRight, Sparkles, Calendar, BookOpen, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { StorageService } from '../../../lib/storage';

const apiKey = "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ";
const genAI = new GoogleGenerativeAI(apiKey);

export default function CustomPlanForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        mood: '',
        duration: '',
        customDays: '',
        level: ''
    });

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
            const response = await fetch('/data/bookNames.json');
            const bookNamesData = await response.json();
            const allowedBooks = bookNamesData.ar.map(book => book.name).join(', ');

            const durationDays = data.duration === 'custom' ? data.customDays : data.duration;
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
            return JSON.parse(jsonMatch[0]);
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

                if (currentUser) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    await setDoc(userRef, {
                        lastAIGenerated: serverTimestamp(),
                        customPlans: {
                            [planId]: newPlanObject
                        }
                    }, { merge: true });
                } else {
                    // Save to local storage for guest
                    const localCustom = await StorageService.get('local_custom_plans') || {};
                    localCustom[planId] = newPlanObject;
                    await StorageService.save('local_custom_plans', localCustom);
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

            <div className={styles.topNav}>
                <Link href="/studyPlans" className={styles.backBtn}>
                    <ArrowRight size={20} /> العودة للخطط
                </Link>
            </div>

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
