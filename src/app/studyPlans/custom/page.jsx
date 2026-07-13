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
import { useLanguage } from '../../context/LanguageContext';

const apiKey = "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ";
const genAI = new GoogleGenerativeAI(apiKey);

export default function CustomPlanForm() {
    const { strings, bookNames, language } = useLanguage();
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
        { id: '3', label: strings.studyPlans.custom.durations['3'] },
        { id: '7', label: strings.studyPlans.custom.durations['7'] },
        { id: '14', label: strings.studyPlans.custom.durations['14'] },
        { id: '30', label: strings.studyPlans.custom.durations['30'] },
        { id: '90', label: strings.studyPlans.custom.durations['90'] },
        { id: '180', label: strings.studyPlans.custom.durations['180'] },
        { id: 'custom', label: strings.studyPlans.custom.durations['custom'] }
    ];

    const intensities = [
        { id: '1', label: strings.studyPlans.custom.intensities['1'] },
        { id: '2', label: strings.studyPlans.custom.intensities['2'] },
        { id: '3', label: strings.studyPlans.custom.intensities['3'] }
    ];

    const handleSelect = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const readLegacyCache = async (newKey, legacyKeys) => {
        try {
            const cached = await kv.get(newKey);
            if (cached) return { cached, legacy: false };
            for (const legacyKey of legacyKeys) {
                const legacyCached = await kv.get(legacyKey);
                if (legacyCached) return { cached: legacyCached, legacy: true };
            }
            return { cached: null, legacy: false };
        } catch (e) {
            console.error('Redis Read Error:', e);
            return { cached: null, legacy: false };
        }
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

            const cacheKey = `${CACHE_KEYS.STUDY_PLAN}${language}:${data.mood.trim().toLowerCase()}:${durationDays}:${data.level}`;
            const legacyKey = `${CACHE_KEYS.STUDY_PLAN}${data.mood.trim().toLowerCase()}:${durationDays}:${data.level}`;
            const { cached, legacy } = await readLegacyCache(cacheKey, [legacyKey]);
            if (cached) {
                if (legacy) {
                    const migrationKey = `${CACHE_KEYS.STUDY_PLAN}ar:${data.mood.trim().toLowerCase()}:${durationDays}:${data.level}`;
                    kv.set(migrationKey, cached).catch(console.error);
                }
                if (language === 'ar') {
                    return cached;
                }
            }

            const allowedBooks = bookNames.map(book => book.name).join(', ');
            const intensityLabel = intensities.find(i => i.id === data.level)?.label || strings.studyPlans.custom.intensities.default;

            const prompts = {
                ar: `أنت هو "أجيوس"، خبير الإرشاد الروحي واللاهوتي. مهمتك هي صياغة رحلة قراءة كتابية مخصصة تلمس أعماق احتياج المستخدم.

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
3. إذا كان الموضوع متخصصاً جداً، ابدأ به ثم توسع لأسفار ومفاهيم روحية مرتبطة لضمان اكتمال الخطة بجودة عالية.
`,
                en: `You are "Agios", a spiritual and theological guide. Your task is to create a personalized Bible reading journey that fits the user's need.

### [State Data]
- User input: "${data.mood}"
- Plan duration: "${durationDays}" days.
- Intensity: "${intensityLabel}"

### [Output JSON only]
{
  "title": "Inspiring title",
  "description": "A short encouraging message based on the user's state",
  "duration": "${durationDays} days",
  "readings": [
    { "day": 1, "books": ["Book_Name Chapter_Number"] }
  ]
}

Available books list: [${allowedBooks}]
Important note:
1. The result must be valid JSON only with no extra text.
2. The readings array must contain exactly ${durationDays} objects.
3. If the topic is very specific, start there then expand to related spiritual books and concepts to ensure a high-quality plan.
`,
                fr: `Vous êtes "Agios", un guide spirituel et théologique. Votre tâche est de créer un voyage de lecture biblique personnalisé adapté au besoin de l'utilisateur.

### [Données d'état]
- Entrée utilisateur : "${data.mood}"
- Durée du plan : "${durationDays}" jours.
- Intensité : "${intensityLabel}"

### [JSON de sortie seulement]
{
  "title": "Titre inspirant",
  "description": "Un court message encourageant basé sur l'état de l'utilisateur",
  "duration": "${durationDays} jours",
  "readings": [
    { "day": 1, "books": ["Nom_du_livre Numéro_du_chapitre"] }
  ]
}

Liste des livres disponibles : [${allowedBooks}]
Note importante :
1. Le résultat doit être un JSON valide uniquement sans texte supplémentaire.
2. Le tableau readings doit contenir exactement ${durationDays} objets.
3. Si le sujet est très spécifique, commencez par là puis élargissez aux livres et concepts spirituels liés pour garantir un plan de haute qualité.
`,
                de: `Du bist "Agios", ein spiritueller und theologischer Führer. Deine Aufgabe ist es, eine personalisierte Bibellesereise zu erstellen, die den Bedarf des Benutzers erfüllt.

### [Statusdaten]
- Benutzereingabe: "${data.mood}"
- Planlänge: "${durationDays}" Tage.
- Intensität: "${intensityLabel}"

### [Nur JSON-Ausgabe]
{
  "title": "Inspirierender Titel",
  "description": "Eine kurze ermutigende Nachricht basierend auf dem Zustand des Benutzers",
  "duration": "${durationDays} Tage",
  "readings": [
    { "day": 1, "books": ["Buchname Kapitelnummer"] }
  ]
}

Verfügbare Bücherliste: [${allowedBooks}]
Wichtiger Hinweis:
1. Das Ergebnis muss gültiges JSON sein, ohne zusätzlichen Text.
2. Das readings-Array muss genau ${durationDays} Objekte enthalten.
3. Wenn das Thema sehr spezifisch ist, beginne damit und erweitere dann على verwandte spirituelle Bücher und Konzepte, um einen hochwertigen Plan zu gewährleisten.
`
            };

            const prompt = prompts[language] || prompts.en;

            const model = genAI.getGenerativeModel({
                model: "gemini-3.1-flash-lite",
                generationConfig: { temperature: 0.7 }
            });

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Format Error");

            const planResult = JSON.parse(jsonMatch[0]);

            try {
                await kv.set(cacheKey, planResult);
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
            toast.error(strings.studyPlans.custom.error_incomplete);
            return;
        }

        if (formData.duration === 'custom') {
            if (!formData.customDays || actualDuration <= 0) {
                toast.error(strings.studyPlans.custom.error_duration);
                return;
            }
            if (actualDuration > 180) {
                toast.error(strings.studyPlans.custom.error_duration_max);
                return;
            }
        }

        if (formData.mood.trim().length < 10) {
            toast.error(strings.studyPlans.custom.error_mood_short);
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
                    completionPercentage: 0,
                    language: language
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
        }
    };

    return (
        <div className={styles.container}>
            {loading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <h2 className={styles.sectionTitle}>{strings.studyPlans.custom.loading_title}</h2>
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
                            <p className={styles.limitHint}>{strings.studyPlans.custom.duration_limit_hint}</p>
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
                                    <span className={styles.checkboxLabel}>{strings.studyPlans.custom.author_check}</span>
                                </label>
                                {formData.showAuthor && (
                                    <div className={styles.authorPreview}>
                                        <User size={14} /> {strings.studyPlans.custom.author_preview.replace('{name}', userData?.displayName || strings.studyPlans.custom.author_default)}
                                    </div>
                                )}
                            </div>
                        )}
                        {formData.isShared && !user && (
                            <p className={styles.authHint}>{strings.studyPlans.custom.guest_hint}</p>
                        )}
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
