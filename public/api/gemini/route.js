import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { term } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `أنت خبير لغوي. استخرج الجذر الثلاثي وقائمة شاملة جداً من المشتقات (أفعال، أسماء، مصادر) للكلمة "${term}". 
            يجب أن تكون الإجابة بصيغة JSON فقط كالتالي: 
            {"root": "الجذر", "derivatives": ["مشتق1", "مشتق2"]}` 
          }] 
        }],
        // إعدادات الأمان لضمان عدم حجب الكلمات
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
          response_mime_type: "application/json" // دي بتجبر الموديل يبعت JSON نظيف
        }
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    
    // تنظيف النص من أي علامات Markdown محتملة
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : rawText;

    // بنرجع الـ Object نفسه بدل ما نرجعه كـ String
    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}