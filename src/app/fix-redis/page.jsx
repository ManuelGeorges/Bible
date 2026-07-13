'use client';
import { useState } from 'react';
import { kv } from '../../lib/kv';

export default function FixRedisPage() {
    const [status, setStatus] = useState('جاهز لبدء عملية الإنقاذ...');
    const [loading, setLoading] = useState(false);

    const rescueData = async () => {
        setLoading(true);
        setStatus('جاري جلب المفاتيح من Redis...');
        try {
            // جلب كل المفاتيح
            const keys = await kv.keys('*');
            setStatus(`تم العثور على ${keys.length} مفتاح. جاري إلغاء تاريخ الانتهاء...`);

            let fixedCount = 0;
            for (const key of keys) {
                // أمر PERSIST في Redis يحول المفتاح من "مؤقت" إلى "دائم"
                await kv.persist(key);
                fixedCount++;
                setStatus(`تم إنقاذ ${fixedCount} من أصل ${keys.length}...`);
            }

            setStatus(`تمت العملية بنجاح! تم تحويل ${fixedCount} مفتاح إلى مفاتيح دائمة لن تُحذف أبداً.`);
        } catch (error) {
            console.error(error);
            setStatus('حدث خطأ أثناء العملية: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '50px', textAlign: 'center', direction: 'rtl' }}>
            <h1>صفحة إنقاذ بيانات Redis 🛡️</h1>
            <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>{status}</p>
            {!loading && (
                <button
                    onClick={rescueData}
                    style={{
                        padding: '15px 30px',
                        fontSize: '1rem',
                        backgroundColor: '#2ecc71',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    بدء عملية الإنقاذ الآن
                </button>
            )}
            {loading && <div className="spinner">جاري العمل... لا تغلق الصفحة</div>}
        </div>
    );
}
