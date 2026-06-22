'use client';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '../app/context/LanguageContext';

export default function ConnectivityListener() {
  const { strings, dir } = useLanguage();

  useEffect(() => {
    const handleGlobalClick = (e) => {
      // بنشوف لو الكليك على عنصر واخد class 'requires-online' والنت مفصول
      if (!navigator.onLine && e.target.closest('.requires-online')) {
        e.preventDefault();
        e.stopPropagation();

        // إظهار الرسالة بشكل احترافي ومترجم
        toast.error(strings.common.internet_required, {
          icon: '🌐',
          duration: 4000,
          style: {
            borderRadius: '12px',
            background: '#2d3436',
            color: '#fff',
            direction: dir,
          },
        });
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [strings, dir]);

  return null;
}