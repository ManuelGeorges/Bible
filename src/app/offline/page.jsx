// src/app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      textAlign: 'center',
      padding: '20px',
      backgroundColor: '#0f172a', // نفس لون ثيم تطبيقك
      color: '#fff'
    }}>
      <h1>أنت غير متصل بالإنترنت</h1>
      <p>يبدو أنك تحاول الوصول لصفحة لم يتم حفظها مسبقاً.</p>
      <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
        نصيحة: تصفح الأسفار وأنت متصل بالنت ليتم حفظها أوتوماتيكياً هنا.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#fbbf24', 
          color: '#000',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
export const metadata = {
  title: "أوفلاين - Agios Bible",
};