'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import BadgeUnlockModal from '../../components/BadgeUnlockModal/BadgeUnlockModal';
import { AnimatePresence } from 'framer-motion';

const BadgeContext = createContext();

export const BadgeProvider = ({ children }) => {
  const [unlockedBadge, setUnlockedBadge] = useState(null);
  const [badgesData, setBadgesData] = useState(null);

  useEffect(() => {
    fetch('/data/badges.json')
      .then(res => res.json())
      .then(data => setBadgesData(data))
      .catch(err => console.error("Failed to load badges data:", err));
  }, []);

  const triggerBadgeUnlock = useCallback((badgeId) => {
    if (!badgesData) return;

    for (const family of badgesData.badge_families) {
      const badge = family.badges.find(b => b.id === badgeId);
      if (badge) {
        setUnlockedBadge({ ...badge, familyName: family.family_name });
        return;
      }
    }
  }, [badgesData]);

  const closeReached = () => setUnlockedBadge(null);

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
