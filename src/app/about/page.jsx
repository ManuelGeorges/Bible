import styles from './about.module.css';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>عن تطبيق Agios</h1>
        <p className={styles.tagline}>"كلمتك هي سراج لرجلي ونور لسبيلي" (مز 119: 105)</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>القصة والهدف</h2>
        <p className={styles.paragraph}>
          انطلق مشروع <strong>Agios</strong> برؤية تهدف إلى تقديم تجربة رقمية متطورة لدراسة الكتاب المقدس. كانت البداية من خلال المشاركة في مهرجان الكرازة المرقسية بالإسكندرية، حيث سعى المشروع لتقديم حلول تقنية مبتكرة، مثل البحث اللغوي المتقدم، الخرائط التفاعلية للأماكن المقدسة، وواجهة مستخدم عصرية تساعد على التركيز والنمو الروحي.
        </p>
        <p className={styles.paragraph}>
          بعد النجاح في مراحله الأولى، استمر العمل على تطوير المنصة لتصبح مرجعاً شاملاً يجمع بين أدوات الدراسة اليومية والخصائص التقنية الحديثة، بما يخدم احتياجات الشباب والدارسين في العصر الرقمي.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>رؤيتنا</h2>
        <p className={styles.paragraph}>
          تتمثل رؤية <strong>Agios</strong> في أن يكون جسراً تقنياً يربط الأجيال بكلمة الله، مستخدماً أدوات العصر الحديث في تقديم المحتوى الكتابي بصورة جذابة ومبسطة، مع الالتزام الكامل بأسس العقيدة الأرثوذكسية القويمة وتسليمات الكنيسة الجامعة.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.subtitle}>شكر وتقدير</h2>
        
        <div className={styles.honorableMention}>
          <div className={styles.priestImageWrapper}>
            <Image 
              src="/images/fr-athanasius.jpg" 
              alt="قدس القمص أثناسيوس" 
              width={140} 
              height={140} 
              className={styles.priestImage}
            />
          </div>
          <div className={styles.priestText}>
            <p className={styles.paragraph}>
              نتقدم بوافر الشكر والمحبة 
              <span className={styles.important}> لقدس القمص أثناسيوس </span> 
              لرعايته الأبوية الدائمة لهذا العمل منذ لحظاته الأولى، وتبنيه للفكرة ودعمها لتخرج بصورة تليق بكلمة الله وتكون بركة ومنفعة لكل مستخدميها.
            </p>
          </div>
        </div>

        <hr className={styles.dividerLine} />

        <p className={styles.paragraph}> 
          نتوجه بالشكر والتقدير لبيتنا العامر 
          <span className={styles.important}> كنيسة رئيس الملائكة الجليل ميخائيل بمصطفى كامل - الإسكندرية </span>
          على الدعم والتشجيع المستمر، وإلى <span className={styles.important}>لجنة مهرجان الكرازة المرقسية</span> التي تتيح الفرص للإبداع والابتكار في خدمة الكنيسة والمجتمع.
        </p>

        <p className={styles.paragraph}>
          شكر خاص لكل من ساهم بتقديم نصيحة تقنية أو روحية، ولكل من شارك في نشر هذا العمل لتعم البركة. نطلب من الله أن يجعل هذا التطبيق سبباً في قراءة وفهم أعمق لكلمته المحيية.
        </p>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 Agios System - جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}