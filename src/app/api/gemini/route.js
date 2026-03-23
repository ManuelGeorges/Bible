// app/api/gemini/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { term } = await req.json();
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // هنا السيرفر بيقرأ الـ Key بأمان
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `أنت خبير لغوي... (نفس الـ Prompt بتاعك) ... الكلمة هي: "${term}"`;
    
    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}