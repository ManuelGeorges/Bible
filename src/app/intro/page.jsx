'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './intro.module.css';

const IntroPage = () => {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    // If user is logged in and loading is complete, redirect to profile page
    if (user && !loading) {
      router.push('/profile');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return <div className={styles.loading}>جاري التحميل...</div>;
  }

  const features = [
    { title: 'مجاني تماماً', description: 'هذه المنظومة لا تضم أي اشتراكات أو رسوم أو تكاليف لأنها في الأساس بهدف الخدمة' },
    { title: 'معلوماتك آمنة', description: 'كل المعلومات التي تدخلها هي آمنة تماماً ومشفرة كما أنك لست ملزماً بادخال معلوماتك الحقيقية' },
    { title: 'المزيد من الأجهزة', description: 'الآن سيمكنك فتح نفس الحساب من العديد من الأجهزة مع الاحتفاظ بكل المعلومات والتقدم' },
    { title: 'الرجوع للآيات المفضلة والملاحظات', description: 'لن تفقد بعد الآن أي من آياتك المفضلة أو ملاحظاتك' },
    { title: 'استكمال الخطط الدراسية', description: 'حافظ على تقدمك في الخطط الكتابية والدراسية ' },
    { title: 'لا تضيع نقاطك', description: 'لن يتأثر مستواك ولا نقاطك بتبديلك لجهازك' },
    { title: 'المزيد من المزايا', description: 'من لديهم حسابات يحصلون على صلاحية مبكرة لمزايا جديدة وأحياناً مزايا حصرية لهم' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>لا تنسى تسجيل الدخول</h1>
        <p className={styles.subtitle}>
          احصل على المزيد من المزايا عقب إنشاءك لحساب جديد
        </p>
      </header>
      <main className={styles.mainContent}>
        <section className={styles.features}>
          <h2 className={styles.featuresTitle}>لماذا يجب أن تسجل الدخول؟</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className={styles.callToAction}>
          <p className={styles.ctaText}>ابدأ رحلتك الروحية اليوم وانضم إلينا.</p>
          <button onClick={() => router.push('/login')} className={styles.button}>
            ليس لديك حساب؟ أنشئ حساباً جديداً
          </button>
          <button onClick={() => router.push('/login')} className={styles.button}>
            لديك حساب بالفعل؟ سجل دخولك
          </button>
        </section>
      </main>
    </div>
  );
};

export default IntroPage;