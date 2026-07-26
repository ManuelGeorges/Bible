import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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
  // Allow execution on server during build if necessary, but typically we want this live
  if (process.env.NEXT_PUBLIC_EXPORT === 'true' && typeof window === 'undefined' && !process.env.VERCEL) {
    return NextResponse.json({ exported: true });
  }

  try {
    const { searchParams } = new URL(req.url);
    const task = searchParams.get('task');
    const lang = searchParams.get('lang') || 'ar';

    if (task === 'places') {
      const folder = lang === 'en' ? 'English' : lang === 'fr' ? 'French' : lang === 'de' ? 'german' : 'arabic';
      const suffix = lang && lang !== 'ar' ? `_${lang}` : '';
      // Dynamic import needs to be careful with paths in Next.js App Router
      const data = await import(`../../../data/translations/${folder}/places${suffix}.json`);
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
