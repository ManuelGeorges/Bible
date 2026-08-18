import { NextResponse } from "next/server";
import { kv } from "../../../lib/kv";

export const dynamic = 'force-dynamic';

const R2_PMTILES_URL = "https://tiles.agiosbible.com/test-map.pmtiles";

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

  if (task) task = task.toLowerCase().trim();

  if (task === 'places') {
    const cacheKey = `map_places_${lang}_v2`;
    try {
      // 1. Check Cache
      const cachedData = await kv.get(cacheKey);
      if (cachedData) {
        return NextResponse.json(cachedData, {
          headers: { ...corsHeaders, 'X-Cache': 'HIT' }
        });
      }

      const folder = lang === 'en' ? 'English' : lang === 'fr' ? 'French' : lang === 'de' ? 'german' : 'arabic';
      const suffix = (lang && lang !== 'ar') ? `_${lang}` : '';

      let data;
      try {
        data = await import(`../../data/translations/${folder}/places${suffix}.json`);
      } catch (importErr) {
        data = await import(`../../data/translations/arabic/places.json`);
      }

      const rawData = data.default || data;

      // 2. Optimize payload (Remove unnecessary weight for initial load if any)
      // For now, we keep the structure but ensure it's a clean array
      const optimizedData = Array.isArray(rawData) ? rawData : [];

      // 3. Store in Cache for 1 hour
      await kv.set(cacheKey, optimizedData, { ex: 3600 });

      return NextResponse.json(optimizedData, {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      });
    } catch (e) {
      console.error("Places API Error:", e);
      return NextResponse.json({ error: "Places data not found" }, { status: 404, headers: corsHeaders });
    }
  }

  if (task === 'style') {
    const cacheKey = 'map_style_optimized_v2';
    try {
      const cachedStyle = await kv.get(cacheKey);
      if (cachedStyle) {
        return NextResponse.json(cachedStyle, {
          headers: { ...corsHeaders, 'X-Cache': 'HIT' }
        });
      }

      const res = await fetch('https://tiles.openfreemap.org/styles/liberty', {
        next: { revalidate: 86400 }
      });

      if (!res.ok) throw new Error("Failed to fetch base style");

      let style = await res.json();

      // Patch style to use our PMTiles
      if (style.sources && style.sources.openmaptiles) {
        style.sources.openmaptiles.type = 'vector';
        style.sources.openmaptiles.url = `pmtiles://${R2_PMTILES_URL}`;
      }

      // Cleanup unnecessary metadata and sources to save bytes
      delete style.metadata;
      if (style.sources) {
        Object.keys(style.sources).forEach(key => {
          if (key.includes('maptiler') || key.includes('thunderforest')) delete style.sources[key];
        });
      }

      await kv.set(cacheKey, style, { ex: 86400 });

      return new NextResponse(JSON.stringify(style), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=31536000',
        },
      });
    } catch (e) {
      console.error("Maps Style Error:", e);
      return NextResponse.json({ error: "Failed to generate style" }, { status: 500, headers: corsHeaders });
    }
  }

  return NextResponse.json({ error: "Invalid task" }, { status: 400, headers: corsHeaders });
}
