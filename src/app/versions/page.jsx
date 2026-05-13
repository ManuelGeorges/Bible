import styles from './versions.module.css';

export const metadata = {
  title: 'سجل التحديثات - Agios Bible',
  description: 'اطلع على حالة النسخة التجريبية والتحسينات الحالية للموقع.',
};

const updates = [
  {
    version: '1.0.0',
    date: '12 مايو 2026',
    title: 'النسخة الرسمية الأولى ',
    features: [
      'النسخة الأولى والرسمية التي تحمل كل الخصائص',
    ],
    fixes: [
      'تلا يوجد',
    ]
  },
  {
    version: '1.1.0',
    date: '13 مايو 2026',
    title: 'اصدار الخرائط المطورة',
    features: [
      'تزويد مكتبة الخرائط بخرائط جديدة',
      'اضافة البحث الذكي بالاماكن والمعالم التاريخية',
      'اضافة امكانية مشاهدة معلم ثم توجيه المستخدم لمكان ذكره بالانجيل',
      'اضافة قسم " جرب الذكاء الاصطناعي" بالصفحة الرئيسية لتسهيل تجربة المستخدم',
    ],
    fixes: [
      'حل مشكلة بطء قائمة اختار الاسفار والاصحاحات بقسم الكتاب المقدس',
      'تحسينات جذرية في تصميم صفحة المسابقات',
      'حل مشكلة عدم وضوح القوائم المنسدلة',


    ]
  }
];

export default function VersionsPage() {
  return (
    <div className={styles.container} dir="rtl">
      <h1 className={styles.title}>سجل التحديثات</h1>
      <p className={styles.introParagraph}>
        نحن حالياً في مرحلة الاختبار والتحسين المستمر للوصول لأفضل أداء.
      </p>

      <div className={styles.updatesGrid}>
        {updates.map((update, index) => (
          <div key={index} className={styles.updateCard} style={{ borderTop: '4px solid #D4AF37' }}>
            <div className={styles.updateHeader}>
              <span className={styles.versionNumber} style={{ color: '#D4AF37', fontWeight: 'bold' }}>
                {update.version}
              </span>
              <span className={styles.updateDate}>{update.date}</span>
            </div>
            <h2 className={styles.updateTitle}>{update.title}</h2>

            {update.features.length > 0 && (
              <>
                <h3 className={styles.listTitle}>الميزات الحالية</h3>
                <ul className={styles.featureList}>
                  {update.features.map((feature, idx) => (
                    <li key={idx} className={styles.listItem}>{feature}</li>
                  ))}
                </ul>
              </>
            )}

            {update.fixes.length > 0 && (
              <>
                <h3 className={styles.listTitle}>التحسينات المستمرة</h3>
                <ul className={styles.fixesList}>
                  {update.fixes.map((fix, idx) => (
                    <li key={idx} className={styles.listItem}>{fix}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}