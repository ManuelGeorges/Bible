'use client';

import React, { useEffect, useState } from 'react';
import styles from './history.module.css';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock, Trash2, ArrowRight, BookOpen, ChevronLeft } from 'lucide-react';
import { StorageService, KEYS } from '../../../lib/storage';
import { useLanguage } from '../../context/LanguageContext';

const HistoryPage = () => {
    const { strings, formatNumber, dir } = useLanguage();
    const router = useRouter();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            const data = await StorageService.get(KEYS.READING_HISTORY) || [];
            setHistory(data);
            setIsLoading(false);
        };
        loadHistory();
    }, []);

    const clearHistory = async () => {
        if (confirm(dir === 'rtl' ? 'هل أنت متأكد من مسح سجل القراءات؟' : 'Are you sure you want to clear reading history?')) {
            await StorageService.save(KEYS.READING_HISTORY, []);
            setHistory([]);
        }
    };

    if (isLoading) return <div className={styles.loading}>{strings.common.loading}</div>;

    return (
        <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
            <header className={styles.header}>
                <button onClick={() => router.back()} className={styles.backBtn}>
                    {dir === 'rtl' ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
                </button>
                <h1 className={styles.title}>سجل القراءات</h1>
                {history.length > 0 && (
                    <button onClick={clearHistory} className={styles.clearBtn}>
                        <Trash2 size={20} />
                    </button>
                )}
            </header>

            <div className={styles.historyList}>
                {history.length > 0 ? (
                    history.map((item, idx) => (
                        <div key={idx} className={styles.historyItem}>
                            <div className={styles.dateDivider}>
                                <Clock size={14} />
                                <span>{new Date(item.timestamp).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>
                            <button
                                className={styles.historyCard}
                                onClick={() => router.push(`/bible?book=${encodeURIComponent(item.bookName)}&chapter=${item.chapterIndex + 1}`)}
                            >
                                <div className={styles.historyIcon}><BookOpen size={20} /></div>
                                <div className={styles.historyInfo}>
                                    <span className={styles.historyBook}>{item.bookName}</span>
                                    <span className={styles.historyChapter}>{strings.common.chapter} {formatNumber(item.chapterIndex + 1)}</span>
                                    <span className={styles.historyTime}>
                                        {new Date(item.timestamp).toLocaleTimeString(dir === 'rtl' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <ArrowRight size={20} className={styles.historyArrow} />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <Clock size={48} className={styles.emptyIcon} />
                        <p>لا يوجد سجل قراءات حتى الآن</p>
                        <button onClick={() => router.push('/bible')} className={styles.startBtn}>
                            ابدأ القراءة الآن
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
