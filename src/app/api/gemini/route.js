import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { kv } from "../../../lib/kv";

// FIX: was unconditionally 'force-static', which is meant for GET routes and
// doesn't make sense forced onto a POST handler that reads a per-request body.
// This only needs to be 'force-static' during the mobile *export* build (so
// `next build` with output:'export' doesn't fail on a dynamic route it will
// never actually call). On your real hosted server (agiosbible.com), this
// evaluates to 'force-dynamic' so every request is handled live, uncached.
// NEXT_PUBLIC_ vars are inlined at build time, so this is safe as a static export.
export const dynamic = 'force-static';


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
  derivatives: {
    ar: (term) => `أنت مرجع لغوي عربي فائق الدقة متخصص في فقه اللغة. الكلمة المستهدفة: "${term}". الرد JSON فقط: {"root": "...", "isStatic": boolean, "explanation": "...", "derivatives": ["...", "..."]}`,
    en: (term) => `Linguistic expert. Word: "${term}". JSON only: {"root": "...", "isStatic": boolean, "explanation": "...", "derivatives": []}`,
    fr: (term) => `Expert linguistique. Mot: "${term}". JSON uniquement.`,
    de: (term) => `Sprachexperte. Wort: "${term}". JSON nur.`
  },
  semantic: {
    ar: (term, allowedBooks, filterContext) => `أنت محرك بحث لاهوتي لتطبيق "أجيوس". استخرج 5-7 مراجع مرتبطة بـ: "${term}". السياق: ${filterContext}. JSON فقط: {"results": [{"book": "...", "chapter": 1, "verses": [1], "title": "...", "reason": "..."}]}. الأسفار: [${allowedBooks}]`,
    en: (term, allowedBooks, filterContext) => `Theological search for "Agios". 5-7 refs for: "${term}". Context: ${filterContext}. JSON: {"results": []}`,
    fr: (term, allowedBooks, filterContext) => `Recherche théologique "Agios". 5-7 refs. JSON uniquement.`,
    de: (term, allowedBooks, filterContext) => `Theologische Suche "Agios". 5-7 refs. JSON nur.`
  },
  analysis: {
    ar: (targetText) => `أنت "مساعد آجيوس الذكي". تفسير النص المرفق لاهوتياً ولغوياً بدقة: ${targetText}. المنهجية: ١. مقدمة، ٢. لغويات، ٣. تاريخ، ٤. تفسير (تادرس يعقوب/أنطونيوس فكري)، ٥. تطبيق، ٦. شبهات. لا تستخدم Markdown. في النهاية أضف: "ودائماً ننصح بالرجوع لأب اعترافك".`,
    en: (targetText) => `Agios Assistant. Analyze: ${targetText}. Sections: 1. Intro, 2. Linguistics, 3. History, 4. Exegesis, 5. Application, 6. Objections. No markdown.`,
    fr: (targetText) => `Assistant Agios. Analyse: ${targetText}. Répondez en français. Pas de Markdown.`,
    de: (targetText) => `Agios-Assistent. Analyse: ${targetText}. Antworten Sie auf Deutsch. Kein Markdown.`
  },
  studyPlan: {
    ar: (mood, durationDays, intensityLabel, allowedBooks) => `أنت "أجيوس"، خبير الإرشاد الروحي. صياغة رحلة قراءة لـ: "${mood}"، مدة: ${durationDays} أيام، كثافة: ${intensityLabel}. المطلوب JSON فقط: {"title": "...", "description": "...", "readings": []}. الأسفار: [${allowedBooks}]`,
    en: (mood, durationDays, intensityLabel, allowedBooks) => `Create study plan for: "${mood}". JSON only.`,
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
  // Skip real execution only during the mobile static-export build itself.
  // The deployed server (agiosbible.com) never sets this, so it always runs live.
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
      generationConfig: task === 'analysis' ? { maxOutputTokens: 2048 } : (task === 'studyPlan' ? { temperature: 0.7 } : undefined)
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