"use client";
import { useEffect } from 'react';

export default function DataPrefetcher() {
  useEffect(() => {
    const forceLoad = async () => {
      const files = [
        '/data/bibles/ar_svd.json',
        '/data/bookNames.json',
        '/data/dailyVerses.json',
        '/data/dailyQuestions.json'
      ];

      for (const file of files) {
        try {
          fetch(file, { priority: 'high' }).catch(() => {});
        } catch (e) {}
      }
    };

    if (document.readyState === 'complete') {
      forceLoad();
    } else {
      window.addEventListener('load', forceLoad);
    }
  }, []);

  return null;
}