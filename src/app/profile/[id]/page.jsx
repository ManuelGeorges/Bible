import OtherProfilePageClient from './OtherProfilePageClient';

// لمنع الخطأ في Static Export، يجب تعريف المعاملات الثابتة.
// نرجع مصفوفة فارغة لأننا سنعتمد على الجلب من طرف العميل (Client-side)
export function generateStaticParams() {
  return [];
}

// هذا السطر مهم جداً عند استخدام output: export مع مسارات ديناميكية
export const dynamic = 'force-static';

const Page = (props) => {
  return <OtherProfilePageClient {...props} />;
};

export default Page;
