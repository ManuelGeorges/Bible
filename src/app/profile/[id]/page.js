import OtherProfilePageClient from './OtherProfilePageClient';

// توليد مسار افتراضي لنجاح عملية التصدير الثابت (Static Export)
export function generateStaticParams() {
  return [{ id: 'user' }];
}

// إعدادات إجبارية للتوافق مع Capacitor/Mobile Export
export const dynamic = 'force-static';
export const dynamicParams = false;

export default function Page(props) {
  return <OtherProfilePageClient {...props} />;
}
