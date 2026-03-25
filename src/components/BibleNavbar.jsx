'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import styles from './layout.module.css';
import MoreSidebar from '../app/more/page.jsx';
import { toast } from 'react-hot-toast'; // تأكد من تثبيت المكتبة: npm install react-hot-toast

// فصل الـ Icons عشان الكود يبقى أنظف
const ICONS = {
    more: "M4 6H20V8H4V6ZM4 11H20V13H4V11ZM4 16H20V18H4V16Z",
    search: "M15.5 14H14.71L14.25 13.59C15.41 12.09 16.17 10.15 16.17 8.08C16.17 3.63 12.54 0 8.08 0C3.63 0 0 3.63 0 8.08C0 12.54 3.63 16.17 8.08 16.17C10.15 16.17 12.09 15.41 13.59 14.25L14 14.71V15.5L19.5 21L21 19.5L15.5 14ZM8.08 14C4.75 14 2 11.25 2 8.08C2 4.75 4.75 2 8.08 2C11.25 2 14 4.75 14 8.08C14 11.25 11.25 14 8.08 14Z",
    home: "M11.0001 1.00006L1.00006 9.00006V23.0001H9.00006V15.0001H15.0001V23.0001H23.0001V9.00006L13.0001 1.00006H11.0001Z",
    bible: "M21 21H7V3H21V21ZM7 21C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H21C22.1046 3 23 3.89543 23 5V19C23 20.1046 22.1046 21 21 21H7ZM3 21H1V5C1 3.89543 1.89543 3 3 3V21Z",
    maps: "M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"
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

    // دالة مساعدة لرسم الأيقونة
    const NavIcon = ({ path }) => (
        <svg viewBox="0 0 24 24" fill="currentColor" className={styles.navIcon}>
            <path d={path}></path>
        </svg>
    );

    if (loading) return null; // أو ممكن ترجع نسخة باهتة من الـ Navbar

    return (
        <>
            <div className={styles.navbarWrapper}>
                <nav className={styles.navbar}>
                    <div
                        className={styles.navLink}
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ cursor: 'pointer' }}
                        aria-label="More"
                    >
                        <NavIcon path={ICONS.more} />
                    </div>

                    <Link href="/search" className={styles.navLink} aria-label="Search">
                        <NavIcon path={ICONS.search} />
                    </Link>

                    <Link href="/" className={styles.navLink} aria-label="Home">
                        <NavIcon path={ICONS.home} />
                    </Link>

                    <Link href="/bible" className={styles.navLink} aria-label="Read">
                        <NavIcon path={ICONS.bible} />
                    </Link>

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