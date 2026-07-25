"use client";

import React, { useState, useMemo, Suspense, useEffect } from 'react';
import styles from './books.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import {
     Search, Scroll, Sun, Compass, Flame, MapPin, Sword, Shield, Heart, Crown,
    Landmark, History, Hammer, Star, Anchor, Music, Lightbulb, Wind,
    Eye, Feather, Sparkles, Ghost, Mountain, Lamp, Users, Cross,
    MessageCircle, BookOpen
} from 'lucide-react';

const bookIconMap = {
    "Gen": <Sun size={24} />, "Exo": <Compass size={24} />, "LEV": <Flame size={24} />,
    "NUM": <MapPin size={24} />, "DEU": <Scroll size={24} />, "JOS": <Sword size={24} />,
    "JDG": <Shield size={24} />, "RUT": <Heart size={24} />, "1SA": <Crown size={24} />,
    "2SA": <Crown size={24} />, "1KI": <Landmark size={24} />, "2KI": <Landmark size={24} />,
    "1CH": <History size={24} />, "2CH": <History size={24} />, "EZR": <Hammer size={24} />,
    "NEH": <Hammer size={24} />, "EST": <Star size={24} />, "JOB": <Anchor size={24} />,
    "PSA": <Music size={24} />, "PRO": <Lightbulb size={24} />, "ECC": <Wind size={24} />,
    "SNG": <Heart size={24} />, "ISA": <Eye size={24} />, "JER": <Feather size={24} />,
    "LAM": <Feather size={24} />, "EZK": <Sparkles size={24} />, "DAN": <Ghost size={24} />,
    "HOS": <Heart size={24} />, "JOL": <Flame size={24} />, "AMO": <Mountain size={24} />,
    "OBA": <Shield size={24} />, "JON": <Anchor size={24} />, "MIC": <Landmark size={24} />,
    "NAM": <Sword size={24} />, "HAB": <Lamp size={24} />, "ZEP": <Sun size={24} />,
    "HAG": <Hammer size={24} />, "ZEC": <Sparkles size={24} />, "MAL": <Star size={24} />,
    "MAT": <Crown size={24} />, "MRK": <Cross size={24} />, "LUK": <Star size={24} />,
    "JHN": <Sparkles size={24} />, "ACT": <Users size={24} />, "ROM": <Scroll size={24} />,
    "1CO": <MessageCircle size={24} />, "2CO": <MessageCircle size={24} />, "GAL": <Feather size={24} />,
    "EPH": <Shield size={24} />, "PHP": <Heart size={24} />, "COL": <Anchor size={24} />,
    "1TH": <Wind size={24} />, "2TH": <Wind size={24} />, "1TI": <Landmark size={24} />,
    "2TI": <Landmark size={24} />, "TIT": <Hammer size={24} />, "PHM": <Feather size={24} />,
    "HEB": <Scroll size={24} />, "JAS": <Hammer size={24} />, "1PE": <Anchor size={24} />,
    "2PE": <Anchor size={24} />, "1JN": <Heart size={24} />, "2JN": <Heart size={24} />,
    "3JN": <Heart size={24} />, "JUD": <Shield size={24} />, "REV": <Eye size={24} />,
};

const normalizeArabic = (text) => {
    if (!text) return "";
    return text.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652]/g, '').trim();
};

function BooksContent() {
    const { strings, language, bookNames } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();

    // الحصول على التبويب النشط من الروابط لضمان توجيه المستخدم للمكان الصحيح
    const initialTab = searchParams.get('tab') || 'OT';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab);
    }, [searchParams]);

    const filteredBooks = useMemo(() => {
        const normalizedQuery = normalizeArabic(searchQuery);
        return bookNames.filter(b => {
            const matchesTab = b.testament === activeTab;
            const matchesSearch = normalizeArabic(b.name).includes(normalizedQuery);
            return matchesTab && matchesSearch;
        });
    }, [bookNames, activeTab, searchQuery]);

    return (
        <div dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language} className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>{strings.bible.books_title}</h1>
            </header>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'OT' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('OT')}
                >
                    {strings.bible.testament_ot}
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'NT' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('NT')}
                >
                    {strings.bible.testament_nt}
                </button>
            </div>

            <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={strings.bible.search_book}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className={styles.grid}>
                {filteredBooks.map((book) => (
                    <button
                        key={book.book_id}
                        className={styles.bookItem}
                        onClick={() => router.push(`/bible/chapters?book=${encodeURIComponent(book.name)}`)}
                    >
                        <div className={styles.iconWrapper}>
                            {bookIconMap[book.book_id] || (book.testament === 'OT' ? <Scroll size={24} /> : <BookOpen size={24} />)}
                        </div>
                        <span className={styles.bookName}>{book.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function BooksPage() {
    const { strings } = useLanguage();
    return (
        <Suspense fallback={<div>{strings.common.loading}</div>}>
            <BooksContent />
        </Suspense>
    );
}
