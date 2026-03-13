'use client';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ConnectivityListener() {
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // بنشوف لو الكليك على عنصر واخد class 'requires-online' والنت مفصول
      if (!navigator.onLine && e.target.closest('.requires-online')) {
        e.preventDefault();
        e.stopPropagation();

        // إظهار الرسالة بشكل احترافي
        toast.error('هذه الخاصية تتطلب اتصالاً بالإنترنت', {
          icon: '🌐',
          duration: 4000,
          style: {
            borderRadius: '12px',
            background: '#2d3436',
            color: '#fff',
            direction: 'rtl', // عشان الكلام العربي يتظبط
          },
        });
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  return null;
}