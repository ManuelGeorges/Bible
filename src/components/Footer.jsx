// components/Footer.jsx
"use client";
import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
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
        } else {
            console.log('Web Share API is not supported on this browser.');
        }
    };

    return (
        <footer className={styles.footer}>
            <a href="https://agios-bible.vercel.app/">
            <img 
                src="/images/agios.png" 
                alt="Agios Bible official logo" 
                className={styles.footerLogo} 
            />
            </a>
            <button className={styles.shareButton} onClick={shareWebsite}>
                شارك الموقع
            </button>
            <p dir="ltr" className={styles.footerText}>
                © Copyright Agios Bible 2025, All Rights Reserved.
            </p>
        </footer>
    );
};

export default Footer;