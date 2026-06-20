"use client";

import React, { useState, useEffect, Suspense } from 'react';
import styles from './chapters.module.css';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Sun, Compass, Flame, MapPin,
    Sword, Shield, Heart, Crown, Landmark, History,
    Hammer, Star, Anchor, Music, Lightbulb, Wind,
    Eye, Feather, Sparkles, Ghost, Mountain, Lamp,
    Cross, Users, MessageCircle, Scroll, Book as BookIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';

const bookIconMap = {
    "Gen": <Sun size={24} />, "Exo": <Compass size={24} />, "LEV": <Flame size={24} />, "NUM": <MapPin size={24} />, "DEU": <Scroll size={24} />,
    "JOS": <Sword size={24} />, "JDG": <Shield size={24} />, "RUT": <Heart size={24} />, "1SA": <Crown size={24} />, "2SA": <Crown size={24} />,
    "1KI": <Landmark size={24} />, "2KI": <Landmark size={24} />, "1CH": <History size={24} />, "2CH": <History size={24} />,
    "EZR": <Hammer size={24} />, "NEH": <Hammer size={24} />, "EST": <Star size={24} />, "JOB": <Anchor size={24} />,
    "PSA": <Music size={24} />, "PRO": <Lightbulb size={24} />, "ECC": <Wind size={24} />, "SNG": <Heart size={24} />,
    "ISA": <Eye size={24} />, "JER": <Feather size={24} />, "LAM": <Feather size={24} />, "EZK": <Sparkles size={24} />,
    "DAN": <Ghost size={24} />, "HOS": <Heart size={24} />, "JOL": <Flame size={24} />, "AMO": <Mountain size={24} />,
    "OBA": <Shield size={24} />, "JON": <Anchor size={24} />, "MIC": <Landmark size={24} />, "NAM": <Sword size={24} />,
    "HAB": <Lamp size={24} />, "ZEP": <Sun size={24} />, "HAG": <Hammer size={24} />, "ZEC": <Sparkles size={24} />,
    "MAL": <Star size={24} />, "MAT": <Crown size={24} />, "MRK": <Cross size={24} />, "LUK": <Star size={24} />,
    "JHN": <Sparkles size={24} />, "ACT": <Users size={24} />, "ROM": <Scroll size={24} />, "1CO": <MessageCircle size={24} />,
    "2CO": <MessageCircle size={24} />, "GAL": <Feather size={24} />, "EPH": <Shield size={24} />, "PHP": <Heart size={24} />,
    "COL": <Anchor size={24} />, "1TH": <Wind size={24} />, "2TH": <Wind size={24} />, "1TI": <Landmark size={24} />,
    "2TI": <Landmark size={24} />, "TIT": <Hammer size={24} />, "PHM": <Feather size={24} />, "HEB": <Scroll size={24} />,
    "JAS": <Hammer size={24} />, "1PE": <Anchor size={24} />, "2PE": <Anchor size={24} />, "1JN": <Heart size={24} />,
    "2JN": <Heart size={24} />, "3JN": <Heart size={24} />, "JUD": <Shield size={24} />, "REV": <Eye size={24} />,
};

const bookHues = [210, 145, 35, 280, 110, 60, 0, 25, 330, 180, 230, 45];
const getBookHue = (id) => {
    if (!id) return 210;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return bookHues[Math.abs(hash) % bookHues.length];
};

function ChaptersContent() {
    const { strings, language, bookNames } = useLanguage();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [book, setBook] = useState(null);
    const bookNameParam = searchParams.get('book');

    useEffect(() => {
        if (bookNames.length > 0 && bookNameParam) {
            const found = bookNames.find(b => b.name === decodeURIComponent(bookNameParam));
            if (found) setBook(found);
        }
    }, [bookNames, bookNameParam]);

    if (!book) return <div className={styles.container}>{strings.common.loading}</div>;

    const hue = getBookHue(book.book_id || book.id);

    const formatNumber = (num) => {
        if (language !== 'ar') return num.toString();
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[+d] || d).join('');
    };

    return (
        <main className={styles.container} style={{ '--book-hue': hue }}>
            <header className={styles.header}>
                <div className={styles.bookInfo}>
                    <h1 className={styles.title}>{book.name}</h1>
                    <div className={styles.iconWrapper}>
                        {bookIconMap[book.book_id] || (book.testament === 'OT' ? <Scroll size={24} /> : <BookIcon size={24} />)}
                    </div>
                </div>
            </header>

            <p className={styles.subtitle}>{strings.bible.chapters_subtitle}</p>

            <div className={styles.chaptersGrid}>
                {Array.from({ length: book.chapters || 1 }).map((_, i) => (
                    <motion.button
                        key={i}
                        className={styles.chapterItem}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push(`/bible?book=${encodeURIComponent(book.name)}&chapter=${i + 1}`)}
                    >
                        {formatNumber(i + 1)}
                    </motion.button>
                ))}
            </div>
        </main>
    );
}

export default function ChaptersPage() {
    const { strings } = useLanguage();
    return (
        <Suspense fallback={<div>{strings.common.loading}</div>}>
            <ChaptersContent />
        </Suspense>
    );
}
