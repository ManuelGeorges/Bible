import styles from './versions.module.css';

export const metadata = {
  title: 'سجل التحديثات - Agios Bible',
  description: 'اطلع على آخر التحديثات والإضافات والتحسينات التي تمت على الموقع.',
};

const updates = [
    {
    version: '1.3.0',
    date: '22 فبراير 2025',
    title: 'إصلاح أخطاء أساسية',
    features: ['جعل قسم المزيد يظهر بجانب الشاشة, تحسين الواجهة العامة للمستخدم, جعل قائمة الاختيارات أفضل'],
    fixes: ['إصلاح الكثير من المشاكل أبرزها عدم دعم الخريطة للغة العربية, عدم عمل البحث بالمشتقات بشكل سليم, تعطل اللمس وعدم فعاليته في قسم الكتاب المقدس']
  },
  {
    version: '1.2.0',
    date: '22 سبتمبر 2025',
    title: 'إطلاق أقسام جديدة',
    features: ['إطلاق صفحة المزيد التي تتشعب إلى ثلاثة أقسام جديدة وهم من نحن وتواصل معنا وقسم التحديثات', 'إضافة اللوجو الخاص بالموقع في الصفحة الرئيسية وفي نهاية كل صفحة'],
    fixes: ['إصلاح بعض المشاكل في المسافات الزائدة بين النصوص']
  },
  {
    version: '1.1.0',
    date: '14 سبتمبر 2025',
    title: 'تسهيل إيجاد الموقع على محركات البحث',
    features: ['بدء ظهور صفحات الموقع على محركات البحث مثل جوجل وغيرها', 'إضافة وصف وعنوان لكل صفحة على حدة مع تحسين شكل البطاقة التي يتم مشاركتها '],
    fixes: ['إصلاح مشكلة عدم عمل اللوجو']
  },
  {
    version: '1.0.1',
    date: '10 سبتمبر 2025',
    title: 'إصلاحات للأخطاء ',
    features: ['لا يوجد.'],
    fixes: ['تصليح العطل الذي يحدث عند الإجابة على سؤال اليوم', 'حل مشكلة عدم إمكانية حفظ بعض الآيات في المفضلة']
  },
    {
    version: '1.0.1',
    date: '3 سبتمبر 2025',
    title: 'الإطلاق الأولى والرسمي',
    features: ['إطلاق الموقع لأول مرة بكافة مزاياه ونشره على شبكة الإنترنت'],
    fixes: ['لا يوجد.']
  },
];

export default function VersionsPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>سجل التحديثات</h1>
      <p className={styles.introParagraph}>
        هنا يمكنك متابعة أحدث الإضافات والتحسينات التي تمت على الموقع.
      </p>
      <div className={styles.updatesGrid}>
        {updates.map((update, index) => (
          <div key={index} className={styles.updateCard}>
            <div className={styles.updateHeader}>
              <span className={styles.versionNumber}>الإصدار {update.version}</span>
              <span className={styles.updateDate}>{update.date}</span>
            </div>
            <h2 className={styles.updateTitle}>{update.title}</h2>
            {update.features.length > 0 && (
              <>
                <h3 className={styles.listTitle}>الإضافات الجديدة</h3>
                <ul className={styles.featureList}>
                  {update.features.map((feature, idx) => (
                    <li key={idx} className={styles.listItem}>
                      {feature}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {update.fixes.length > 0 && (
              <>
                <h3 className={styles.listTitle}>التحسينات والإصلاحات</h3>
                <ul className={styles.fixesList}>
                  {update.fixes.map((fix, idx) => (
                    <li key={idx} className={styles.listItem}>
                      {fix}
                    </li>
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