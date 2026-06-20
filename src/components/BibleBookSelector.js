"use client";

import React, { useState, useEffect, useMemo, useRef, memo, useDeferredValue } from 'react';
import styles from './BibleBookSelector.module.css';
import {
    Book, Scroll, Heart, Star, Flame, Music,
    Lightbulb, Users, Crown, Shield, MapPin,
    Compass, Sun, Moon, Sparkles, Wand2,
    Eye, Anchor, Sword, Cross, MessageCircle,
    ChevronLeft, ChevronRight, X, BookOpen,
    Feather, Mountain, Landmark, Ghost,
    Hammer, Lamp, History, Wind, Search
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import strings from '../app/data/ar.json';

// ذاكرة خارجية لحفظ البيانات ومنع التحميل المتكرر (Instant Load)
let cachedBookNames = null;

const bookIconMap = {
    "Gen": <Sun size={38} />, "Exo": <Compass size={38} />, "LEV": <Flame size={38} />,
    "NUM": <MapPin size={38} />, "DEU": <Scroll size={38} />, "JOS": <Sword size={38} />,
    "JDG": <Shield size={38} />, "RUT": <Heart size={38} />, "1SA": <Crown size={38} />,
    "2SA": <Crown size={38} />, "1KI": <Landmark size={38} />, "2KI": <Landmark size={38} />,
    "1CH": <History size={38} />, "2CH": <History size={38} />, "EZR": <Hammer size={38} />,
    "NEH": <Hammer size={38} />, "EST": <Star size={38} />, "JOB": <Anchor size={38} />,
    "PSA": <Music size={38} />, "PRO": <Lightbulb size={38} />, "ECC": <Wind size={38} />,
    "SNG": <Heart size={38} />, "ISA": <Eye size={38} />, "JER": <Feather size={38} />,
    "LAM": <Feather size={38} />, "EZK": <Sparkles size={38} />, "DAN": <Ghost size={38} />,
    "HOS": <Heart size={38} />, "JOL": <Flame size={38} />, "AMO": <Mountain size={38} />,
    "OBA": <Shield size={38} />, "JON": <Anchor size={38} />, "MIC": <Landmark size={38} />,
    "NAM": <Sword size={38} />, "HAB": <Lamp size={38} />, "ZEP": <Sun size={38} />,
    "HAG": <Hammer size={38} />, "ZEC": <Sparkles size={38} />, "MAL": <Star size={38} />,
    "MAT": <Crown size={38} />, "MRK": <Cross size={38} />, "LUK": <Star size={38} />,
    "JHN": <Sparkles size={38} />, "ACT": <Users size={38} />, "ROM": <Scroll size={38} />,
    "1CO": <MessageCircle size={38} />, "2CO": <MessageCircle size={38} />, "GAL": <Feather size={38} />,
    "EPH": <Shield size={38} />, "PHP": <Heart size={38} />, "COL": <Anchor size={38} />,
    "1TH": <Wind size={38} />, "2TH": <Wind size={38} />, "1TI": <Landmark size={38} />,
    "2TI": <Landmark size={38} />, "TIT": <Hammer size={38} />, "PHM": <Feather size={38} />,
    "HEB": <Scroll size={38} />, "JAS": <Hammer size={38} />, "1PE": <Anchor size={38} />,
    "2PE": <Anchor size={38} />, "1JN": <Heart size={38} />, "2JN": <Heart size={38} />,
    "3JN": <Heart size={38} />, "JUD": <Shield size={38} />, "REV": <Eye size={38} />,
};

const bookColors = [
    { main: '#be123c', dark: '#881337' }, { main: '#1d4ed8', dark: '#1e3a8a' },
    { main: '#047857', dark: '#064e3b' }, { main: '#6d28d9', dark: '#4c1d95' },
    { main: '#c2410c', dark: '#7c2d12' }, { main: '#0e7490', dark: '#164e63' },
    { main: '#4338ca', dark: '#312e81' }, { main: '#be185d', dark: '#831843' },
    { main: '#b45309', dark: '#78350f' }, { main: '#0f766e', dark: '#134e4a' },
    { main: '#4d7c0f', dark: '#365314' }, { main: '#7e22ce', dark: '#581c87' }
];

const getBookColor = (id) => {
    if (!id) return bookColors[0];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return bookColors[Math.abs(hash) % bookColors.length];
};

const normalizeArabic = (text) => {
    if (!text) return "";
    return text.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u064B-\u0652]/g, '').toLowerCase().trim();
};

const BookCard = memo(({ book, onBookClick }) => {
    const colors = getBookColor(book.book_id || book.id);
    const icon = bookIconMap[book.book_id] || (book.testament === 'OT' ? <Scroll size={32} /> : <Book size={32} />);
    const router = useRouter();

    // Prefetching: يحمل الصفحة القادمة أول ما المستخدم يلمس الزرار (Native Feeling)
    const handleTouchStart = () => {
        router.prefetch(`/bible/chapters?book=${encodeURIComponent(book.name)}`);
    };

    return (
        <button
            className={styles.bookCard}
            onClick={() => onBookClick(book)}
            onPointerDown={handleTouchStart}
            style={{ '--book-main': colors.main, '--book-dark': colors.dark }}
        >
            <div className={styles.iconContainer}>{icon}</div>
            <span className={styles.bookName}>{book.name}</span>
        </button>
    );
});

BookCard.displayName = 'BookCard';

const BookRow = ({ title, books, onBookClick }) => {
    const scrollRef = useRef(null);
    if (books.length === 0) return null;

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{title}</h3>
            </div>
            <div className={styles.scrollWrapper}>
                <div className={styles.scrollRow} ref={scrollRef}>
                    {books.map((book) => (
                        <BookCard key={book.book_id || book.id} book={book} onBookClick={onBookClick} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function BibleBookSelector() {
    const [bookNames, setBookNames] = useState(cachedBookNames || []);
    const [searchTerm, setSearchTerm] = useState('');
    // Deferred Value: بيخلي الواجهة ماتهنجش وانت بتكتب بسرعة في البحث
    const deferredSearch = useDeferredValue(searchTerm);
    const router = useRouter();

    useEffect(() => {
        if (cachedBookNames) return; // لا تحمل البيانات لو كانت موجودة مسبقاً

        fetch('/data/bookNames.json')
            .then(res => res.json())
            .then(data => {
                if (data?.ar) {
                    cachedBookNames = data.ar;
                    setBookNames(data.ar);
                }
            })
            .catch(err => console.error("Error:", err));
    }, []);

    const filteredBooks = useMemo(() => {
        const normalizedSearch = normalizeArabic(deferredSearch);
        if (!normalizedSearch) {
            return {
                ot: bookNames.filter(b => b.testament === 'OT'),
                nt: bookNames.filter(b => b.testament === 'NT')
            };
        }
        const filtered = bookNames.filter(book => normalizeArabic(book.name).includes(normalizedSearch));
        return {
            ot: filtered.filter(b => b.testament === 'OT'),
            nt: filtered.filter(b => b.testament === 'NT')
        };
    }, [bookNames, deferredSearch]);

    const handleBookClick = (book) => {
        router.push(`/bible/chapters?book=${encodeURIComponent(book.name)}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.mainHeader}>
                <h2 className={styles.title}><BookOpen size={22} className={styles.titleIcon} />{strings.components.book_selector.title}</h2>
                <div className={styles.searchWrapper}>
                    <div className={styles.searchContainer}>
                        <Search className={styles.searchIcon} size={20} />
                        <input
                            type="text"
                            placeholder={strings.components.book_selector.search_placeholder}
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && <button className={styles.clearSearch} onClick={() => setSearchTerm('')}><X size={18} /></button>}
                    </div>
                </div>
            </div>

            <BookRow title={strings.components.book_selector.testament_ot} books={filteredBooks.ot} onBookClick={handleBookClick} />
            <BookRow title={strings.components.book_selector.testament_nt} books={filteredBooks.nt} onBookClick={handleBookClick} />

            {filteredBooks.ot.length === 0 && filteredBooks.nt.length === 0 && bookNames.length > 0 && (
                <div className={styles.noResults}>
                    <p>{strings.components.book_selector.no_results.replace('{name}', searchTerm)}</p>
                </div>
            )}
        </div>
    );
}
