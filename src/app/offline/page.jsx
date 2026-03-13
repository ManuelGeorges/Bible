'use client';

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
      backgroundColor: '#0f172a',
      color: '#fff',
      direction: 'rtl'
    }}>
      <h1>أنت غير متصل بالإنترنت</h1>
      <p>يبدو أنك تحاول الوصول لصفحة لم يتم حفظها مسبقاً.</p>
      <button 
        onClick={() => window.location.reload()} 
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#fbbf24',
          color: '#000',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}