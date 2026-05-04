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

export default function BibleNavbar() {
    const [user, setUser] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setUser(authUser);
        });
        return () => unsubscribe();
    }, []);

    return (
        <>
            <div className={styles.navbarWrapper}>
                <nav className={styles.navbar}>
                    <Link href="/" className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`} aria-label="Home">
                        <Home size={24} />
                    </Link>

                    <Link href="/bible" className={`${styles.navLink} ${pathname.startsWith('/bible') ? styles.active : ''}`} aria-label="Read">
                        <BookOpenText size={24} />
                    </Link>

                    <Link 
                        href="/maps" 
                        className={`${styles.navLink} ${pathname === '/maps' ? styles.active : ''}`} 
                        aria-label="Maps" 
                        onClick={(e) => {
                            if (!navigator.onLine) {
                                e.preventDefault();
                                toast.error("خرائط الـ 3D تتطلب اتصالاً بالإنترنت");
                            }
                        }}
                    >
                        <MapIcon size={24} />
                    </Link>

                    <Link href="/search" className={`${styles.navLink} ${pathname === '/search' ? styles.active : ''}`} aria-label="Search">
                        <Search size={24} />
                    </Link>

                    <div
                        className={styles.navLink}
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ cursor: 'pointer' }}
                        aria-label="More"
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