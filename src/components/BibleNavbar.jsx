'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import styles from './layout.module.css';
import MoreSidebar from '../app/more/page.jsx';
import { toast } from 'react-hot-toast';

const ICONS = {
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    bible: "M12 11.67c2.68 0 5.92-1.28 5.92-1.28V5.83c0-.84-.99-1.39-1.76-.9l-4.16 2.49-4.16-2.49c-.77-.49-1.76.06-1.76.9v4.56s3.24 1.28 5.92 1.28z M21 5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5zm-2 14H5V5h14v14z",
    maps: "M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z",
    search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    more: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
};

export default function BibleNavbar() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setUser(authUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const NavIcon = ({ path }) => (
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d={path}></path>
        </svg>
    );

    if (loading) return null;

    return (
        <>
            <div className={styles.navbarWrapper}>
                <nav className={styles.navbar}>
                    {/* 1. الرئيسية (يمين) */}
                    <Link href="/" className={styles.navLink} aria-label="Home">
                        <NavIcon path={ICONS.home} />
                    </Link>

                    {/* 2. الكتاب المقدس (أيقونة أوضح) */}
                    <Link href="/bible" className={styles.navLink} aria-label="Read">
                        <NavIcon path={ICONS.bible} />
                    </Link>

                    {/* 3. الخريطة (أيقونة Map واضحة) */}
                    <Link 
                        href="/maps" 
                        className={styles.navLink} 
                        aria-label="Maps" 
                        onClick={(e) => {
                            if (!navigator.onLine) {
                                e.preventDefault();
                                toast.error("خرائط الـ 3D تتطلب اتصالاً بالإنترنت");
                            }
                        }}
                    >
                        <NavIcon path={ICONS.maps} />
                    </Link>

                    {/* 4. البحث */}
                    <Link href="/search" className={styles.navLink} aria-label="Search">
                        <NavIcon path={ICONS.search} />
                    </Link>

                    {/* 5. الملف الشخصي / المزيد (3 شرط - شمال) */}
                    <div
                        className={styles.navLink}
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ cursor: 'pointer' }}
                        aria-label="More"
                    >
                        <NavIcon path={ICONS.more} />
                    </div>
                </nav>
            </div>

            <MoreSidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                user={user}
            />
        </>
    );
}