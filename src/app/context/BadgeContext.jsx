'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import BadgeUnlockModal from '../../components/BadgeUnlockModal/BadgeUnlockModal';
import { AnimatePresence } from 'framer-motion';
import { StorageService, KEYS } from '../../lib/storage';

const BadgeContext = createContext();

export const BadgeProvider = ({ children }) => {
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [currentBadge, setCurrentBadge] = useState(null);
  const [badgesData, setBadgesData] = useState(null);
  const pendingIdsRef = useRef([]);
  const shownBadgesRef = useRef(new Set());

  useEffect(() => {
    // تحميل بيانات الأوسمة
    fetch('/data/badges.json')
      .then(res => res.json())
      .then(data => {
        setBadgesData(data);
        // معالجة الأوسمة التي تم استدعاؤها قبل اكتمال التحميل
        if (pendingIdsRef.current.length > 0) {
          pendingIdsRef.current.forEach(id => processBadgeId(id, data));
          pendingIdsRef.current = [];
        }
      })
      .catch(err => console.error("Failed to load badges data:", err));

    // تحميل الأوسمة التي عُرضت سابقاً لمنع تكرارها
    const loadShownBadges = async () => {
      try {
        const stored = await StorageService.get(KEYS.SHOWN_BADGES);
        if (stored && Array.isArray(stored)) {
          shownBadgesRef.current = new Set(stored);
        }
      } catch (err) {
        console.error("Failed to load shown badges:", err);
      }
    };
    loadShownBadges();
  }, []);

  const processBadgeId = (badgeId, data) => {
    if (shownBadgesRef.current.has(badgeId)) return;

    for (const family of data.badge_families) {
      const badge = family.badges.find(b => b.id === badgeId);
      if (badge) {
        const badgeWithFamily = { ...badge, familyName: family.family_name };
        setBadgeQueue(prev => [...prev, badgeWithFamily]);
        return;
      }
    }
  };

  const triggerBadgeUnlock = useCallback((badgeId) => {
    if (shownBadgesRef.current.has(badgeId)) return;

    if (!badgesData) {
      pendingIdsRef.current.push(badgeId);
      return;
    }

    processBadgeId(badgeId, badgesData);
  }, [badgesData]);

  // التحكم في عرض الطابور (واحد تلو الآخر)
  useEffect(() => {
    if (!currentBadge && badgeQueue.length > 0) {
      setCurrentBadge(badgeQueue[0]);
      setBadgeQueue(prev => prev.slice(1));
    }
  }, [badgeQueue, currentBadge]);

  const closeReached = async () => {
    if (currentBadge) {
      const badgeId = currentBadge.id;
      shownBadgesRef.current.add(badgeId);
      await StorageService.save(KEYS.SHOWN_BADGES, Array.from(shownBadgesRef.current));
    }
    setCurrentBadge(null);
  };

  return (
    <BadgeContext.Provider value={{ triggerBadgeUnlock }}>
      {children}
      <AnimatePresence>
        {currentBadge && (
          <BadgeUnlockModal
            badge={currentBadge}
            onClose={closeReached}
          />
        )}
      </AnimatePresence>
    </BadgeContext.Provider>
  );
};

export const useBadge = () => {
  const context = useContext(BadgeContext);
  if (!context) {
    throw new Error('useBadge must be used within a BadgeProvider');
  }
  return context;
};
