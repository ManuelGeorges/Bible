"use client"; // هذا السطر هو الحل

export default function OfflinePage() {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '100px 20px', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '70vh' 
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>أنت حالياً غير متصل بالإنترنت</h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '30px' }}>
        هذه الصفحة تتطلب اتصالاً بالشبكة لتحديث البيانات. 
        <br />
        يمكنك تصفح أجزاء الكتاب المقدس التي تم تحميلها مسبقاً.
      </p>
      
      <button 
        onClick={() => window.location.reload()} 
        style={{ 
          padding: '12px 25px', 
          fontSize: '1rem', 
          backgroundColor: '#0070f3', 
          color: 'white', 
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