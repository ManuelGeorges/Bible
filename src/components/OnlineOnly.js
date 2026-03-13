'use client';
import { useOnlineStatus } from '../hooks/useOnlineStatus'; // الـ hook اللي عملناه قبل كدة
import { useEffect, useState } from 'react';

export default function OnlineOnly({ children }) {
  const isOnline = useOnlineStatus();
  const [mounted, setMounted] = useState(false);

  // عشان نتجنب مشاكل الـ Hydration في Next.js
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (!isOnline) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '20px'
      }}>
        <div style={{ fontSize: '50px' }}>🌐</div>
        <h2 style={{ color: '#e74c3c' }}>عذراً، هذه الصفحة غير متوفرة أوفلاين</h2>
        <p>يرجى الاتصال بالإنترنت لتتمكن من تصفح الخرائط والبيانات التفاعلية.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '10px 20px', marginTop: '15px', cursor: 'pointer' }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return children;
}