'use client';
import Link from 'next/link';
import { Heart, Trophy, BookOpen, User, Coins, Info, Mail, History, X, Settings, ShieldCheck } from 'lucide-react';
import styles from './more.module.css';

export default function MoreSidebar({ isOpen, onClose, user }) {
  const menuItems = [
    { name: 'الملاحظات والتفضيلات', icon: <Heart size={20} />, href: '/favourites' },
    { name: 'المسابقات', icon: <Trophy size={20} />, href: '/competitions' },
    { name: 'خطط القراءة', icon: <BookOpen size={20} />, href: '/studyPlans' },
    { name: 'الملف الشخصي', icon: <User size={20} />, href: '/profile' },
    { name: 'الإعدادات', icon: <Settings size={20} />, href: '/settings' }, 
  ];

  return (
    <>
      <div className={`${styles.overlay} ${isOpen ? styles.showOverlay : ''}`} onClick={onClose} />
      
      <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h1 className={styles.title}>المزيد</h1>
          <button className={styles.closeBtn} onClick={onClose}><X size={24} /></button>
        </div>

        <div className={styles.gridContainer}>
          {menuItems.map((item, index) => (
            <Link key={index} href={item.href} className={styles.gridItem} onClick={onClose}>
              <div className={styles.iconWrapper}>{item.icon}</div>
              <span className={styles.itemText}>{item.name}</span>
            </Link>
          ))}
          
          {user && (
            <Link href="/points" className={styles.gridItem} onClick={onClose}>
              <div className={styles.iconWrapper}><Coins size={20} /></div>
              <span className={styles.itemText}>النقاط</span>
            </Link>
          )}
        </div>

        <div className={styles.bottomDivider} />

        <div className={styles.footerLinks}>
          <Link href="/about" className={styles.footerItem} onClick={onClose}>
             <Info size={22} /> <span>من نحن</span>
          </Link>
          <Link href="/contact" className={styles.footerItem} onClick={onClose}>
             <Mail size={22} /> <span>تواصل معنا</span>
          </Link>
          <Link href="/versions" className={styles.footerItem} onClick={onClose}>
             <History size={22} /> <span>التحديثات</span>
          </Link>
          <Link href="/privacy-policy" className={styles.footerItem} onClick={onClose}>
             <ShieldCheck size={22} /> <span>سياسة الخصوصية</span>
          </Link>
        </div>
      </div>
    </>
  );
}