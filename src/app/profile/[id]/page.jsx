import OtherProfilePageClient from './OtherProfilePageClient';

// إخبار Next.js بالمسارات الثابتة المطلوبة للتصدير
export function generateStaticParams() {
  // نضع معرفاً افتراضياً لضمان عبور عملية الـ Build
  return [{ id: 'default' }];
}

// إغلاق البارامترات الديناميكية (إلزامي مع output: export)
export const dynamicParams = false;
export const dynamic = 'force-static';

export default function Page(props) {
  return <OtherProfilePageClient {...props} />;
}
