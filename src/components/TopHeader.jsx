"use client";

import { useRouter, usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import styles from './TopHeader.module.css';
import { useLanguage } from '../app/context/LanguageContext';

export default function TopHeader() {
  const { strings } = useLanguage();
    const router = useRouter();
    const pathname = usePathname();

    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/$/, "");

    const isHomePage = cleanPath === '/';

    if (isHomePage) return null;

    return (
        <div className={styles.container}>
            <button
                className={styles.backBtn}
                onClick={() => router.back()}
                aria-label={strings.components.top_header.back}
            >
                <ChevronRight size={28} />
            </button>
        </div>
    );
}
