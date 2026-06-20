'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import BadgeUnlockModal from '../../components/BadgeUnlockModal/BadgeUnlockModal';
import { AnimatePresence } from 'framer-motion';
import { StorageService, KEYS } from '../../lib/storage';
import { useLanguage } from './LanguageContext';

const BadgeContext = createContext();

export const BadgeProvider = ({ children }) => {
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [currentBadge, setCurrentBadge] = useState(null);
  const [badgesData, setBadgesData] = useState(null);
  const pendingIdsRef = useRef([]);
  const shownBadgesRef = useRef(new Set());
  const { language } = useLanguage();

  useEffect(() => {
    const badgeFileMap = {
      ar: '/data/badges.json',
      en: '/data/badges_en.json',
      fr: '/data/badges_fr.json',
      de: '/data/badges_de.json'
    };
    const fetchPath = badgeFileMap[language] || badgeFileMap.ar;
    setBadgesData(null);
    const loadBadgeData = async () => {
      try {
        const response = await fetch(fetchPath);
        if (!response.ok) throw new Error(`Failed to fetch ${fetchPath}`);
        const data = await response.json();
        setBadgesData(data);
        if (pendingIdsRef.current.length > 0) {
          pendingIdsRef.current.forEach(id => processBadgeId(id, data));
          pendingIdsRef.current = [];
        }
      } catch (err) {
        console.error(`Failed to load badges data for ${language}:`, err);
        if (language !== 'ar') {
          try {
            const fallbackResponse = await fetch('/data/badges.json');
            if (!fallbackResponse.ok) throw new Error('Failed fallback fetch');
            const fallbackData = await fallbackResponse.json();
            setBadgesData(fallbackData);
            if (pendingIdsRef.current.length > 0) {
              pendingIdsRef.current.forEach(id => processBadgeId(id, fallbackData));
              pendingIdsRef.current = [];
            }
          } catch (fallbackErr) {
            console.error('Failed to load fallback badges data:', fallbackErr);
          }
        }
      }
    };
    loadBadgeData();

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
  }, [language]);

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
