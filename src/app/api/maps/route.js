import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const MAPTILER_KEY = process.env.MAPTILER_KEY || "QvkUns3IvYwEEKb9dIJ7";
const R2_PMTILES_URL = process.env.R2_PMTILES_URL || "https://pub-7c5b3f5b97ce4621ab9bcc22444fda70.r2.dev/test-map.pmtiles";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const task = searchParams.get('task');
  const lang = searchParams.get('lang') || 'ar';
  const type = searchParams.get('type');

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

  if (task === 'style') {
    if (type === 'streets') {
      try {
        const res = await fetch('https://tiles.openfreemap.org/styles/liberty');
        const style = await res.json();
        style.sources.openmaptiles.url = `pmtiles://${R2_PMTILES_URL}`;
        return NextResponse.json(style);
      } catch (e) {
        console.error("Maps API Error (streets style):", e);
        return NextResponse.json({ error: "Failed to build streets style" }, { status: 500 });
      }
    }

    let url = "";
    if (type === 'satellite') url = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
    else if (type === 'topo') url = `https://api.maptiler.com/maps/topo-v2/style.json?key=${MAPTILER_KEY}`;
    else if (type === 'terrain') url = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

    if (!url) return NextResponse.json({ error: "Invalid style type" }, { status: 400 });

    try {
      const res = await fetch(url);
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: "Failed to fetch map style" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid task" }, { status: 400 });
}