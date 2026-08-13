import OtherProfilePageClient from './OtherProfilePageClient';

// هذا التصدير ضروري لنجاح عملية output: export في المسارات الديناميكية
export function generateStaticParams() {
  // نرجع معرفاً افتراضياً لضمان نجاح عملية التصدير وقت البناء
  return [{ id: 'default' }];
}

// إعدادات إجبارية لبيئة الموبايل (Static Export)
export const dynamic = 'force-static';
export const dynamicParams = false;

export default function Page(props) {
  return <OtherProfilePageClient {...props} />;
}
