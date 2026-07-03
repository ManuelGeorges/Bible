"use client";
import React, { useEffect, useState } from 'react';
import styles from './Footer.module.css';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../app/context/LanguageContext';

const Footer = () => {
    const { strings, language } = useLanguage();
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
            <div className={styles.footerContent}>
                <div className={styles.footerBrand}>
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
                </div>

                <div className={styles.footerInfo}>
                    <div className={styles.footerLinks}>
                        <div className={styles.linkGroup}>
                            <h4>{language === 'ar' ? 'تحميل التطبيق' : 'Download App'}</h4>
                            <div className={styles.apps}>
                                <a href="https://play.google.com/store/apps/details?id=com.agios.bible" target="_blank" rel="noopener noreferrer">Google Play</a>
                                <a href="https://apps.apple.com/eg/app/agios-bible-holy-bible/id6773141320" target="_blank" rel="noopener noreferrer">App Store</a>
                            </div>
                        </div>
                        <div className={styles.linkGroup}>
                            <h4>{language === 'ar' ? 'المطور' : 'Developer'}</h4>
                            <a href="https://mano-dev.vercel.app/" target="_blank" rel="noopener noreferrer" className={styles.devLink}>Manuel Georges</a>
                        </div>
                    </div>
                    <p dir="ltr" className={styles.footerText}>
                        {strings.about.footer}
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
