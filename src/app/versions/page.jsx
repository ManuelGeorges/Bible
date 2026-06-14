import styles from './versions.module.css';

export const metadata = {
  title: 'سجل التحديثات - Agios Bible',
  description: 'اطلع على حالة النسخة التجريبية والتحسينات الحالية للموقع.',
};

const updates = [
  {
    version: '1.8.0',
    date: 'التحديث الأخير',
    title: 'التشكيل والذكاء الاصطناعي',
    features: [
      'إضافة التشكيل للكتاب المقدس',
      'إضافة زر مشاركة كل نتائج البحث',
    ],
    fixes: [
      'تحسين عمل الذكاء الاصطناعي تحت الضغط',
    ]
  },
  {
    version: '1.7.9',
    date: 'تحديث فرعي',
    title: 'إصلاحات الخطط الدراسية',
    features: [],
    fixes: [
      'إصلاح أخطاء الخطط الدراسية في وضع الزائر جميعاً',
    ]
  },
  {
    version: '1.7.1',
    date: 'تحسينات عامة',
    title: 'استقرار النظام والاشعارات',
    features: [
      'تحسين نظام الإشعارات',
    ],
    fixes: [
      'حل مشكلة ظهور رسالة التهنئة بالوسام بشكل متكرر',
      'إصلاح خطأ رسالة "حدث الآن" التي لم تكن تعمل بالشكل الصحيح',
    ]
  },
  {
    version: '1.7.0',
    date: 'تحديث رئيسي',
    title: 'تطوير آية اليوم والمشاركة',
    features: [
      'تحسينات جذرية بآية اليوم وإمكانية تظليلها الآن ومشاركتها بأكثر من 20 صورة مختلفة بإعدادات متنوعة',
    ],
    fixes: [
      'حل مشكلة الأصحاح التالي والسابق ليعملان بالشكل المطلوب',
    ]
  },
  {
    version: '1.6.1',
    date: 'إصلاحات حرجة',
    title: 'إصلاحات تجربة المستخدم الزائر',
    features: [],
    fixes: [
      'إصلاح خطأ يمنع المستخدم غير المسجل من حفظ أي نشاط له',
      'إصلاح إجبار المستخدمين على تسجيل الدخول عند الضغط على أيقونة الملف الشخصي أو النقاط',
      'إصلاح بعض الأخطاء في احتساب الستريك (Streak)',
      'إصلاح خطأ في شكل رسالة "حدث الآن"',
    ]
  },
  {
    version: '1.6',
    date: 'تحديث واجهة المستخدم',
    title: 'وضع الزائر ومعايير آبل',
    features: [
      'جعل التطبيق يعمل بدون الحاجة لتسجيل الدخول',
    ],
    fixes: [
      'تحسينات في التصميم',
      'جعل التطبيق يتناسب بشكل أكبر مع معايير آبل من اهتزازات عند الضغط وردة فعل الأزرار والعناصر',
    ]
  },
  {
    version: '1.5',
    date: 'تحسينات الواجهة',
    title: 'الخطة المخصصة والذكاء',
    features: [
      'تحسين كبير في واجهة البرنامج',
      'جعل الخطة المخصصة أكثر مرونة وذكاءً',
    ],
    fixes: [
      'إصلاح العديد من الأخطاء',
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
  },
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
                <h3 className={styles.listTitle}>الميزات والتحسينات</h3>
                <ul className={styles.featureList}>
                  {update.features.map((feature, idx) => (
                    <li key={idx} className={styles.listItem}>{feature}</li>
                  ))}
                </ul>
              </>
            )}

            {update.fixes.length > 0 && (
              <>
                <h3 className={styles.listTitle}>الإصلاحات والحلول</h3>
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
