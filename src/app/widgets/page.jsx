'use client';

import React from 'react';
import styles from './widgets.module.css';
import { useLanguage } from '../context/LanguageContext';
import {
    BookOpen,
    Trophy,
    BookMarked,
    Award,
    Plus,
    Smartphone,
    Info
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function WidgetsPage() {
    const { strings, dir, language } = useLanguage();
    const router = useRouter();
    const isAndroid = Capacitor.getPlatform() === 'android';

    const widgetItems = [
        {
            id: 'verse',
            title: strings.widgets.items.verse.title,
            desc: strings.widgets.items.verse.desc,
            icon: <BookOpen size={28} />,
            color: '#6366f1'
        },
        {
            id: 'question',
            title: strings.widgets.items.question.title,
            desc: strings.widgets.items.question.desc,
            icon: <Trophy size={28} />,
            color: '#f59e0b'
        },
        {
            id: 'studyPlan',
            title: strings.widgets.items.studyPlan.title,
            desc: strings.widgets.items.studyPlan.desc,
            icon: <BookMarked size={28} />,
            color: '#ec4899'
        },
        {
            id: 'points',
            title: strings.widgets.items.points.title,
            desc: strings.widgets.items.points.desc,
            icon: <Award size={28} />,
            color: '#10b981'
        }
    ];

    const handleAddWidget = (id) => {
        if (!isAndroid) {
            toast.error(strings.widgets.android_only);
            return;
        }

        if (window.AgiosScannerNative?.pinWidget) {
            window.AgiosScannerNative.pinWidget(id);
            toast.success(strings.widgets.success_toast);
        } else {
            toast.error("Native Bridge not found");
        }
    };

    return (
        <div className={`${styles.container} ${dir === 'rtl' ? styles.rtl : styles.ltr}`} dir={dir}>
            <header className={styles.header}>
                <h1 className={styles.title}>{strings.widgets.title}</h1>
                <p className={styles.subtitle}>{strings.widgets.subtitle}</p>
            </header>

            <div className={styles.grid}>
                {widgetItems.map((item) => (
                    <div key={item.id} className={styles.card}>
                        <div className={styles.iconWrapper} style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                            {item.icon}
                        </div>
                        <h2 className={styles.cardTitle}>{item.title}</h2>
                        <p className={styles.cardDesc}>{item.desc}</p>

                        {isAndroid ? (
                            <button
                                onClick={() => handleAddWidget(item.id)}
                                className={styles.addButton}
                                style={{ backgroundColor: item.color }}
                            >
                                <Plus size={18} />
                                <span>{strings.widgets.add_to_home}</span>
                            </button>
                        ) : (
                            <div className={styles.platformBadge}>
                                <Smartphone size={14} />
                                <span>Android Only</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {!isAndroid && (
                <div className={styles.iosNote}>
                    <Info className={styles.iosNoteIcon} size={24} />
                    <p className={styles.iosNoteText}>
                        {language === 'ar' ? strings.widgets.how_to_ios : strings.widgets.how_to_ios}
                    </p>
                </div>
            )}
        </div>
    );
}
