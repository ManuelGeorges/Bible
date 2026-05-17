import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.prompt) {
      console.error("❌ Gemini API: No prompt received");
      return NextResponse.json({ error: "No prompt provided" }, { status: 400, headers: corsHeaders });
    }

    const { prompt, config } = body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.error("❌ Gemini API: API Key missing in environment");
      return NextResponse.json({ error: "API Key missing" }, { status: 500, headers: corsHeaders });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: config?.model || "gemini-flash-latest",
      generationConfig: config?.generationConfig,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("🔥 Gemini Server Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
