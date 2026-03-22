"use client";
import React, { useEffect, useState } from 'react';
import styles from './Footer.module.css';
import { Capacitor } from '@capacitor/core';

const Footer = () => {
    const [isApp, setIsApp] = useState(false);

    useEffect(() => {
        // التأكد إذا كان التطبيق يعمل كـ Native App (Android/iOS)
        if (Capacitor.isNativePlatform()) {
            setIsApp(true);
        }
    }, []);

    const shareWebsite = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Agios Bible - تطبيقك لدراسة الكتاب المقدس',
                    text: 'اكتشف تطبيق Agios Bible لدراسة الكتاب المقدس وقراءة آيات يومية.',
                    url: 'https://agios-bible.vercel.app/',
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        }
    };

    // لو المستخدم فاتح من الأبليكيشن، مش هنعرض الفوتر خالص
    if (isApp) return null;

    return (
        <footer className={styles.footer}>
            <a href="https://agios-bible.vercel.app/">
                <img 
                    src="/images/Agios.png" 
                    alt="Agios Bible official logo" 
                    className={styles.footerLogo} 
                />
            </a>
            <button className={styles.shareButton} onClick={shareWebsite}>
                شارك الموقع
            </button>
            <p dir="ltr" className={styles.footerText}>
                © Copyright Agios Bible 2026, All Rights Reserved.
            </p>
        </footer>
    );
};

export default Footer;