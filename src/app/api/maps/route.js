import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// رابط ملف الخريطة المستضاف على Cloudflare R2
const R2_PMTILES_URL = process.env.R2_PMTILES_URL || "https://pub-7c5b3f5b97ce4621ab9bcc22444fda70.r2.dev/test-map.pmtiles";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const task = searchParams.get('task');
  const lang = searchParams.get('lang') || 'ar';

  // جلب بيانات الأماكن والترجمات
  if (task === 'places') {
    try {
      const folder = lang === 'en' ? 'English' : lang === 'fr' ? 'French' : lang === 'de' ? 'german' : 'arabic';
      const suffix = lang && lang !== 'ar' ? `_${lang}` : '';

      const data = await import(`../../data/translations/${folder}/places${suffix}.json`);
      return NextResponse.json(data.default || data);
    } catch (e) {
      console.error("Maps API Error (places):", e);
      return NextResponse.json({ error: "Places data not found" }, { status: 404 });
    }
  }

  // إنشاء التنسيق (Style) بناءً على ملف الـ PMTiles الخاص بك فقط
  if (task === 'style') {
    try {
      // نستخدم تنسيق OpenFreeMap كقاعدة ونعدله ليشير إلى ملفك الخاص
      const res = await fetch('https://tiles.openfreemap.org/styles/liberty');
      if (!res.ok) throw new Error("Failed to fetch base style");

      const style = await res.json();

      // تحديث مصدر البيانات ليشير حصرياً إلى Cloudflare PMTiles
      if (style.sources && style.sources.openmaptiles) {
        style.sources.openmaptiles.type = 'vector';
        style.sources.openmaptiles.url = `pmtiles://${R2_PMTILES_URL}`;
      }

      // إزالة أي مصادر أخرى قد تعتمد على MapTiler أو غيره لضمان الاستقلالية
      return NextResponse.json(style);
    } catch (e) {
      console.error("Maps API Error (style):", e);
      return NextResponse.json({ error: "Failed to build map style from Cloudflare" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid task" }, { status: 400 });
}
