'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
    Book, Map, Search, User, Trophy,
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
    Video, Music, Church, Sun, Moon, Cloud
} from 'lucide-react';
import ShareVerseCard from '../components/ShareVerseCard';

const auth = typeof window !== 'undefined' ? getAuth() : null;
const firestore = db;
const staticPlans = studyPlansData.plans;

const LUCIDE_ICONS = {
    'Trophy': Trophy, 'Award': Award, 'Medal': Award, 'Gift': Gift, 'Star': Star, 'Heart': Heart,
    'Bell': Bell, 'Info': Info, 'Megaphone': Megaphone, 'Message': MessageCircle, 'Announcement': Megaphone,
    'Bot': Bot, 'AI': Sparkles, 'Brain': Brain, 'Cpu': Cpu, 'Wand': Wand2, 'Magic': Wand2, 'Lightbulb': Lightbulb, 'Idea': Lightbulb,
    'Rocket': Rocket, 'Update': RefreshCw, 'New': Sparkles, 'History': History, 'Zap': Zap, 'Flash': Zap, 'Party': PartyPopper,
    'Book': Book, 'Bible': BookOpen, 'BookOpen': BookOpen, 'Scroll': Scroll, 'Church': Church, 'Pray': Heart,
    'Map': Map, 'Search': Search, 'Settings': Settings, 'Globe': Globe, 'Shield': Shield, 'Verified': ShieldCheck,
    'Calendar': Calendar, 'Camera': Camera, 'Mail': Mail, 'Link': LinkIcon, 'External': ExternalLink,
    'Lock': Lock, 'Unlock': Unlock, 'QrCode': QrCode, 'Translate': Languages, 'Mic': Mic,
    'Users': Users, 'People': Users, 'Like': ThumbsUp, 'Share': Share2, 'Music': Music, 'Video': Video, 'Headphones': Headphones,
    'Sun': Sun, 'Moon': Moon, 'Cloud': Cloud, 'Flame': Flame, 'Fire': Flame
};

const convertToArabicNumber = (num) => {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().split('').map(d => arabicNums[+d] || d).join('');
};

const LandingPage = () => {
    const router = useRouter();
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

    // تحسين حساب الإحصائيات لتجنب البحث المتكرر O(N^2)
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
        const fetchRemoteConfig = async () => {
            try {
                const config = await getFirebaseRemoteConfig();
                if (config) {
                    config.settings.minimumFetchIntervalMillis = 3600000; // ساعة واحدة لتجنب ضغط الطلبات
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

    // الإصلاح الأساسي: إدارة اشتراكات Firebase بشكل صحيح لمنع التهنيج
    useEffect(() => {
        if (Capacitor.isNativePlatform()) CapacitorUpdater.notifyAppReady();

        let unsubSnap = null;
        const unsubAuth = auth?.onAuthStateChanged((u) => {
            setUser(u);
            fetchDailyContent(u);

            // تنظيف المستمع القديم قبل إنشاء واحد جديد
            if (unsubSnap) {
                unsubSnap();
                unsubSnap = null;
            }

            if (u) {
                unsubSnap = onSnapshot(doc(firestore, 'users', u.uid), (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setUserStats({ points: data.totalPoints || 0, streak: data.streak || 0 });
                        setUserBadges(data.badges || []);
                        setFavouriteVerses(data.favorites?.verses || {});

                        const lastReadData = data.lastRead || JSON.parse(localStorage.getItem('lastReadLocation'));
                        setLastRead(lastReadData);

                        const serverComp = data.completedPlans || {};
                        const customPlans = data.customPlans || {};

                        // تحسين: تمرير الكائن مباشرة لتجنب البحث المتكرر
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

                        const today = new Date().toISOString().split('T')[0];
                        const historyRaw = data.pointsHistory || [];
                        const history = Array.isArray(historyRaw) ? historyRaw : Object.values(historyRaw);

                        // تحسين: فحص المهام في دورة واحدة بدلاً من دورات متعددة
                        const completedTodayTypes = new Set(
                            history.filter(h => {
                                if (!h.timestamp) return false;
                                const ts = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
                                return ts.toISOString().split('T')[0] === today;
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

    const quickLinks = [
        { name: 'الكتاب المقدس', icon: <Book size={24} />, path: '/bible', color: '#6366f1' },
        { name: 'الخرائط', icon: <Map size={24} />, path: user ? '/maps' : '/intro', color: '#10b981' },
        { name: 'البحث', icon: <Search size={24} />, path: user ? '/search' : '/intro', color: '#f59e0b' },
        { name: 'الخطط الدراسية', icon: <BookMarked size={24} />, path: user ? '/studyPlans' : '/intro', color: '#ec4899' },
        { name: 'المسابقات', icon: <Trophy size={24} />, path: user ? '/competitions' : '/intro', color: '#8b5cf6' },
        { name: 'المفضلة', icon: <Heart size={24} />, path: user ? '/favourites' : '/intro', color: '#ef4444' },
    ];

    const completedGoalsCount = useMemo(() => dailyGoals.filter(g => g.completed).length, [dailyGoals]);

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
                        <div className={styles.badgeList}>
                            {userBadges.slice(0, 3).map((b, i) => <span key={i} className={styles.miniBadge}>🏅</span>)}
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
                            <div key={goal.id} className={`${styles.miniGoalItem} ${goal.completed ? styles.goalDone : ''}`}>
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
                    <div className={styles.lastReadIcon}><Book size={20} /></div>
                </button>
            )}

            <section className={styles.dailyHighlight}>
                <div className={styles.verseGlass}>
                    <div className={styles.glassHeader}><Sparkles size={18} color="#ffd700" /><span>آية اليوم</span></div>
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
                                    onShareSuccess={handleShareSuccess}
                                />
                            </div>
                        </>
                    )}
                    <div className={styles.bottomDivider} style={{margin: '20px 0', opacity: 0.1, height: '1px', background: 'var(--color-text-primary)'}} />
                    {dailyQuestion && (
                        <div className={styles.questionSection}>
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
