"use client";

import { useRouter, usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import styles from './TopHeader.module.css';

export default function TopHeader() {
    const router = useRouter();
    const pathname = usePathname();

    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/$/, "");
    const mainPages = ['/', '/bible', '/maps', '/search'];
    const isMainPage = mainPages.includes(cleanPath);

    if (isMainPage) return null;

    return (
        <div className={styles.container}>
            <button
                className={styles.backBtn}
                onClick={() => router.back()}
                aria-label="الرجوع"
            >
                <ChevronRight size={28} />
            </button>
        </div>
    );
}
