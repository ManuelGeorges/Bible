import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const R2_PMTILES_URL = "https://tiles.agiosbible.com/test-map.pmtiles";
const R2_FALLBACK_URL = "https://pub-7c5b3f5b97ce4621ab9bcc22444fda70.r2.dev/test-map.pmtiles";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  let task = searchParams.get('task');
  const lang = searchParams.get('lang') || 'ar';

  // Normalize task to handle cases like trailing slashes or accidental spaces
  if (task) task = task.toLowerCase().trim();

  if (task === 'places') {
    try {
      const folder = lang === 'en' ? 'English' : lang === 'fr' ? 'French' : lang === 'de' ? 'german' : 'arabic';
      const suffix = (lang && lang !== 'ar') ? `_${lang}` : '';

      let data;
      try {
        data = await import(`../../data/translations/${folder}/places${suffix}.json`);
      } catch (importErr) {
        console.warn(`Translation not found for ${lang}, falling back to Arabic`);
        data = await import(`../../data/translations/arabic/places.json`);
      }

      return NextResponse.json(data.default || data, { headers: corsHeaders });
    } catch (e) {
      console.error("Places API Error:", e);
      return NextResponse.json({ error: "Places data not found" }, { status: 404, headers: corsHeaders });
    }
  }

  if (task === 'style') {
    try {
      const res = await fetch('https://tiles.openfreemap.org/styles/liberty', {
        next: { revalidate: 3600 }
      });

      if (!res.ok) throw new Error("Failed to fetch base style");

      let style = await res.json();
      if (style.sources && style.sources.openmaptiles) {
        style.sources.openmaptiles.type = 'vector';
        style.sources.openmaptiles.url = `pmtiles://${R2_PMTILES_URL}`;
      }

      delete style.metadata;
      if (style.sources) {
        Object.keys(style.sources).forEach(key => {
          if (key.includes('maptiler')) delete style.sources[key];
        });
      }

      return new NextResponse(JSON.stringify(style), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (e) {
      console.error("Maps Style Error:", e);
      return NextResponse.json({ error: "Failed to generate clean style" }, { status: 500, headers: corsHeaders });
    }
  }

  return NextResponse.json({ error: "Invalid task", receivedTask: task }, { status: 400, headers: corsHeaders });
}
