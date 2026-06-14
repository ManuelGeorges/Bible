import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  return NextResponse.json({ message: "API is active in server mode only" });
}

// في حالة الـ Build العادي (Server-side) سيظل الـ POST يعمل
export async function POST(req) {
  if (process.env.NEXT_PUBLIC_EXPORT === 'true') {
    return NextResponse.json({ error: "API Routes not available in static export" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const { prompt, config } = body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: config?.model || "gemini-1.5-flash",
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
