'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import styles from './customPlan.module.css';
import toast from 'react-hot-toast';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) {
  console.error("Gemini API Key is missing or undefined!");
}
const genAI = new GoogleGenerativeAI(apiKey);
export default function CustomPlanForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        mood: '',
        duration: '',
        level: ''
    });

    const durations = [
        { id: '3', label: '3 أيام (سريعة)' },
        { id: '7', label: 'أسبوع (متوسطة)' },
        { id: '14', label: 'أسبوعين (عميقة)' }
    ];

    const levels = [
        { id: 'beginner', label: 'مبتدئ (أصحاح واحد)' },
        { id: 'advanced', label: 'متقدم (عدة أصحاحات)' }
    ];

    const handleSelect = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const cleanPlanData = (plan) => {
        if (!plan.readings || !Array.isArray(plan.readings)) return plan;
        const cleanedReadings = plan.readings.map(reading => ({
            ...reading,
            books: Array.isArray(reading.books)
                ? reading.books.map(book => book.replace(/إنجيل\s+/g, '').replace(/سفر\s+/g, '').trim())
                : []
        }));
        return { ...plan, readings: cleanedReadings };
    };

    const generatePlanWithAI = async (data) => {
        try {
            const response = await fetch('/data/bookNames.json');
            const bookNamesData = await response.json();
            const allowedBooks = bookNamesData.ar.map(book => book.name).join(', ');

            const prompt = `أنت هو "أجيوس"، خبير الإرشاد الروحي واللاهوتي. مهمتك هي صياغة رحلة قراءة كتابية مخصصة تلمس أعماق احتياج المستخدم.

### [بيانات الحالة]
- مدخلات المستخدم: "${data.mood}"
- مدة البرنامج: "${data.duration}" أيام.
- الكثافة: "${data.level === 'beginner' ? 'أصحاح واحد يومياً' : 'عدة أصحاحات موضوعية'}".

### [قالب المخرجات JSON فقط]
{
  "title": "عنوان ملهم",
  "description": "رسالة قصيرة",
  "duration": "${data.duration} أيام",
  "readings": [
    { "day": 1, "books": ["اسم_السفر رقم_الأصحاح"] }
  ]
}

قائمة الأسفار المتاحة: [${allowedBooks}]
ملاحظة: يجب أن تكون النتيجة JSON صالح فقط وبدون أي نصوص إضافية قبل أو بعد القالب.`;

            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash-lite",
                generationConfig: { temperature: 0.7 }
            });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            if (!responseText) throw new Error("No response from Gemini");

            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Format Error: No JSON found in AI response");

            const parsedPlan = JSON.parse(jsonMatch[0]);

            if (!parsedPlan.readings || !Array.isArray(parsedPlan.readings)) {
                throw new Error("Missing readings in AI response");
            }

            return parsedPlan;
        } catch (e) {
            console.error("Gemini Error:", e);
            return null;
        }
    };

    const handleSubmit = async () => {
        if (loading) return;

        if (!formData.mood.trim() || !formData.duration || !formData.level) {
            toast.error('من فضلك أكمل البيانات أولاً');
            return;
        }

        if (formData.mood.trim().length < 5) {
            toast.error("الوصف قصير جداً، من فضلك اكتب كلمات أكثر.");
            return;
        }

        if (!auth.currentUser) {
            toast.error('يجب تسجيل الدخول أولاً');
            return;
        }

        setLoading(true);

        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const lastGenerated = userData.lastAIGenerated?.toDate();
                const now = new Date();

                if (lastGenerated && (now - lastGenerated) < 30000) {
                    const waitTime = Math.ceil((30000 - (now - lastGenerated)) / 1000);
                    toast.error(`برجاء الانتظار ${waitTime} ثانية.`);
                    setLoading(false);
                    return;
                }
            }

            const rawPlan = await generatePlanWithAI(formData);

            if (rawPlan && rawPlan.readings && rawPlan.readings.length > 0) {
                const plan = cleanPlanData(rawPlan);
                const planId = `ai_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

                await setDoc(userRef, {
                    lastAIGenerated: serverTimestamp(),
                    customPlans: {
                        [planId]: {
                            ...plan,
                            id: planId,
                            type: 'custom',
                            createdAt: new Date().toISOString(),
                            completedDays: {},
                            completionPercentage: 0
                        }
                    }
                }, { merge: true });

                toast.success("تم إنشاء خطتك بنجاح!");
                router.push(`/studyPlans/details?id=${planId}&type=custom`);
            } else {
                throw new Error("فشل الذكاء الاصطناعي في تكوين خطة صحيحة");
            }
        } catch (error) {
            console.error("Submit Error:", error);
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
                    <h2 className={styles.sectionTitle}>جاري تصميم خطتك الروحية...</h2>
                </div>
            )}

            <div className={styles.formCard}>
                <div className={styles.header}>
                    <h1 className={styles.mainTitle}>مُصمم الخطط الذكي</h1>
                    <p>أخبر أجيوس بما يدور في قلبك اليوم</p>
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>بماذا تشعر حالياً؟ أو ما الذي تبحث عنه؟</label>
                    <textarea
                        className={styles.textInput}
                        rows="4"
                        maxLength={500}
                        disabled={loading}
                        placeholder="مثلاً: حاسس اني قلقان من المستقبل.."
                        value={formData.mood}
                        onChange={(e) => handleSelect('mood', e.target.value)}
                    ></textarea>
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>ما هي المدة المفضلة للخطة؟</label>
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
                </div>

                <div className={styles.questionGroup}>
                    <label className={styles.questionLabel}>مستوى القراءة</label>
                    <div className={styles.optionsGrid}>
                        {levels.map(l => (
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
                    {loading ? 'جاري الإنشاء...' : 'إنشاء خطتي الخاصة ✨'}
                </button>
            </div>
        </div>
    );
}