'use client';

import React from 'react';
import styles from './BadgeUnlockModal.module.css';
import { motion } from 'framer-motion';
import { X, Share2, Trophy, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import * as Icons from 'lucide-react';

const BadgeUnlockModal = ({ badge, onClose }) => {
  const router = useRouter();

  const iconFamilyMap = {
    "المثابرة": Icons.Flame,
    "القارئ النهم": Icons.BookOpen,
    "المعرفة": Icons.BrainCircuit,
    "الدقة": Icons.Target,
    "الاستكشاف الجغرافي": Icons.MapPin,
    "الكنز الروحي": Icons.Heart,
    "الوفاء التقني": Icons.Zap,
    "الفئة السرية": Icons.Lock,
    "المواظبة على الخطط": Icons.CalendarCheck,
    "إنجازات الخطط": Icons.Trophy
  };

  const IconComponent = iconFamilyMap[badge.familyName] || Trophy;

  const handleShare = async () => {
    const text = `🎉 حصلت على وسام جديد في تطبيق أجيوس: ${badge.name}!\n"${badge.requirement}"\nحمّل التطبيق وانضم إلينا في رحلتنا الروحية.`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'وسام جديد!',
          text: text,
          url: 'https://agios-bible.vercel.app/',
          dialogTitle: 'مشاركة الوسام عبر...',
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'وسام جديد!',
          text: text,
          url: 'https://agios-bible.vercel.app/'
        });
      }
    } catch (err) {
      console.log('Share error', err);
    }
  };

  if (!badge) return null;

  return (
    <div className={styles.overlay}>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className={styles.modal}
      >
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <div className={styles.celebrationText}>مبروك! إنجاز جديد</div>

        <div className={styles.badgeDisplay}>
          <div className={styles.iconWrapper}>
            <div className={styles.glow} />
            <IconComponent size={48} strokeWidth={1.5} />
          </div>
          <div className={`${styles.rarityTag} ${styles[`rarity_${badge.rarity}`]}`}>
            {badge.rarity}
          </div>
          <h2 className={styles.badgeName}>{badge.name}</h2>
        </div>

        <p className={styles.description}>{badge.requirement}</p>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleShare}>
            <Share2 size={20} /> مشاركة الإنجاز
          </button>
          <button className={styles.secondaryBtn} onClick={() => { router.push('/points'); onClose(); }}>
            عرض كل الأوسمة <ArrowRight size={20} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BadgeUnlockModal;
