"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const bookIconMap = {
    // Pentateuch
    "Gen": <Sun size={28} />,
    "Exo": <Compass size={28} />,
    "LEV": <Flame size={28} />,
    "NUM": <MapPin size={28} />,
    "DEU": <Scroll size={28} />,
    // History
    "JOS": <Sword size={28} />,
    "JDG": <Shield size={28} />,
    "RUT": <Heart size={28} />,
    "1SA": <Crown size={28} />,
    "2SA": <Crown size={28} />,
    "1KI": <Landmark size={28} />,
    "2KI": <Landmark size={28} />,
    "1CH": <History size={28} />,
    "2CH": <History size={28} />,
    "EZR": <Hammer size={28} />,
    "NEH": <Hammer size={28} />,
    "EST": <Star size={28} />,
    // Poetry
    "JOB": <Anchor size={28} />,
    "PSA": <Music size={28} />,
    "PRO": <Lightbulb size={28} />,
    "ECC": <Wind size={28} />,
    "SNG": <Heart size={28} />,
    // Prophets
    "ISA": <Eye size={28} />,
    "JER": <Feather size={28} />,
    "LAM": <Feather size={28} />,
    "EZK": <Sparkles size={28} />,
    "DAN": <Ghost size={28} />,
    "HOS": <Heart size={28} />,
    "JOL": <Flame size={28} />,
    "AMO": <Mountain size={28} />,
    "OBA": <Shield size={28} />,
    "JON": <Anchor size={28} />,
    "MIC": <Landmark size={28} />,
    "NAM": <Sword size={28} />,
    "HAB": <Lamp size={28} />,
    "ZEP": <Sun size={28} />,
    "HAG": <Hammer size={28} />,
    "ZEC": <Sparkles size={28} />,
    "MAL": <Star size={28} />,
    // NT
    "MAT": <Crown size={28} />,
    "MRK": <Cross size={28} />,
    "LUK": <Star size={28} />,
    "JHN": <Sparkles size={28} />,
    "ACT": <Users size={28} />,
    "ROM": <Scroll size={28} />,
    "1CO": <MessageCircle size={28} />,
    "2CO": <MessageCircle size={28} />,
    "GAL": <Feather size={28} />,
    "EPH": <Shield size={28} />,
    "PHP": <Heart size={28} />,
    "COL": <Anchor size={28} />,
    "1TH": <Wind size={28} />,
    "2TH": <Wind size={28} />,
    "1TI": <Landmark size={28} />,
    "2TI": <Landmark size={28} />,
    "TIT": <Hammer size={28} />,
    "PHM": <Feather size={28} />,
    "HEB": <Scroll size={28} />,
    "JAS": <Hammer size={28} />,
    "1PE": <Anchor size={28} />,
    "2PE": <Anchor size={28} />,
    "1JN": <Heart size={28} />,
    "2JN": <Heart size={28} />,
    "3JN": <Heart size={28} />,
    "JUD": <Shield size={28} />,
    "REV": <Eye size={28} />,
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

const normalizeArabic = (text) => {
    if (!text) return "";
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
        .toLowerCase()
        .trim();
};

const BookRow = ({ title, books, onBookClick }) => {
    const scrollRef = useRef(null);

    if (books.length === 0) return null;

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className={styles.section}>
            <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{title}</h3>
            </div>
            <div className={styles.scrollWrapper}>
                <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={() => scroll('right')}><ChevronRight size={18} /></button>
                <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={() => scroll('left')}><ChevronLeft size={18} /></button>
                <div className={styles.scrollRow} ref={scrollRef}>
                    {books.map((book, idx) => {
                        const hue = getBookHue(book.book_id || book.id);
                        return (
                            <button
                                key={book.book_id || idx}
                                className={styles.bookCard}
                                onClick={() => onBookClick(book)}
                                style={{ '--book-hue': hue }}
                            >
                                <div className={styles.cardHeader}>
                                    <BookOpen size={12} className={styles.tinyLogo} />
                                </div>

                                <div className={styles.iconWrapper}>
                                    {bookIconMap[book.book_id] || (book.testament === 'OT' ? <Scroll size={28} /> : <Book size={28} />)}
                                </div>

                                <span className={styles.bookName}>{book.name}</span>

                                <div className={styles.cardFooter}>
                                    <span className={styles.watermark}>Agios.Bible</span>
                                </div>

                                <div className={styles.cardOverlay} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default function BibleBookSelector() {
    const [bookNames, setBookNames] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    useEffect(() => {
        fetch('/data/bookNames.json')
            .then(res => res.json())
            .then(data => {
                if (data && data.ar) {
                    setBookNames(data.ar);
                }
            })
            .catch(err => console.error("Error loading book names:", err));
    }, []);

    const filteredBooks = useMemo(() => {
        const normalizedSearch = normalizeArabic(searchTerm);
        if (!normalizedSearch) {
            return {
                ot: bookNames.filter(b => b.testament === 'OT'),
                nt: bookNames.filter(b => b.testament === 'NT')
            };
        }

        const filtered = bookNames.filter(book =>
            normalizeArabic(book.name).includes(normalizedSearch)
        );

        return {
            ot: filtered.filter(b => b.testament === 'OT'),
            nt: filtered.filter(b => b.testament === 'NT')
        };
    }, [bookNames, searchTerm]);

    const handleBookClick = (book) => {
        router.push(`/bible/chapters?book=${encodeURIComponent(book.name)}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.mainHeader}>
                <h2 className={styles.title}>
                    اقرأ الكتاب المقدس
                </h2>
                <div className={styles.headerLine} />

                <div className={styles.searchWrapper}>
                    <div className={styles.searchContainer}>
                        <Search className={styles.searchIcon} size={18} />
                        <input
                            type="text"
                            placeholder="ابحث عن سفر..."
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className={styles.clearSearch}
                                onClick={() => setSearchTerm('')}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <BookRow title="العهد القديم" books={filteredBooks.ot} onBookClick={handleBookClick} />
            <BookRow title="العهد الجديد" books={filteredBooks.nt} onBookClick={handleBookClick} />

            {filteredBooks.ot.length === 0 && filteredBooks.nt.length === 0 && (
                <div className={styles.noResults}>
                    لم يتم العثور على نتائج لـ "{searchTerm}"
                </div>
            )}
        </div>
    );
}
