import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { response_mime_type: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Verification: Try to parse it here to catch errors early
    try {
      JSON.parse(text); 
      return NextResponse.json({ response: text }, { status: 200 });
    } catch (parseError) {
      console.error("AI returned invalid JSON:", text);
      return NextResponse.json({ message: 'AI Response format error' }, { status: 500 });
    }

  } catch (error) {
    console.error('--- TERMINAL ERROR LOG ---');
    console.error('Error Message:', error.message);
    
    const status = error.status || 500;
    return NextResponse.json({ 
      message: 'Gemini Error', 
      details: error.message 
    }, { status: status });
  }
}