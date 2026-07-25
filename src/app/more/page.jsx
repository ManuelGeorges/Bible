'use client';
import Link from 'next/link';
import { Heart, Trophy, BookOpen, User, Coins, Info, Mail, History, X, Settings, ShieldCheck, LayoutGrid, Clock } from 'lucide-react';
import styles from './more.module.css';
import { useLanguage } from '../context/LanguageContext';
import { Capacitor } from '@capacitor/core';

export default function MoreSidebar({ isOpen, onClose, user }) {
  const { strings, language } = useLanguage();
  const isAndroid = Capacitor.getPlatform() === 'android';

  const menuItems = [
    { name: strings.more.items.favourites, icon: <Heart size={20} />, href: '/favourites' },
    { name: strings.more.items.readingHistory, icon: <Clock size={20} />, href: '/bible/history' },
    language === 'ar' ? { name: strings.more.items.competitions, icon: <Trophy size={20} />, href: '/competitions' } : null,
    { name: strings.more.items.studyPlans, icon: <BookOpen size={20} />, href: '/studyPlans' },
    // إضافة الأدوات المصغرة للأندرويد
    isAndroid ? { name: strings.more.items.widgets || "الأدوات المصغرة", icon: <LayoutGrid size={20} />, href: '/widgets' } : null,
    { name: strings.more.items.profile, icon: <User size={20} />, href: '/profile' },
    { name: strings.more.items.settings, icon: <Settings size={20} />, href: '/settings' },
    { name: strings.more.items.points, icon: <Coins size={20} />, href: '/points' },
  ].filter(Boolean);

  return (
    <>
      <div className={`${styles.overlay} ${isOpen ? styles.showOverlay : ''}`} onClick={onClose} />
      
      <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h1 className={styles.title}>{strings.more.title}</h1>
          <button className={styles.closeBtn} onClick={onClose}><X size={24} /></button>
        </div>

        <div className={styles.gridContainer}>
          {menuItems.map((item, index) => (
            <Link key={index} href={item.href} className={styles.gridItem} onClick={onClose}>
              <div className={styles.iconWrapper}>{item.icon}</div>
              <span className={styles.itemText}>{item.name}</span>
            </Link>
          ))}
        </div>

        <div className={styles.bottomDivider} />

        <div className={styles.footerLinks}>
          <Link href="/about" className={styles.footerItem} onClick={onClose}>
             <Info size={22} /> <span>{strings.more.footer.about}</span>
          </Link>
          <Link href="/contact" className={styles.footerItem} onClick={onClose}>
             <Mail size={22} /> <span>{strings.more.footer.contact}</span>
          </Link>
          <Link href="/versions" className={styles.footerItem} onClick={onClose}>
             <History size={22} /> <span>{strings.more.footer.versions}</span>
          </Link>
          <Link href="/privacy-policy" className={styles.footerItem} onClick={onClose}>
             <ShieldCheck size={22} /> <span>{strings.more.footer.privacy}</span>
          </Link>
        </div>
      </div>
    </>
  );
}