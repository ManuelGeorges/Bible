"use client";
import { useState, useEffect } from 'react';

export default function CachePopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // التأكد إذا كان المستخدم شاف الرسالة دي قبل كده
    const hasSeenPopup = localStorage.getItem('hasSeenCachePopup');
    if (!hasSeenPopup) {
      setIsVisible(true);
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem('hasSeenCachePopup', 'true');
    setIsVisible(false);
    // إرسال إشارة للـ Handler ليبدأ السحب العميق (اختياري)
    window.dispatchEvent(new CustomEvent('start-deep-crawl'));
  };

  if (!isVisible) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ fontSize: '40px', marginBottom: '15px' }}>📶</div>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>تجربة أفضل بدون إنترنت!</h3>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
          لضمان عمل التطبيق بكفاءة عالية في وضع الأوفلاين، نرجو منك تصفح أقسام التطبيق سريعاً وأنت متصل بالإنترنت ليتم حفظها تلقائياً.
        </p>
        <button onClick={handleConfirm} style={buttonStyle}>
          فهمت، شكراً!
        </button>
      </div>
    </div>
  );
}

// تنسيقات سريعة (تقدر تغيرها حسب ستايل مشروعك)
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
  alignItems: 'center', zIndex: 9999, padding: '20px'
};

const modalStyle = {
  backgroundColor: '#fff', padding: '30px', borderRadius: '20px',
  maxWidth: '400px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
  animation: 'fadeIn 0.3s ease-out'
};

const buttonStyle = {
  marginTop: '20px', padding: '12px 25px', backgroundColor: '#0070f3',
  color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
  fontWeight: 'bold', fontSize: '16px', width: '100%'
};