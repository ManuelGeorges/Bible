'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment, arrayUnion } from "firebase/firestore";
import { db } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { toast, Toaster } from 'react-hot-toast';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
    BookOpen, Map, Search, User, Trophy,
    Settings, Heart, BookMarked, Sparkles,
    ChevronLeft, Award, Flame, LogIn, ArrowRight
} from 'lucide-react';
import ShareVerseCard from '../components/ShareVerseCard';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;
const staticPlans = studyPlansData.plans;

const LandingPage = () => {
    const router = useRouter();
    const [activePlanIndex, setActivePlanIndex] = useState(0);
    const [dailyVerse, setDailyVerse] = useState(null);
    const [dailyQuestion, setDailyQuestion] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [startedPlans, setStartedPlans] = useState([]);
    const [user, setUser] = useState(null);
    const [userStats, setUserStats] = useState({ points: 0, streak: 0 });
    const [userBadges, setUserBadges] = useState([]);
    const [favouriteVerses, setFavouriteVerses] = useState({});
    const [lastRead, setLastRead] = useState(null);

    const calculatePlanStats = useCallback((planId, isCustom, customPlanData, serverCompletion) => {
        let completedDays = {};
        let totalDays = 0;

        if (isCustom && customPlanData) {
            completedDays = customPlanData.completedDays || {};
            totalDays = customPlanData.readings?.length || 0;
        } else {
            const plan = staticPlans.find(p => p.id === planId);
            totalDays = plan?.readings?.length || 0;
            completedDays = serverCompletion?.[planId]?.completedDays || {};
        }

        const daysDone = Object.values(completedDays).filter(d => d.isCompleted || d === true).length;
        const percent = totalDays > 0 ? Math.round((daysDone / totalDays) * 100) : 0;

        return { daysDone, totalDays, percent };
    }, []);

    const fetchDailyContent = useCallback(async (loggedInUser) => {
        const now = new Date();
        const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        try {
            const [verseRes, questRes] = await Promise.all([
                fetch('/data/dailyVerses.json'),
                fetch('/data/dailyQuestions.json')
            ]);

            const verseData = await verseRes.json();
            const questData = await questRes.json();

            setDailyVerse(verseData.find(v => v.month === now.getMonth() + 1 && v.day === now.getDate()));
            setDailyQuestion(questData.find(q => q.month === now.getMonth() + 1 && q.day === now.getDate()));

            let answered = localStorage.getItem(`questionAnswered_${dateKey}`) === 'true';
            if (loggedInUser) {
                const userSnap = await getDoc(doc(firestore, 'users', loggedInUser.uid));
                if (userSnap.exists() && userSnap.data().answeredQuestions?.[dateKey]?.answered) {
                    answered = true;
                }
            }
            setHasAnswered(answered);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) CapacitorUpdater.notifyAppReady();

        const unsubAuth = auth?.onAuthStateChanged((u) => {
            setUser(u);
            fetchDailyContent(u);
            if (u) {
                const unsubSnap = onSnapshot(doc(firestore, 'users', u.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserStats({ points: data.totalPoints || 0, streak: data.streak || 0 });
                        setUserBadges(data.badges || []);
                        setFavouriteVerses(data.favorites?.verses || {});
                        setLastRead(data.lastRead || JSON.parse(localStorage.getItem('lastReadLocation')));

                        const serverComp = data.completedPlans || {};
                        const customPlans = data.customPlans || {};

                        const activeStatic = staticPlans.map(plan => {
                            const stats = calculatePlanStats(plan.id, false, null, serverComp);
                            return { ...plan, stats };
                        }).filter(p => p.stats.daysDone > 0 && p.stats.percent < 100);

                        const activeCustom = Object.values(customPlans).map(plan => {
                            const stats = calculatePlanStats(plan.id, true, plan, null);
                            return { ...plan, isCustom: true, stats };
                        }).filter(p => p.stats.daysDone > 0 && p.stats.percent < 100);

                        setStartedPlans([...activeCustom, ...activeStatic]);
                    }
                });
                return () => unsubSnap();
            } else {
                setStartedPlans([]);
            }
        });

        return () => unsubAuth?.();
    }, [fetchDailyContent, calculatePlanStats]);
    const handleScroll = (e) => {
        const container = e.target;
        const scrollLeft = Math.abs(container.scrollLeft);
        const cardWidth = container.offsetWidth * 0.8;
        const newIndex = Math.round(scrollLeft / cardWidth);

        if (newIndex !== activePlanIndex) {
            setActivePlanIndex(newIndex);
        }
    };
    const handleOptionClick = async (index) => {
        if (hasAnswered || !dailyQuestion || !user) return;
        const now = new Date();
        const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        setSelectedAnswer(index);
        setHasAnswered(true);
        localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
        const isCorrect = index === dailyQuestion.answerIndex;

        const userRef = doc(firestore, 'users', user.uid);
        const updatePayload = {
            [`answeredQuestions.${dateKey}`]: { answered: true, correct: isCorrect, timestamp: new Date().toISOString() }
        };

        if (isCorrect) {
            toast.success('إجابة صحيحة! 🎉');
            await updateDoc(userRef, { ...updatePayload, totalPoints: increment(20), correctAnswersCount: increment(1) });
        } else {
            toast.error('إجابة خاطئة 😔');
            await updateDoc(userRef, updatePayload);
        }
    };

    const toggleFavorite = async () => {
        if (!dailyVerse || !user) return;

        // التأكد من استخدام نفس نمط الـ ID المستخدم في التطبيق
        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        const userRef = doc(db, 'users', user.uid);
        let newFavs = { ...favouriteVerses };

        if (newFavs[verseKey]) {
            // حالة الحذف
            delete newFavs[verseKey];
            setFavouriteVerses(newFavs); // تحديث الواجهة فوراً

            await updateDoc(userRef, {
                [`favorites.verses.${verseKey}`]: deleteField()
            });
            toast.error('تم الحذف من كنوزك');
        } else {
            // حالة الإضافة - إضافة البيانات التي تتوقعها صفحة Favourites
            const verseData = {
                text: dailyVerse.verse,
                // قمنا بتقسيم المرجع أو إرساله بشكل يتوافق مع صفحة الـ Favourites
                reference: dailyVerse.reference,
                book: dailyVerse.book || "آية اليوم",
                ch: dailyVerse.chapter || 0,
                v: dailyVerse.verseNumber || 0,
                color: '#FFC107', // إعطاء لون افتراضي ليتم قراءته في الفلتر
                dateAdded: new Date().toISOString()
            };

            newFavs[verseKey] = verseData;
            setFavouriteVerses(newFavs);

            await updateDoc(userRef, {
                totalPoints: increment(5),
                [`favorites.verses.${verseKey}`]: verseData
            });
            toast.success('تمت الإضافة لكنوزك (+5 نقاط)');
        }
    };

    const quickLinks = [
        { name: 'الكتاب المقدس', icon: <BookOpen />, path: '/bible', color: '#6366f1' },
        { name: 'الخرائط', icon: <Map />, path: '/maps', color: '#10b981' },
        { name: 'البحث', icon: <Search />, path: '/search', color: '#f59e0b' },
        { name: 'الخطط الدراسية', icon: <BookMarked />, path: user ? '/studyPlans' : '/intro', color: '#ec4899' },
        { name: 'المسابقات', icon: <Trophy />, path: user ? '/competitions' : '/intro', color: '#8b5cf6' },
        { name: 'المفضلة', icon: <Heart />, path: user ? '/favourites' : '/intro', color: '#ef4444' },
    ];

    return (
        <main className={`${styles.hubContainer} ${styles.rtl}`}>
            <Toaster position="bottom-center" />

            <header className={styles.header}>
                <div className={styles.topBar}>
                    <div className={styles.welcomeInfo}>
                        <h1 className={styles.siteTitle}>Agios Bible</h1>
                        <p className={styles.userGreeting}>
                            {user ? `أهلاً، ${user.displayName?.split(' ')[0] || 'بك'}` : 'أهلاً بك في رحلتك'}
                        </p>
                    </div>
                    <div className={styles.topActions}>
                        <Link href={user ? "/points" : "/intro"} className={styles.iconCircle}><Award size={20} /></Link>
                        <Link href={user ? "/profile" : "/intro"} className={styles.iconCircle}><User size={20} /></Link>
                        <Link href="/settings" className={styles.iconCircle}><Settings size={20} /></Link>
                    </div>
                </div>

                {user && (
                    <div className={styles.statsRow}>
                        <Link href="/points" className={styles.statPill}>
                            <Award size={16} />
                            <span>{userStats.points} XP</span>
                        </Link>
                        <div className={styles.statPill}>
                            <Flame size={16} color="#ff4500" />
                            <span>{userStats.streak} يوم</span>
                        </div>
                        <div className={styles.badgeList}>
                            {userBadges.slice(0, 3).map((b, i) => <span key={i} className={styles.miniBadge}>🏅</span>)}
                        </div>
                    </div>
                )}
            </header>

            <section className={styles.quickGrid}>
                {quickLinks.map((link, i) => (
                    <Link href={link.path} key={i} className={styles.hubCard}>
                        <div className={styles.hubIcon} style={{ color: link.color, backgroundColor: `${link.color}15` }}>
                            {link.icon}
                        </div>
                        <span className={styles.hubName}>{link.name}</span>
                    </Link>
                ))}
            </section>

            {lastRead && (
                <button
                    onClick={() => router.push(`/bible?book=${encodeURIComponent(lastRead.bookName)}&chapter=${lastRead.chapterIndex + 1}`)}
                    className={styles.lastReadBar}
                >
                    <div className={styles.lastReadContent}>
                        <ChevronLeft size={18} />
                        <div className={styles.lastReadText}>
                            <small>واصل القراءة</small>
                            <strong>{lastRead.bookName} - إصحاح {lastRead.chapterIndex + 1}</strong>
                        </div>
                    </div>
                    <div className={styles.lastReadIcon}><BookOpen size={20} /></div>
                </button>
            )}

            <section className={styles.dailyHighlight}>
                <div className={styles.verseGlass}>
                    <div className={styles.glassHeader}>
                        <Sparkles size={18} color="#ffd700" />
                        <span>آية اليوم</span>
                    </div>
                    {isLoading ? <div className={styles.skeletonText} /> : (
                        <>
                            <p className={styles.verseText}>"{dailyVerse?.verse}"</p>
                            <span className={styles.verseRef}>{dailyVerse?.reference}</span>
                            <div className={styles.verseActions}>
                                <button onClick={() => {
                                    navigator.clipboard.writeText(`"${dailyVerse?.verse}" (${dailyVerse?.reference})`);
                                    toast.success('تم النسخ');
                                }} className={styles.glassBtn}>نسخ</button>
                                <button onClick={toggleFavorite} className={`${styles.glassBtn} ${favouriteVerses[`daily-verse-${dailyVerse?.month}-${dailyVerse?.day}-ar`] ? styles.activeFav : ''}`}>
                                    {favouriteVerses[`daily-verse-${dailyVerse?.month}-${dailyVerse?.day}-ar`] ? '⭐ مضافة' : '⭐ مفضلة'}
                                </button>
                                <ShareVerseCard
                                    verse={dailyVerse.verse}
                                    reference={dailyVerse.reference}
                                    book={dailyVerse.book}
                                />
                            </div>
                        </>
                    )}
                </div>
            </section>

            {startedPlans.length > 0 && (
                <section className={styles.startedPlansSection}>
                    <h2 className={styles.sectionTitle}>خططك الجارية</h2>
                    <div className={styles.plansVerticalList}>
                        {startedPlans.map((plan) => (
                            <button
                                key={plan.id}
                                onClick={() => router.push(`/studyPlans/details?id=${plan.id}${plan.isCustom ? '&type=custom' : ''}`)}
                                className={styles.planProgressCardVertical}
                            >
                                <div className={styles.planInfo}>
                                    <div className={styles.planNameRow}>
                                        <span className={styles.planTitle}>{plan.title}</span>
                                        <span className={styles.planPercent}>{plan.stats?.percent}%</span>
                                    </div>

                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${plan.stats?.percent}%` }} />
                                    </div>

                                    <div className={styles.planMeta}>
                                        <span>يوم {plan.stats?.daysDone} من {plan.stats?.totalDays}</span>
                                        <div className={styles.planActionText}>
                                            واصل القراءة <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {dailyQuestion && (
                <section className={styles.questionSection}>
                    <h2 className={styles.sectionTitle}>تحدي اليوم</h2>
                    <div className={styles.questionCard}>
                        <p className={styles.questionTitle}>{dailyQuestion.question}</p>
                        <div className={styles.optionsList}>
                            {dailyQuestion.options.map((opt, i) => (
                                <button
                                    key={i}
                                    disabled={hasAnswered}
                                    onClick={() => handleOptionClick(i)}
                                    className={`${styles.optBtn} ${hasAnswered && i === dailyQuestion.answerIndex ? styles.correct : ''} ${hasAnswered && selectedAnswer === i && i !== dailyQuestion.answerIndex ? styles.wrong : ''}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {!user && (
                <div className={styles.guestBanner}>
                    <LogIn size={24} />
                    <div className={styles.guestText}>
                        <h3>سجل الآن</h3>
                        <p>احفظ تقدمك ونافس أصدقاءك</p>
                    </div>
                    <Link href="/intro" className={styles.loginLink}>دخول</Link>
                </div>
            )}
        </main>
    );
};

export default LandingPage;