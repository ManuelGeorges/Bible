'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';
import studyPlansData from './studyPlans/studyPlansData.json';
import Link from 'next/link';
import { getAuth } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc, increment, arrayUnion, deleteField } from "firebase/firestore";
import { db, getFirebaseRemoteConfig } from '../lib/firebase';
import { fetchAndActivate, getValue } from "firebase/remote-config";
import { Capacitor } from '@capacitor/core';
import { toast } from 'react-hot-toast';
import {
    BookOpenText, Map, Search, User, Trophy,
    Settings, Heart, BookMarked, Sparkles,
    ChevronLeft, Award, Flame, LogIn, ArrowRight,
    CheckCircle, Circle, ArrowUpRight, Bell, 
    Image as ImageIcon, Info, Star, Gift, Megaphone,
    MessageCircle, Zap, Globe, Shield, Calendar,
    Bot, Brain, Cpu, Wand2, Lightbulb, Rocket,
    RefreshCw, History, Share2, ThumbsUp, Users,
    Lock, Unlock, Camera, Mail, Link as LinkIcon,
    ExternalLink, ShieldCheck, QrCode, BookOpen,
    Scroll, Languages, PartyPopper, Mic, Headphones,
    Video, Music, Church, Sun, Moon, Cloud, Target, MapPin, BrainCircuit
} from 'lucide-react';
import ShareVerseCard from '../components/ShareVerseCard';
import Badge from '../components/Badge/Badge';
import { useBadge } from './context/BadgeContext';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;
const staticPlans = studyPlansData.plans;

const LUCIDE_ICONS = {
    'Trophy': Trophy, 'Award': Award, 'Medal': Award, 'Gift': Gift, 'Star': Star, 'Heart': Heart,
    'Bell': Bell, 'Info': Info, 'Megaphone': Megaphone, 'Message': MessageCircle, 'Announcement': Megaphone,
    'Bot': Bot, 'AI': Sparkles, 'Brain': Brain, 'Cpu': Cpu, 'Wand': Wand2, 'Magic': Wand2, 'Lightbulb': Lightbulb, 'Idea': Lightbulb,
    'Rocket': Rocket, 'Update': RefreshCw, 'New': Sparkles, 'History': History, 'Zap': Zap, 'Flash': Zap, 'Party': PartyPopper,
    'BookOpenText': BookOpenText, 'Bible': BookOpen, 'BookOpen': BookOpen, 'Scroll': Scroll, 'Church': Church, 'Pray': Heart,
    'Map': Map, 'Search': Search, 'Settings': Settings, 'Globe': Globe, 'Shield': Shield, 'Verified': ShieldCheck,
    'Calendar': Calendar, 'Camera': Camera, 'Mail': Mail, 'Link': LinkIcon, 'External': ExternalLink,
    'Lock': Lock, 'Unlock': Unlock, 'QrCode': QrCode, 'Translate': Languages, 'Mic': Mic,
    'Users': Users, 'People': Users, 'Like': ThumbsUp, 'Share': Share2, 'Music': Music, 'Video': Video, 'Headphones': Headphones,
    'Sun': Sun, 'Moon': Moon, 'Cloud': Cloud, 'Flame': Flame, 'Fire': Flame, 'Target': Target, 'MapPin': MapPin, 'BrainCircuit': BrainCircuit
};

const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d] || d).join('');
};

// وظائف مساعدة لتوحيد التوقيت على توقيت القاهرة
const getCairoDateInfo = (date = new Date()) => {
    // حل مشكلة التواريخ في iOS عبر استخراج المكونات يدوياً
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value);

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');

    return {
        year,
        month,
        day,
        key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
};

const getCairoDate = (date = new Date()) => getCairoDateInfo(date).key;

const getCairoYesterday = () => {
    const now = new Date();
    // تقليل يوم واحد مع مراعاة التوقيت
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return getCairoDate(yesterday);
};

const LandingPage = () => {
    const router = useRouter();
    const { triggerBadgeUnlock } = useBadge();
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
    const [dailyGoals, setDailyGoals] = useState([]);
    const [remoteNews, setRemoteNews] = useState([]);
    const [activeNewsIndex, setActiveNewsIndex] = useState(0);
    const [badgesData, setBadgesData] = useState(null);
    const [rawUserData, setRawUserData] = useState(null);

    const unlockBadge = async (badgeId) => {
        if (!user) return;
        try {
          const userRef = doc(firestore, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const currentBadges = userSnap.data()?.badges || [];
          if (!currentBadges.includes(badgeId)) {
            await updateDoc(userRef, { badges: arrayUnion(badgeId) });
            triggerBadgeUnlock(badgeId);
          }
        } catch (e) { console.error(e); }
    };

    const calculatePlanStats = useCallback((planOrId, isCustom, customPlanData, serverCompletion) => {
        let completedDays = {};
        let totalDays = 0;

        if (isCustom && customPlanData) {
            completedDays = customPlanData.completedDays || {};
            totalDays = customPlanData.readings?.length || 0;
        } else {
            const plan = typeof planOrId === 'object' ? planOrId : staticPlans.find(p => p.id === planOrId);
            totalDays = plan?.readings?.length || 0;
            const planId = plan?.id || planOrId;
            completedDays = serverCompletion?.[planId]?.completedDays || {};
        }

        const daysDone = Object.values(completedDays).filter(d => d.isCompleted || d === true).length;
        const percent = totalDays > 0 ? Math.round((daysDone / totalDays) * 100) : 0;

        return { daysDone, totalDays, percent };
    }, []);

    const fetchDailyContent = useCallback(async (loggedInUser) => {
        setIsLoading(true);
        const { month, day, key: dateKey } = getCairoDateInfo();

        try {
            // استخدام مسارات نسبية لضمان عملها في Capacitor iOS
            const [verseRes, questRes] = await Promise.all([
                fetch('./data/dailyVerses.json'),
                fetch('./data/dailyQuestions.json')
            ]);

            if (!verseRes.ok || !questRes.ok) throw new Error("Data files not found");

            const verseData = await verseRes.json();
            const questData = await questRes.json();

            const todayVerse = verseData.find(v => Number(v.month) === month && Number(v.day) === day);
            const todayQuest = questData.find(q => Number(q.month) === month && Number(q.day) === day);

            setDailyVerse(todayVerse);
            setDailyQuestion(todayQuest);

            let answered = localStorage.getItem(`questionAnswered_${dateKey}`) === 'true';
            if (loggedInUser) {
                const userSnap = await getDoc(doc(firestore, 'users', loggedInUser.uid));
                if (userSnap.exists() && userSnap.data().answeredQuestions?.[dateKey]?.answered) {
                    answered = true;
                }
            }
            setHasAnswered(answered);
        } catch (e) {
            console.error("Home Fetch Error:", e);
            toast.error("حدث خطأ أثناء تحميل بيانات اليوم");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch('/data/badges.json').then(res => res.json()).then(data => setBadgesData(data));
    }, []);

    useEffect(() => {
        const fetchRemoteConfig = async () => {
            try {
                const config = await getFirebaseRemoteConfig();
                if (config) {
                    config.settings.minimumFetchIntervalMillis = 3600000;
                    await fetchAndActivate(config);

                    const newsJson = getValue(config, 'app_news').asString();
                    if (newsJson && newsJson.trim() !== "") {
                        const parsed = JSON.parse(newsJson);
                        if (Array.isArray(parsed)) {
                            setRemoteNews(parsed.filter(n => n.active));
                        } else if (parsed && parsed.active) {
                            setRemoteNews([parsed]);
                        }
                    }
                }
            } catch (err) {
                console.error("Remote Config Fetch Failed.");
            }
        };
        fetchRemoteConfig();
    }, []);

    const handleNewsScroll = (e) => {
        const scrollLeft = Math.abs(e.target.scrollLeft);
        const itemWidth = e.target.offsetWidth * 0.9;
        if (itemWidth <= 0) return;
        const index = Math.round(scrollLeft / itemWidth);
        if (!isNaN(index) && index !== activeNewsIndex) {
            setActiveNewsIndex(index);
        }
    };

    useEffect(() => {

        let unsubSnap = null;
        const unsubAuth = auth?.onAuthStateChanged((u) => {
            setUser(u);
            fetchDailyContent(u);

            if (unsubSnap) {
                unsubSnap();
                unsubSnap = null;
            }

            if (u) {
                unsubSnap = onSnapshot(doc(firestore, 'users', u.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setRawUserData(data);
                        const streak = data.streak || 0;
                        setUserStats({ points: data.totalPoints || 0, streak: streak });

                        // مزامنة الستريك مع تطبيق الأندرويد للاشعارات
                        if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateUserStats) {
                            window.AgiosScannerNative.updateUserStats(streak);
                        }

                        setUserBadges(data.badges || []);
                        setFavouriteVerses(data.favorites?.verses || {});

                        const lastReadData = data.lastRead || JSON.parse(localStorage.getItem('lastReadLocation'));
                        setLastRead(lastReadData);

                        const serverComp = data.completedPlans || {};
                        const customPlans = data.customPlans || {};

                        const activeStatic = staticPlans
                            .map(plan => {
                                const stats = calculatePlanStats(plan, false, null, serverComp);
                                return { ...plan, stats };
                            })
                            .filter(p => p.stats.daysDone >= 1 && p.stats.percent < 100);

                        const activeCustom = Object.values(customPlans)
                            .map(plan => {
                                const stats = calculatePlanStats(plan, true, plan, null);
                                return { ...plan, isCustom: true, stats };
                            })
                            .filter(p => p.stats.daysDone >= 1 && p.stats.percent < 100);

                        setStartedPlans([...activeCustom, ...activeStatic]);

                        const today = getCairoDate();
                        const historyRaw = data.pointsHistory || [];
                        const history = Array.isArray(historyRaw) ? historyRaw : Object.values(historyRaw);

                        const completedTodayTypes = new Set(
                            history.filter(h => {
                                if (!h.timestamp) return false;
                                const ts = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
                                return getCairoDate(ts) === today;
                            }).map(h => h.type)
                        );

                        const goals = [
                            { id: 'dailyLogin', label: 'تسجيل الدخول', completed: data.lastActiveDate === today },
                            { id: 'dailyQuestion', label: 'سؤال التحدي', completed: !!data.answeredQuestions?.[today]?.answered },
                            { id: 'mapExploration', label: 'استكشاف الخريطة', completed: completedTodayTypes.has('mapExploration') },
                            { id: 'share', label: 'المشاركة اليومية', completed: completedTodayTypes.has('share') },
                            { id: 'completedChapter', label: 'قراءة أصحاح', completed: completedTodayTypes.has('completedChapter') },
                            { id: 'favouriteVerse', label: 'تظليل آية', completed: completedTodayTypes.has('favouriteVerse') },
                        ];
                        setDailyGoals(goals);
                    }
                }, (error) => console.error("Snapshot error:", error));
            } else {
                setStartedPlans([]);
                setDailyGoals([]);
                setRawUserData(null);
            }
        });

        return () => {
            unsubAuth?.();
            if (unsubSnap) unsubSnap();
        };
    }, [fetchDailyContent, calculatePlanStats]);

    useEffect(() => {
        if (user && startedPlans.length > 0) {
            const summary = {
                count: startedPlans.length,
                mainPlanTitle: startedPlans[0].title,
                remainingDays: startedPlans[0].stats.totalDays - startedPlans[0].stats.daysDone
            };
            localStorage.setItem('studyPlansSummary', JSON.stringify(summary));
            if (Capacitor.isNativePlatform() && window.AgiosScannerNative?.updateStudySummary) {
                window.AgiosScannerNative.updateStudySummary(JSON.stringify(summary));
            }
        }
    }, [startedPlans, user]);

    const handleShareSuccess = async () => {
        if (!user) return;
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
            totalPoints: increment(10),
            pointsHistory: arrayUnion({
                type: 'share',
                points: 10,
                reason: 'مشاركة آية اليوم من الصفحة الرئيسية',
                timestamp: new Date().toISOString()
            })
        });
        toast.success('أحسنت! تم تسجيل المشاركة اليومية +10 نقاط 📢');
    };

    const handleOptionClick = async (index) => {
        if (!user) { router.push('/intro'); return; }
        if (hasAnswered || !dailyQuestion) return;

        const dateKey = getCairoDate();
        const yesterdayStr = getCairoYesterday();

        setSelectedAnswer(index);
        setHasAnswered(true);
        localStorage.setItem(`questionAnswered_${dateKey}`, 'true');
        const isCorrect = index === dailyQuestion.answerIndex;
        const userRef = doc(firestore, 'users', user.uid);

        const userSnap = await getDoc(userRef);
        const userData = userSnap.data() || {};
        let qStreak = userData.questionStreak || 0;
        const lastQDate = userData.lastQuestionDate;

        if (lastQDate === yesterdayStr) {
            qStreak += 1;
        } else if (lastQDate !== dateKey) {
            qStreak = 1;
        }

        const updatePayload = {
            [`answeredQuestions.${dateKey}`]: { answered: true, correct: isCorrect, timestamp: new Date().toISOString() },
            questionStreak: qStreak,
            lastQuestionDate: dateKey
        };

        if (isCorrect) {
            toast.success('إجابة صحيحة! 🎉');
            await updateDoc(userRef, {
                ...updatePayload,
                totalPoints: increment(20),
                correctAnswersCount: increment(1),
                pointsHistory: arrayUnion({
                    type: 'dailyQuestion',
                    points: 20,
                    reason: 'إجابة صحيحة على سؤال اليوم',
                    timestamp: new Date().toISOString()
                })
            });
        } else {
            toast.error('إجابة خاطئة 😔');
            await updateDoc(userRef, updatePayload);
        }

        if (qStreak >= 30) {
            await unlockBadge('verse_sync');
        }
    };

    const toggleFavorite = async () => {
        if (!user) { router.push('/intro'); return; }
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
            const parts = cleanRef.split(' ');
            const rawNumbers = parts[parts.length - 1];
            const bookName = parts.slice(0, -1).join(' ');
            const [rawCh, rawV] = rawNumbers.split(':');
            const convertNumbers = (str) => str?.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d]/g, '') || "";

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
                [`favorites.verses.${verseKey}`]: verseData,
                pointsHistory: arrayUnion({
                    type: 'favouriteVerse',
                    points: 5,
                    reason: 'تظليل آية اليوم من الصفحة الرئيسية',
                    timestamp: new Date().toISOString()
                })
            });
            toast.success('رائع! تمت الإضافة لكنوزك +5 نقاط ⭐');
        }
    };

    const handleGoalClick = (goalId) => {
        if (!user) { router.push('/intro'); return; }
        switch (goalId) {
            case 'dailyQuestion':
                document.getElementById('daily-question')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 'share':
                document.getElementById('daily-verse')?.scrollIntoView({ behavior: 'smooth' });
                break;
            case 'mapExploration':
                router.push('/maps');
                break;
            case 'completedChapter':
            case 'favouriteVerse':
                router.push('/bible');
                break;
            case 'dailyLogin':
                router.push('/profile');
                break;
            default:
                break;
        }
    };

    const quickLinks = [
        { name: 'الكتاب المقدس', icon: <BookOpenText size={24} />, path: '/bible', color: '#6366f1' },
        { name: 'الخرائط', icon: <Map size={24} />, path: user ? '/maps' : '/intro', color: '#10b981' },
        { name: 'البحث', icon: <Search size={24} />, path: user ? '/search' : '/intro', color: '#f59e0b' },
        { name: 'الخطط الدراسية', icon: <BookMarked size={24} />, path: user ? '/studyPlans' : '/intro', color: '#ec4899' },
        { name: 'المسابقات', icon: <Trophy size={24} />, path: user ? '/competitions' : '/intro', color: '#8b5cf6' },
        { name: 'المفضلة', icon: <Heart size={24} />, path: user ? '/favourites' : '/intro', color: '#ef4444' },
    ];

    const completedGoalsCount = useMemo(() => dailyGoals.filter(g => g.completed).length, [dailyGoals]);

    const highlightBadges = useMemo(() => {
        if (!badgesData || !rawUserData) return { acquired: [], near: [] };

        const allBadges = badgesData.badge_families.flatMap(f => f.badges.map(b => ({ ...b, family_name: f.family_name })));
        const acquired = allBadges
            .filter(b => userBadges.includes(b.id))
            .sort((a, b) => {
                const rarityOrder = { "خرافي": 0, "أسطوري": 1, "نادر": 2, "مميز": 3, "عادي": 4, "سري": 5 };
                return rarityOrder[a.rarity] - rarityOrder[b.rarity];
            })
            .slice(0, 5);

        const stats = {
            streak: rawUserData.streak || 0,
            chapters: Object.keys(rawUserData.completedChapters || {}).filter(k => rawUserData.completedChapters[k]).length,
            quizzes: (rawUserData.completedQuizzes || []).length,
            perfectQuizzes: (rawUserData.completedQuizzes || []).filter(q => q.score === q.total).length,
            favorites: Object.keys(rawUserData.favorites?.verses || {}).length,
            maps: (rawUserData.visitedMapPoints || []).length,
            shares: (rawUserData.pointsHistory || []).filter(h => h.type === 'share').length
        };

        const near = allBadges
            .filter(b => !userBadges.includes(b.id) && b.rarity !== "سري")
            .map(b => {
                let progress = 0;
                let target = 1;
                if (b.id.startsWith('streak_')) {
                    target = parseInt(b.id.split('_')[1]);
                    progress = stats.streak;
                } else if (b.id === 'map_pioneer') { target = 5; progress = stats.maps; }
                else if (b.id === 'ancient_navigator') { target = 20; progress = stats.maps; }
                else if (b.id.startsWith('reader_')) {
                    target = parseInt(b.id.split('_')[1]);
                    progress = stats.chapters;
                } else if (b.id === 'bible_finisher') { target = 1189; progress = stats.chapters; }
                else if (b.id === 'reader_594') { target = 594; progress = stats.chapters; }
                else if (b.id.startsWith('scholar_')) {
                    target = parseInt(b.id.split('_')[1]);
                    progress = stats.quizzes;
                } else if (b.id === 'bible_master') { target = 73; progress = stats.quizzes; }
                else if (b.id.startsWith('perfect_')) {
                    target = b.id === 'perfect_all' ? 73 : parseInt(b.id.split('_')[1]);
                    progress = stats.perfectQuizzes;
                } else if (b.id.startsWith('fav_')) {
                    target = parseInt(b.id.split('_')[1]);
                    progress = stats.favorites;
                } else if (b.id === 'share_1') { target = 1; progress = stats.shares; }
                else if (b.id === 'social_influencer') { target = 50; progress = stats.shares; }

                return { ...b, progress: Math.min(100, (progress / target) * 100), currentVal: progress, targetVal: target };
            })
            .filter(b => b.progress > 0 && b.progress < 100)
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5);

        return { acquired, near };
    }, [badgesData, rawUserData, userBadges]);

    return (
        <main className={`${styles.hubContainer} ${styles.rtl}`}>
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
                    </div>
                )}
            </header>

            {remoteNews.length > 0 && (
                <div className={styles.newsSliderWrapper}>
                    <div className={styles.newsContainer} onScroll={handleNewsScroll}>
                        {remoteNews.map((news, idx) => {
                            const IconComponent = LUCIDE_ICONS[news.iconName] || Bell;
                            return (
                                <section 
                                    key={news.id || idx} 
                                    className={styles.newsBanner} 
                                    style={{ 
                                        backgroundColor: news.bgColor || '#eff6ff',
                                        '--accent-color': news.accentColor || '#3b82f6'
                                    }}
                                    onClick={() => news.link && router.push(news.link)}
                                >
                                    <div className={styles.newsMainRow}>
                                        <div className={styles.newsContent}>
                                            <div className={styles.newsHeaderLine}>
                                                <IconComponent size={16} color={news.accentColor || '#3b82f6'} />
                                                <h3 style={{ color: news.accentColor || '#1e40af' }}>{news.title}</h3>
                                            </div>
                                            <p>{news.message}</p>
                                            {news.buttonText && (
                                                <span className={styles.newsActionBadge} style={{ backgroundColor: news.accentColor || '#3b82f6' }}>
                                                    {news.buttonText} <ArrowRight size={12} />
                                                </span>
                                            )}
                                        </div>
                                        {news.imageUrl ? (
                                            <div className={styles.newsImageBox}>
                                                <img src={news.imageUrl} alt={news.title} className={styles.newsImage} />
                                            </div>
                                        ) : (
                                            <div className={styles.newsIconBox} style={{ backgroundColor: `${news.accentColor}15` }}>
                                                <IconComponent size={28} color={news.accentColor || '#3b82f6'} />
                                            </div>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                    {remoteNews.length > 1 && (
                        <div className={styles.newsDots}>
                            {remoteNews.map((_, i) => (
                                <div key={i} className={`${styles.dot} ${activeNewsIndex === i ? styles.activeDot : ''}`} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {user && (
                <section className={styles.dailyGoalsSummary}>
                    <div className={styles.goalsHeader}>
                        <div className={styles.goalsTitle}><Award size={18} color="#f59e0b" /><span>مهام اليوم</span></div>
                        <Link href="/points" className={styles.viewMoreLink}>التفاصيل <ArrowUpRight size={14} /></Link>
                    </div>
                    <div className={styles.goalsProgressWrapper}>
                        <div className={styles.goalsProgressText}>أنجزت {convertToArabicNumber(completedGoalsCount)} من {convertToArabicNumber(dailyGoals.length)} مهام</div>
                        <div className={styles.miniProgressBar}><div className={styles.miniProgressFill} style={{ width: `${(completedGoalsCount / dailyGoals.length) * 100}%` }} /></div>
                    </div>
                    <div className={styles.goalsMiniList}>
                        {dailyGoals.map(goal => (
                            <div
                                key={goal.id}
                                className={`${styles.miniGoalItem} ${goal.completed ? styles.goalDone : ''}`}
                                onClick={() => handleGoalClick(goal.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                {goal.completed ? <CheckCircle size={14} color="#10b981" /> : <Circle size={14} color="#94a3b8" />}
                                <span>{goal.label}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className={styles.quickGrid}>
                {quickLinks.map((link, i) => (
                    <Link href={link.path} key={i} className={styles.hubCard}>
                        <div className={styles.hubIcon} style={{ color: link.color, backgroundColor: `${link.color}15` }}>{link.icon}</div>
                        <span className={styles.hubName}>{link.name}</span>
                    </Link>
                ))}
            </section>

            {user && (highlightBadges.acquired.length > 0 || highlightBadges.near.length > 0) && (
                <section className={styles.badgesHighlightSection}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleWithIcon}>
                            <Trophy size={20} color="#f59e0b" />
                            <h2 className={styles.sectionTitleMini}>أوسمتك وإنجازاتك</h2>
                        </div>
                        <Link href="/points" className={styles.viewMoreLink}>كل الأوسمة <ArrowUpRight size={14} /></Link>
                    </div>

                    <div className={styles.badgesDashboard}>
                        {highlightBadges.acquired.length > 0 && (
                            <div className={styles.badgeColumn}>
                                <span className={styles.columnLabel}>أهم المقتنيات</span>
                                <div className={styles.badgeHorizontalGrid}>
                                    {highlightBadges.acquired.map(badge => (
                                        <Badge
                                            key={badge.id}
                                            badge={badge}
                                            familyName={badge.family_name}
                                            isUnlocked={true}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        {highlightBadges.near.length > 0 && (
                            <div className={styles.badgeColumn}>
                                <span className={styles.columnLabel}>اقتربت من اقتنائها</span>
                                <div className={styles.badgeHorizontalGrid}>
                                    {highlightBadges.near.map(badge => (
                                        <div key={badge.id} className={styles.badgeWithProgressWrapper}>
                                            <Badge
                                                badge={badge}
                                                familyName={badge.family_name}
                                                isUnlocked={false}
                                            />
                                            <div className={styles.badgeProgressMini}>
                                                <div className={styles.progressText}>
                                                    {convertToArabicNumber(badge.currentVal)} / {convertToArabicNumber(badge.targetVal)}
                                                </div>
                                                <div className={styles.progressLine}>
                                                    <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${badge.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {lastRead && (
                <button
                    onClick={() => {
                        if (!user) { router.push('/intro'); return; }
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
                    <div className={styles.lastReadIcon}><BookOpenText size={20} /></div>
                </button>
            )}

            <section className={styles.dailyHighlight} id="daily-verse">
                <div className={styles.verseGlass}>
                    <div className={styles.glassHeader}><Sparkles size={18} color="#ffd700" /><span>آية اليوم</span></div>
                    {isLoading ? <div className={styles.skeletonText} /> : (
                        <>
                            <p className={styles.verseText}>"{dailyVerse?.verse}"</p>
                            <span className={styles.verseRef}>{dailyVerse?.reference}</span>
                            <div className={styles.verseActions}>
                                <button onClick={() => {
                                    if (!user) { router.push('/intro'); return; }
                                    const cleanRef = dailyVerse?.reference?.replace(/[()]/g, '').trim();
                                    navigator.clipboard.writeText(`"${dailyVerse?.verse}" (${cleanRef})`);
                                    toast.success('تم النسخ');
                                }} className={`${styles.glassBtn} ${styles.copyBtn}`}>نسخ</button>
                                <button onClick={toggleFavorite} className={`${styles.glassBtn} ${favouriteVerses[`daily-verse-${dailyVerse?.month}-${dailyVerse?.day}-ar`] ? styles.activeFav : ''}`}>
                                    {favouriteVerses[`daily-verse-${dailyVerse?.month}-${dailyVerse?.day}-ar`] ? '⭐ مضافة' : '⭐ مفضلة'}
                                </button>
                                <ShareVerseCard
                                    verse={dailyVerse?.verse}
                                    reference={dailyVerse?.reference}
                                    onShareSuccess={handleShareSuccess}
                                />
                            </div>
                        </>
                    )}
                    <div className={styles.bottomDivider} style={{margin: '20px 0', opacity: 0.1, height: '1px', background: 'var(--color-text-primary)'}} />
                    {dailyQuestion && (
                        <div className={styles.questionSection} id="daily-question">
                            <div className={styles.glassHeader}><Trophy size={18} color="#f59e0b" /><span>تحدي اليوم</span></div>
                            <p className={styles.questionTitle} style={{fontWeight: '700', marginBottom: '12px'}}>{dailyQuestion.question}</p>
                            <div className={styles.optionsList}>
                                {dailyQuestion.options.map((opt, i) => (
                                    <button key={i} disabled={hasAnswered} onClick={() => handleOptionClick(i)} className={`${styles.optBtn} ${hasAnswered && i === dailyQuestion.answerIndex ? styles.correct : ''} ${hasAnswered && selectedAnswer === i && i !== dailyQuestion.answerIndex ? styles.wrong : ''}`}>{opt}</button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section className={styles.aiFeaturesSection}>
                <h2 className={styles.sectionTitle}>جرب مميزات الذكاء الاصطناعي</h2>
                <div className={styles.aiFeaturesGrid}>
                    <Link href={user ? "/search?type=derivatives" : "/intro"} className={styles.aiFeatureCard}>
                        <div className={styles.aiFeatureIcon} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                            <Search size={24} />
                        </div>
                        <div className={styles.aiFeatureInfo}>
                            <h3>البحث بالمشتقات</h3>
                            <p>ابحث عن الكلمات وجذورها اللغوية بذكاء</p>
                        </div>
                        <ArrowRight size={18} className={styles.aiArrow} />
                    </Link>
                    <Link href={user ? "/search?type=semantic" : "/intro"} className={styles.aiFeatureCard}>
                        <div className={styles.aiFeatureIcon} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <Sparkles size={24} />
                        </div>
                        <div className={styles.aiFeatureInfo}>
                            <h3>البحث بالمعنى والشرح</h3>
                            <p>ابحث عن آيات بالكتاب المقدس عن طريق شرحها او شرح سياقها لمساعد آجيوس الذكي</p>
                        </div>
                        <ArrowRight size={18} className={styles.aiArrow} />
                    </Link>
                    <Link href={user ? "/studyPlans/custom" : "/intro"} className={styles.aiFeatureCard}>
                        <div className={styles.aiFeatureIcon} style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
                            <Wand2 size={24} />
                        </div>
                        <div className={styles.aiFeatureInfo}>
                            <h3>إنشاء خطة بالذكاء الاصطناعي</h3>
                            <p>أخبر "أجيوس" بما تشعر به ليقترح لك خطة</p>
                        </div>
                        <ArrowRight size={18} className={styles.aiArrow} />
                    </Link>
                </div>
            </section>

            {startedPlans.length > 0 && (
                <section className={styles.startedPlansSection}>
                    <h2 className={styles.sectionTitle}>خططك الجارية</h2>
                    <div className={styles.plansVerticalList}>
                        {startedPlans.map((plan) => (
                            <button key={plan.id} onClick={() => router.push(`/studyPlans/details?id=${plan.id}${plan.isCustom ? '&type=custom' : ''}`)} className={styles.planProgressCardVertical}>
                                <div className={styles.planInfo}>
                                    <div className={styles.planNameRow}><span className={styles.planTitle}>{plan.title}</span><span className={styles.planPercent}>{plan.stats?.percent}%</span></div>
                                    <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${plan.stats?.percent}%` }} /></div>
                                    <div className={styles.planMeta}><span>يوم {plan.stats?.daysDone} من {plan.stats?.totalDays}</span><div className={styles.planActionText}>واصل القراءة <ArrowRight size={14} /></div></div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {!user && (
                <div className={styles.guestBanner}>
                    <LogIn size={24} />
                    <div className={styles.guestText}><h3>سجل الآن</h3><p>احفظ تقدمك ونافس أصدقاءك</p></div>
                    <Link href="/intro" className={styles.loginLink}>دخول</Link>
                </div>
            )}
        </main>
    );
};

export default LandingPage;
