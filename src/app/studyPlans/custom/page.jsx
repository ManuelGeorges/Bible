'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, auth } from '../../../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import styles from './customPlan.module.css';
import toast from 'react-hot-toast';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

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
            books: reading.books.map(book =>
                book.replace(/إنجيل\s+/g, '').replace(/سفر\s+/g, '').trim()
            )
        }));
        return { ...plan, readings: cleanedReadings };
    };

    const generatePlanWithAI = async (data) => {
        try {
            const response = await fetch('/data/bookNames.json');
            const bookNamesData = await response.json();
            const allowedBooks = bookNamesData.ar.map(book => book.name).join(', ');

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const prompt = `أنت هو "أجيوس"، خبير الإرشاد الروحي واللاهوتي. مهمتك هي صياغة رحلة قراءة كتابية مخصصة تلمس أعماق احتياج المستخدم.

### [بيانات الحالة]
- مدخلات المستخدم (المشاعر/الظروف): "${data.mood}"
- مدة البرنامج: "${data.duration}" أيام.
- الكثافة القرائية: "${data.level === 'beginner' ? 'تركيز عالٍ على أصحاح واحد يومياً' : 'ربط موضوعي بين عدة أصحاحات يومياً'}".

### [خوارزمية العمل]
1. التحليل النفس-روحي: حلل بعمق ما وراء كلمات المستخدم ("${data.mood}").
2. الانتقاء الموضوعي: اختر حصرياً من القائمة أدناه النصوص التي تخاطب هذا الاحتياج الجوهري.
3. الصياغة الوجدانية: اكتب العنوان والوصف بلهجة مشجعة ودافئة.

### [قائمة الأسفار المتاحة]
[${allowedBooks}]

### [قواعد الاستجابة التقنية]
1. الرد JSON صالح فقط.
2. الالتزام بأسماء الأسفار تماماً.
3. مصفوفة "books" عناصر مستقلة بدون شرطات.
4. إذا كانت المدخلات مسيئة، صمم خطة تدعو للسلام والحكمة بشكل عام.

### [قالب المخرجات]
{
  "title": "عنوان ملهم",
  "description": "رسالة شخصية قصيرة",
  "duration": "${data.duration} أيام",
  "readings": [
    {
      "day": 1,
      "books": ["اسم_السفر رقم_الأصحاح"]
    }
  ]
}

تذكر: أنت تقدم دواءً روحياً مخصصاً.`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const firstBrace = responseText.indexOf('{');
            const lastBrace = responseText.lastIndexOf('}');

            if (firstBrace === -1 || lastBrace === -1) throw new Error("Format Error");

            const jsonString = responseText.substring(firstBrace, lastBrace + 1);
            return JSON.parse(jsonString);
        } catch (e) {
            console.error("Gemini Error:", e);
            return null;
        }
    };

    const handleSubmit = async () => {
        if (loading) return;

        const badWords = ["خول", "عرص", "طيز", "كس", "زبي", "قحبة", "شرموطة", "متناك", "مخنث", "لواط", "سحاق", "سكس"];
        const isBad = badWords.some(word => formData.mood.includes(word));

        if (isBad) {
            toast.error("من فضلك استخدم لغة لائقة تعبر عن احتياجك الروحي.");
            return;
        }

        if (formData.mood.trim().length < 10) {
            toast.error("وصفك قصير جداً، من فضلك اكتب كلمات أكثر.");
            return;
        }

        if (!formData.mood.trim() || !formData.duration || !formData.level) {
            toast.error('من فضلك أكمل البيانات أولاً');
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
                
                if (lastGenerated && (now - lastGenerated) < 60000) {
                    const waitTime = Math.ceil((60000 - (now - lastGenerated)) / 1000);
                    toast.error(`برجاء الانتظار ${waitTime} ثانية قبل إنشاء خطة جديدة.`);
                    setLoading(false);
                    return;
                }

                const existingPlans = Object.keys(userData.customPlans || {}).length;
                if (existingPlans >= 10) {
                    toast.error("لقد وصلت للحد الأقصى (10 خطط). يرجى حذف خطة قديمة أولاً.");
                    setLoading(false);
                    return;
                }
            }

            const rawPlan = await generatePlanWithAI(formData);

            if (rawPlan && rawPlan.readings) {
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

                toast.success("تم إنشاء خطتك الروحية بنجاح!");
                router.push(`/studyPlans/details?id=${planId}&type=custom`);
            } else {
                throw new Error("Invalid Plan Structure");
            }
        } catch (error) {
            console.error("Submit Error:", error);
            toast.error('حدث خطأ أثناء إنشاء الخطة. حاول مرة أخرى.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            {loading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <h2 className={styles.sectionTitle}>جاري تصميم خطتك الروحية...</h2>
                    <p className={styles.secondaryText}>نحلل كلماتك لنختار لك أنسب الأصحاحات</p>
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
                    <p className={styles.charCount}>{formData.mood.length}/500</p>
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