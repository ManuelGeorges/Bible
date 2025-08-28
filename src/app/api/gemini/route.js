import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ message: 'Prompt is required and must be a string.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    text = text.replace(/^`+json\s*|`+$/g, '');

    return NextResponse.json({ response: text }, { status: 200 });
  } catch (error) {
    if (error.response && error.response.status) {
      console.error('Gemini API Error:', error.response.status, error.response.statusText);
      return NextResponse.json({ message: `Gemini API Error: ${error.response.statusText}` }, { status: error.response.status });
    } else {
      console.error('General Error:', error);
      return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
  }
}