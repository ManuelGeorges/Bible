import styles from './about.module.css';

export default function AboutPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>عن موقع Agios</h1>
      <section className={styles.section}>
        <h2 className={styles.subtitle}>المقدمة</h2>
        <p className={styles.paragraph}>
          Agios هو مشروع بدأ بفكرة بسيطة وهي المشاركة في مهرجان الكرازة المرقسية بالإسكندرية, كان في البدء هدفه هو تقديم خصائص رغم اهميتها لكنها غير متوفرة مثل البحث بالمشتقات, الخرائط التفاعلية, الواجهة المريحة للعين والمحفزة لدراسة الكتاب وغيرها
        </p>
        <p className={styles.paragraph}>
          بعد فوزه بالمسابقة, قررنا نشره لكي يستفيد به كل الناس وتطويره لكي يكون منصة كاملة لدراسة الكتاب المقدس تشمل الخصائث الموجودة التي نستخدمها يومياً والغير موجودة التي كانت هدفاً اساسياً لانشائه
        </p>
      </section>
      <section className={styles.section}>
        <h2 className={styles.subtitle}>رؤيتنا</h2>
        <p className={styles.paragraph}>
           تتمثل رؤيتنا أن يستخدمه الله حتى يقرأ المزيد من الناس الكتاب المقدس بطرق جديدة ومبتكرة تواكب الشباب والعصر الحديث ولا تتنافى يف نفس الوقت مع أسس الإيمان المستقيم
        </p>

      </section>
          <section className={styles.section}>
        <h2 className={styles.subtitle}>فريقنا</h2>
        <div className={styles.teamGrid}>
          <div className={styles.teamMember}>
            <img src="/images/members/Manuel.png" alt="صورة مانويل جورج" className={styles.memberImage} />
            <h3 className={styles.memberName}>مانويل جورج</h3>
            <p className={styles.memberRole}>مؤسس ومطور</p>
            <p className={styles.memberDescription}>
             مؤسس الموقع من الصفر والمطور الأساسي والأول
            </p>
          </div>
          </div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.subtitle}>شكر وتقدير</h2>
        <p className={styles.paragraph}> 
           نتقدم بالشكر لكل من ساعدنا في تطوير هذا الموقع سواء بالدعم المعنوي أو بالنصيحة وأتقدم بجزيل الشكر لكنيستني   
           
         <span className={styles.important}>   كنيسة رئيس الملائكة الجليل ميخائيل بمصطفى كامل بالإسكندرية </span>
           لدعمهم وتشجيعهم للفكرة منذ بدايتها 
           <span className={styles.important}> وللجنة مهرجان الكرازة المرقسية   </span> لتحفيزهم الشباب على تطوير مشاريع جديدة لإفادة المجتمع 
           ولكل الذين قدموا اقتراحات ساهمت في تطوير الموقع أو نشروه في دائرة معارفهم
        </p>
      </section>
    </div>
  );
}