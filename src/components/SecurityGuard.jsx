'use client';

import { useEffect } from 'react';

export default function SecurityGuard() {
  return null;
  /*useEffect(() => {
    // 1. منع القائمة المنبثقة (الكليك يمين)
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // 2. منع اختصارات لوحة المفاتيح لأدوات المطورين
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) || 
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null; // مكون صامت لا يظهر في الواجهة*/
}