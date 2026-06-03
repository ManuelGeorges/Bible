'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import BadgeUnlockModal from '../../components/BadgeUnlockModal/BadgeUnlockModal';
import { AnimatePresence } from 'framer-motion';
import { StorageService, KEYS } from '../../lib/storage';

const BadgeContext = createContext();

export const BadgeProvider = ({ children }) => {
  const [unlockedBadge, setUnlockedBadge] = useState(null);
  const [badgesData, setBadgesData] = useState(null);
  const [shownBadges, setShownBadges] = useState(new Set());

  useEffect(() => {
    // Load badges configuration
    fetch('/data/badges.json')
      .then(res => res.json())
      .then(data => setBadgesData(data))
      .catch(err => console.error("Failed to load badges data:", err));

    // Load already shown badges from storage
    const loadShownBadges = async () => {
      try {
        const stored = await StorageService.get(KEYS.SHOWN_BADGES);
        if (stored && Array.isArray(stored)) {
          setShownBadges(new Set(stored));
        }
      } catch (err) {
        console.error("Failed to load shown badges:", err);
      }
    };
    loadShownBadges();
  }, []);

  const triggerBadgeUnlock = useCallback((badgeId) => {
    if (!badgesData || shownBadges.has(badgeId)) return;

    for (const family of badgesData.badge_families) {
      const badge = family.badges.find(b => b.id === badgeId);
      if (badge) {
        setUnlockedBadge({ ...badge, familyName: family.family_name });
        return;
      }
    }
  }, [badgesData, shownBadges]);

  const closeReached = async () => {
    if (unlockedBadge) {
      const badgeId = unlockedBadge.id;
      setShownBadges(prev => {
        const newSet = new Set(prev);
        newSet.add(badgeId);
        // Save to storage
        StorageService.save(KEYS.SHOWN_BADGES, Array.from(newSet));
        return newSet;
      });
    }
    setUnlockedBadge(null);
  };

  return (
    <BadgeContext.Provider value={{ triggerBadgeUnlock }}>
      {children}
      <AnimatePresence>
        {unlockedBadge && (
          <BadgeUnlockModal
            badge={unlockedBadge}
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
