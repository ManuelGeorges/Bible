"use client";
import React, { useEffect, useState } from 'react';
import styles from './Footer.module.css';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../app/context/LanguageContext';

const Footer = () => {
    const { strings } = useLanguage();
    const [isApp, setIsApp] = useState(false);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            setIsApp(true);
        }
    }, []);

    const shareWebsite = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: strings.profile.share_title,
                    text: strings.profile.share_text,
                    url: 'https://agios-bible.vercel.app/',
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        }
    };

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
                {strings.profile.share_dialog}
            </button>
            <p dir="ltr" className={styles.footerText}>
                {strings.about.footer}
            </p>
        </footer>
    );
};

export default Footer;