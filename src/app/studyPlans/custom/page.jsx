'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Capacitor } from '@capacitor/core';
import { db } from '../../../lib/firebase';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import styles from './customPlan.module.css';
import { Sparkles, Calendar, BookOpen, Target, Loader2, ArrowRight, BrainCircuit } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "AIzaSyAihaAWbI0BHz6zI6Q5JGNxnMPf0JQmZho";
const genAI = new GoogleGenerativeAI(API_KEY);

export default function CustomStudyPlanPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [userInput, setUserInput] = useState({
        topic: '',
        duration: '7',
        intensity: 'medium'
    });

    const callGemini = async (prompt) => {
        try {
            // استخدام المكتبة الرسمية أولاً (تعمل جيداً مع CapacitorHttp المفعّل)
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (err) {
            console.error("Gemini AI Error (Native):", err);
            // محاولة بديلة عبر fetch المباشر في حالة فشل المكتبة على الموبايل
            if (Capacitor.isNativePlatform()) {
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                const data = await res.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text;
            }
            throw err;
        }
    };

    const generatePlan = async () => {
        if (!userInput.topic.trim()) return toast.error("برجاء إدخال موضوع الخطة");

        setIsLoading(true);
        try {
            const prompt = `أنت مساعد ذكي متخصص في الكتاب المقدس. صمم خطة قراءة مسيحية أرثوذكسية حول: "${userInput.topic}".
            المدة: ${userInput.duration} يوم.
            المستوى: ${userInput.intensity === 'easy' ? 'آية واحدة' : userInput.intensity === 'medium' ? '5-10 آيات' : 'أصحاح كامل'} يومياً.
            يجب أن يكون الرد بصيغة JSON فقط بهذا التنسيق:
            {
              "title": "عنوان الخطة",
              "description": "وصف قصير",
              "days": [
                { "day": 1, "title": "عنوان اليوم", "reference": "اسم السفر رقم الأصحاح:رقم الآية", "thought": "تأمل قصير جداً" }
              ]
            }
            التزم بأسماء الأسفار العربية الرسمية.`;

            const text = await callGemini(prompt);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Invalid response format");

            const planData = JSON.parse(jsonMatch[0]);

            const auth = getAuth();
            const user = auth.currentUser;

            if (user) {
                const planId = `custom_${Date.now()}`;
                const finalPlan = {
                    id: planId,
                    ...planData,
                    startDate: new Date().toISOString(),
                    progress: 0,
                    isCustom: true,
                    isCompleted: false,
                    type: 'custom'
                };

                await updateDoc(doc(db, 'users', user.uid), {
                    'studyPlans.active': arrayUnion(finalPlan),
                    totalPoints: increment(50)
                });

                toast.success("تم إنشاء خطتك المخصصة بنجاح! (+50 نقطة)");
                router.push('/studyPlans');
            } else {
                toast.error("يرجى تسجيل الدخول لحفظ الخطة");
            }
        } catch (error) {
            console.error(error);
            toast.error("فشل الذكاء الاصطناعي في إنشاء الخطة، حاول مرة أخرى");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container} dir="rtl">
            <div className={styles.header}>
                <Sparkles className={styles.sparkleIcon} />
                <h1>مساعد أجيوس الذكي</h1>
                <p>صمم خطة قراءة مخصصة تناسب احتياجك الروحي</p>
            </div>

            <div className={styles.card}>
                {step === 1 && (
                    <div className={styles.step}>
                        <div className={styles.inputGroup}>
                            <label><Target size={18} /> ما هو الموضوع الذي تريد دراسته؟</label>
                            <textarea
                                placeholder="مثلاً: الصبر، محبة الأعداء، حياة الصلاة..."
                                value={userInput.topic}
                                onChange={(e) => setUserInput({...userInput, topic: e.target.value})}
                            />
                        </div>
                        <button className={styles.nextBtn} onClick={() => setStep(2)}>
                            التالي <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className={styles.step}>
                        <div className={styles.inputGroup}>
                            <label><Calendar size={18} /> مدة الخطة (بالأيام)</label>
                            <select
                                value={userInput.duration}
                                onChange={(e) => setUserInput({...userInput, duration: e.target.value})}
                            >
                                <option value="3">3 أيام</option>
                                <option value="7">7 أيام</option>
                                <option value="14">14 يوم</option>
                                <option value="30">30 يوم</option>
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label><BookOpen size={18} /> كمية القراءة اليومية</label>
                            <div className={styles.intensityGrid}>
                                <button
                                    className={userInput.intensity === 'easy' ? styles.active : ''}
                                    onClick={() => setUserInput({...userInput, intensity: 'easy'})}
                                >خفيفة</button>
                                <button
                                    className={userInput.intensity === 'medium' ? styles.active : ''}
                                    onClick={() => setUserInput({...userInput, intensity: 'medium'})}
                                >متوسطة</button>
                                <button
                                    className={userInput.intensity === 'hard' ? styles.active : ''}
                                    onClick={() => setUserInput({...userInput, intensity: 'hard'})}
                                >دسمة</button>
                            </div>
                        </div>
                        <button
                            className={styles.generateBtn}
                            onClick={generatePlan}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <><Loader2 className={styles.spin} /> جاري التصميم...</>
                            ) : (
                                <><BrainCircuit size={20} /> إنشاء الخطة بالذكاء الاصطناعي</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
