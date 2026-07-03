"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import styles from './layout.module.css';
import MoreSidebar from '../app/more/page.jsx';
import { toast } from 'react-hot-toast';
import { Home, BookOpenText, Map as MapIcon, Search, Menu } from 'lucide-react';
import { useLanguage } from '../app/context/LanguageContext';

export default function BibleNavbar() {
    const [user, setUser] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();
    const { strings } = useLanguage();

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setUser(authUser);
        });
        return () => unsubscribe();
    }, []);

    // دالة وقائية للتأكد من أن النص ليس كائناً (Object) لمنع React Error #31
    const safeText = (text) => {
        if (typeof text === 'object' && text !== null) {
            return "";
        }
        return text || "";
    };

    return (
        <>
            <div className={styles.navbarWrapper}>
                <nav className={styles.navbar}>
                    <Link
                        href="/"
                        prefetch={false}
                        className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
                        aria-label={safeText(strings?.components?.bible_nav?.home)}
                    >
                        <Home size={24} />
                    </Link>

                    <Link
                        href="/bible"
                        prefetch={false}
                        className={`${styles.navLink} ${pathname.startsWith('/bible') ? styles.active : ''}`}
                        aria-label={safeText(strings?.components?.bible_nav?.read)}
                    >
                        <BookOpenText size={24} />
                    </Link>

                    <Link 
                        href="/maps" 
                        prefetch={false}
                        className={`${styles.navLink} ${pathname.startsWith('/maps') ? styles.active : ''}`}
                        aria-label={safeText(strings?.components?.bible_nav?.maps)}
                        onClick={(e) => {
                            if (!navigator.onLine) {
                                e.preventDefault();
                                toast.error(safeText(strings?.maps?.error_offline));
                            }
                        }}
                    >
                        <MapIcon size={24} />
                    </Link>

                    <Link
                        href="/search"
                        prefetch={false}
                        className={`${styles.navLink} ${pathname.startsWith('/search') ? styles.active : ''}`}
                        aria-label={safeText(strings?.components?.bible_nav?.search)}
                    >
                        <Search size={24} />
                    </Link>

                    <div
                        className={styles.navLink}
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ cursor: 'pointer' }}
                        aria-label={safeText(strings?.components?.bible_nav?.more)}
                    >
                        <Menu size={24} />
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
