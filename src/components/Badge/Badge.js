import React from 'react';
import styles from './Badge.module.css';
import * as Icons from 'lucide-react';

const Badge = ({ badge, familyName, isUnlocked = false }) => {
  const iconFamilyMap = {
    "المثابرة": Icons.Flame,
    "القارئ النهم": Icons.BookOpen,
    "المعرفة": Icons.BrainCircuit,
    "الدقة": Icons.Target,
    "الاستكشاف الجغرافي": Icons.MapPin,
    "الكنز الروحي": Icons.Heart,
    "السفير والدعم": Icons.Megaphone,
    "الوفاء التقني": Icons.Zap,
    "الفئة السرية": Icons.Lock
  };

  const IconComponent = iconFamilyMap[familyName] || Icons.Award;
  
  const rarityClass = styles[`rarity_${badge.rarity}`] || '';
  const badgeClasses = `${styles.badgeContainer} ${rarityClass} ${!isUnlocked ? styles.locked : ''}`;

  return (
    <div className={styles.wholeBadgeWrapper}>
      {/* كونتينر البادج المربع */}
      <div className={badgeClasses}>
        <div className={styles.innerContent}>
          <IconComponent className={styles.badgeIcon} strokeWidth={1.5} />
          <span className={styles.badgeNameInside}>{badge.name}</span>
        </div>
      </div>
<p className={`${styles.rarity} ${styles[`rarity_${badge.rarity}`]}`}>
  {badge.rarity}
</p>
      <p className={styles.externalRequirement}>
        {badge.requirement}
      </p>
    </div>
  );
};

export default Badge;