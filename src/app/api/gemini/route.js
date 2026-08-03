import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { kv } from "../../../lib/kv";

export const dynamic = 'force-dynamic';

const apiKeys = [
  "AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ",
  "AIzaSyB9a0OiIJGdlwcDdna511QZTLPp14gWoic",
  "AQ.Ab8RN6J4tMmUaO2fXNoMSI3ZzAjJJzSdsonV8BJwA4hU8Qd-lg",
  "AQ.Ab8RN6LcBmsh2-JOPw2nFABcCLRDuydaBPFsAtQktLh_UB654g"
];

const getGenAI = (index) => {
  if (apiKeys.length === 0) {
    throw new Error("No Gemini API keys configured on the server");
  }
  const key = apiKeys[index % apiKeys.length];
  return new GoogleGenerativeAI(key);
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
  'Access-Control-Max-Age': '86400',
};

const PROMPTS = {
  analysis: {
    ar: (targetText) => `أنت "مساعد آجيوس الذكي". مهمتك هي تحليل النص الكتابي المرفق فقط بدقة متناهية: "${targetText}".
قواعد صارمة:
1. حلل النص المرفق حصراً. لا تخلط بينه وبين آيات أخرى.
2. إذا كان النص غير واضح أو لم تجد له تفسيراً آبائياً موثوقاً، صرح بذلك ولا تخترع تفسيراً.
3. التزم بالمنهجية التالية: ١. مقدمة مختصرة عن سياق النص، ٢. معاني الكلمات لغوياً، ٣. الخلفية التاريخية، ٤. التفسير الروحي (بناءً على القمص تادرس يعقوب والقمص أنطونيوس فكري)، ٥. تطبيق حياتي، ٦. رد على أي شبهات مرتبطة بالنص.
4. لا تستخدم Markdown (مثل ** أو #).
5. في النهاية أضف: "ودائماً ننصح بالرجوع لأب اعترافك".`,
    en: (targetText) => `You are "Agios Assistant". Analyze ONLY the following biblical text: "${targetText}".
Rules:
1. Strictly analyze the provided text. Do not confuse it with other verses.
2. If the text is ambiguous or you cannot find reliable patristic commentary, state it. Do NOT hallucinate.
3. Structure: 1. Intro (Context), 2. Linguistics, 3. History, 4. Exegesis (Based on Church Fathers like Fr. Tadros Malaty and Fr. Antonios Fekry), 5. Application, 6. Clarifying common misconceptions.
4. No markdown formatting.`,
    fr: (targetText) => `Vous êtes "Assistant Agios". Analysez UNIQUEMENT le texte biblique suivant: "${targetText}".
Règles:
1. Analysez strictement le texte fourni. Ne pas confondre avec d'autres versets.
2. Ne pas inventer d'informations. Si vous n'êtes pas sûr, dites-le.
3. Structure: 1. Intro, 2. Linguistique, 3. Histoire, 4. Exégèse (Pères de l'Église), 5. Application, 6. Objections.
4. Pas de Markdown.`,
    de: (targetText) => `Sie sind "Agios-Assistent". Analysieren Sie NUR den folgenden biblischen Text: "${targetText}".
Regeln:
1. Analysieren Sie ausschließlich den bereitgestellten Text. Nicht mit anderen Versen verwechseln.
2. Erfinden Sie keine Informationen. Wenn Sie unsicher sind, sagen Sie es.
3. Struktur: 1. Intro, 2. Linguistik, 3. Geschichte, 4. Exegese, 5. Anwendung, 6. Einwände.
4. Kein Markdown.`
  },
  studyPlan: {
    ar: (mood, durationDays, intensityLabel, allowedBooks) => `أنت "أجيوس"، خبير الإرشاد الروحي. صياغة رحلة قراءة لـ: "${mood}"، مدة: ${durationDays} أيام، كثافة: ${intensityLabel}.
المطلوب JSON فقط بنفس الهيكل التالي بدقة:
{
  "title": "عنوان الخطة",
  "description": "وصف الخطة",
  "readings": [
    { "day": 1, "books": ["اسم السفر رقم الأصحاح", "مثال: تكوين 1"] },
    { "day": 2, "books": ["..."] }
  ]
}
الأسفار المتاحة للاستخدام: [${allowedBooks}]`,
    en: (mood, durationDays, intensityLabel, allowedBooks) => `Create study plan for: "${mood}". JSON only following this structure: {"title": "...", "description": "...", "readings": [{"day": 1, "books": ["Genesis 1"]}]}`,
    fr: (mood, durationDays, intensityLabel, allowedBooks) => `Créer un plan d'étude. JSON uniquement.`,
    de: (mood, durationDays, intensityLabel, allowedBooks) => `Studienplan erstellen. JSON nur.`
  }
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  if (process.env.NEXT_PUBLIC_EXPORT === 'true') {
    return NextResponse.json({ static: true }, { headers: corsHeaders });
  }

  try {
    const { task, lang, payload, attempt = 0, cacheKey } = await req.json();

    if (cacheKey) {
      const cached = await kv.get(cacheKey);
      if (cached) {
        let responseData;
        if (typeof cached !== 'string') responseData = cached;
        else {
          try { responseData = JSON.parse(cached); } catch (e) { responseData = { text: cached }; }
        }
        return NextResponse.json(responseData, { headers: corsHeaders });
      }
    }

    const genAI = getGenAI(attempt);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: task === 'analysis' ? { maxOutputTokens: 2048, temperature: 0.1 } : (task === 'studyPlan' ? { temperature: 0.7 } : undefined)
    });

    let prompt = "";
    if (task === 'derivatives' || task === 'derivatives_stream') prompt = (PROMPTS.derivatives[lang] || PROMPTS.derivatives.en)(payload.term);
    else if (task === 'semantic') prompt = (PROMPTS.semantic[lang] || PROMPTS.semantic.en)(payload.term, payload.allowedBooks, payload.filterContext);
    else if (task === 'analysis') prompt = (PROMPTS.analysis[lang] || PROMPTS.analysis.en)(payload.targetText);
    else if (task === 'studyPlan') prompt = (PROMPTS.studyPlan[lang] || PROMPTS.studyPlan.en)(payload.mood, payload.durationDays, payload.intensityLabel, payload.allowedBooks);
    else if (task === 'general') prompt = payload.prompt;

    if (task === 'analysis' || task === 'derivatives_stream' || (task === 'general' && payload.config?.stream)) {
      const result = await model.generateContentStream(prompt);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let fullText = "";
          try {
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              fullText += chunkText;
              controller.enqueue(encoder.encode(chunkText));
            }
            if (cacheKey && fullText) await kv.set(cacheKey, fullText);
            controller.close();
          } catch (e) { controller.error(e); }
        },
      });
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    if (cacheKey) await kv.set(cacheKey, responseText);
    return NextResponse.json({ text: responseText }, { headers: corsHeaders });
  } catch (error) {
    console.error("Critical API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ status: "active" }, { headers: corsHeaders });
}
