'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment, arrayUnion, deleteField } from "firebase/firestore";
import { db } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { toast, Toaster } from 'react-hot-toast';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
    Book, Map, Search, User, Trophy,
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

    // مزامنة ملخص الخطط الدراسية للإشعارات (فقط للمسجلين)
    useEffect(() => {
        if (user && startedPlans.length > 0) {
            const summary = {
                count: startedPlans.length,
                mainPlanTitle: startedPlans[0].title,
                remainingDays: startedPlans[0].stats.totalDays - startedPlans[0].stats.daysDone
            };
            localStorage.setItem('studyPlansSummary', JSON.stringify(summary));
            if (Capacitor.isNativePlatform()) {
                import('../lib/notificationService').then(m => m.syncNotifications());
            }
        } else {
            localStorage.removeItem('studyPlansSummary');
        }
    }, [startedPlans, user]);

    const handleOptionClick = async (index) => {
        if (!user) {
            router.push('/intro');
            return;
        }
        if (hasAnswered || !dailyQuestion) return;

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
        if (!user) {
            router.push('/intro');
            return;
        }
        if (!dailyVerse) return;

        const verseKey = `daily-verse-${dailyVerse.month}-${dailyVerse.day}-ar`;
        const userRef = doc(db, 'users', user.uid);
        let newFavs = { ...favouriteVerses };

        if (newFavs[verseKey]) {
            delete newFavs[verseKey];
            setFavouriteVerses(newFavs);
            await updateDoc(userRef, { [`favorites.verses.${verseKey}`]: deleteField() });
            toast.error('تم الحذف من كنوزك');
        } else {
            const cleanRef = dailyVerse.reference.replace(/[()]/g, '').trim();
            const convertNumbers = (str) => {
                if (!str) return "";
                return str.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d]/g, '');
            };
            const parts = cleanRef.split(' ');
            const rawNumbers = parts[parts.length - 1];
            const bookName = parts.slice(0, -1).join(' ');
            const [rawCh, rawV] = rawNumbers.split(':');
            const verseData = {
                text: dailyVerse.verse,
                reference: cleanRef,
                book: bookName,
                ch: convertNumbers(rawCh),
                v: convertNumbers(rawV),
                color: '#FFC107',
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
        { name: 'الكتاب المقدس', icon: <Book />, path: '/bible', color: '#6366f1' },
        { name: 'الخرائط', icon: <Map />, path: user ? '/maps' : '/intro', color: '#10b981' },
        { name: 'البحث', icon: <Search />, path: user ? '/search' : '/intro', color: '#f59e0b' },
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
                    onClick={() => {
                        if (!user) {
                            router.push('/intro');
                            return;
                        }
                        router.push(`/bible?book=${encodeURIComponent(lastRead.bookName)}&chapter=${lastRead.chapterIndex + 1}`)
                    }}
                    className={styles.lastReadBar}
                >
                    <div className={styles.lastReadContent}>
                        <ChevronLeft size={18} />
                        <div className={styles.lastReadText}>
                            <small>واصل القراءة</small>
                            <strong>{lastRead.bookName} - إصحاح {lastRead.chapterIndex + 1}</strong>
                        </div>
                    </div>
                    <div className={styles.lastReadIcon}><Book size={20} /></div>
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
                                    if (!user) { router.push('/intro'); return; }
                                    navigator.clipboard.writeText(`"${dailyVerse?.verse}" (${dailyVerse?.reference})`);
                                    toast.success('تم النسخ');
                                }} className={`${styles.glassBtn} ${styles.copyBtn}`}>نسخ</button>
                                <button onClick={toggleFavorite} className={`${styles.glassBtn} ${favouriteVerses[`daily-verse-${dailyVerse?.month}-${dailyVerse?.day}-ar`] ? styles.activeFav : ''}`}>
                                    {favouriteVerses[`daily-verse-${dailyVerse?.month}-${dailyVerse?.day}-ar`] ? '⭐ مضافة' : '⭐ مفضلة'}
                                </button>
                                <ShareVerseCard
                                    verse={dailyVerse?.verse}
                                    reference={dailyVerse?.reference}
                                    book={dailyVerse?.book}
                                />
                            </div>
                        </>
                    )}

                    <div className={styles.bottomDivider} style={{margin: '20px 0', opacity: 0.1, height: '1px', background: 'var(--color-text-primary)'}} />

                    {dailyQuestion && (
                        <div className={styles.questionSection}>
                            <div className={styles.glassHeader}>
                                <Trophy size={18} color="#f59e0b" />
                                <span>تحدي اليوم</span>
                            </div>
                            <p className={styles.questionTitle} style={{fontWeight: '700', marginBottom: '12px'}}>{dailyQuestion.question}</p>
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