import { NextResponse } from "next/server";

// حل مشكلة الـ Export للموبايل: يجب أن تكون القيمة 'force-static' عند استخدام 'output: export'
export const dynamic = 'force-static';

const R2_PMTILES_URL = "https://tiles.agiosbible.com/test-map.pmtiles";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req) {
  // تخطي التنفيذ أثناء عملية التصدير للموبايل
  if (process.env.NEXT_PUBLIC_EXPORT === 'true') {
    return NextResponse.json({ exported: true });
  }

  try {
    const { searchParams } = new URL(req.url);
    const task = searchParams.get('task');
    const lang = searchParams.get('lang') || 'ar';

    if (task === 'places') {
      const folder = lang === 'en' ? 'English' : lang === 'fr' ? 'French' : lang === 'de' ? 'german' : 'arabic';
      const suffix = lang && lang !== 'ar' ? `_${lang}` : '';
      // تصحيح المسار: الانتقال من src/app/api/maps إلى src/app/data
      const data = await import(`../../data/translations/${folder}/places${suffix}.json`);
      return NextResponse.json(data.default || data);
    }

    if (task === 'style') {
      const res = await fetch('https://tiles.openfreemap.org/styles/liberty');
      if (!res.ok) throw new Error("Failed to fetch base style");

      let style = await res.json();
      if (style.sources && style.sources.openmaptiles) {
        style.sources.openmaptiles.type = 'vector';
        style.sources.openmaptiles.url = `pmtiles://${R2_PMTILES_URL}`;
      }
      delete style.metadata;
      return NextResponse.json(style);
    }
  } catch (e) {
    console.error("Maps API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Invalid task" }, { status: 400 });
}
