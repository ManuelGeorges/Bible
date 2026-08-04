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
    ar: (targetText) => `أنت "مساعد آجيوس الذكي". مهمتك هي تحليل الشاهد الكتابي المرفق بدقة متناهية: "${targetText}".
قواعد صارمة:
1. استخرج النص الكتابي المقابل لهذا الشاهد من الكتاب المقدس (ترجمة فان دايك SVD) وحلله حصراً. لا تخلط بينه وبين آيات أخرى.
2. إذا كان الشاهد غير واضح أو لم تجد له تفسيراً آبائياً موثوقاً، صرح بذلك ولا تخترع تفسيراً.
3. التزم بالمنهجية التالية: ١. مقدمة مختصرة عن سياق النص، ٢. معاني الكلمات لغوياً (يجب ذكر الكلمات المحورية باللغة الأصلية "عبري للعهد القديم ويوناني للعهد الجديد" مع كتابة الكلمة الأصلية، نطقها، وشرح معناها اللغوي العميق)، ٣. الخلفية التاريخية، ٤. التفسير الروحي (بناءً على القمص تادرس يعقوب والقمص أنطونيوس فكري)، ٥. تطبيق حياتي، ٦. رد على أي شبهات مرتبطة بالنص.
4. لا تستخدم Markdown (مثل ** أو #) في الرد نهائياً.
5. في النهاية أضف: "ودائماً ننصح بالرجوع لأب اعترافك".`,
    en: (targetText) => `You are "Agios Assistant". Analyze ONLY the following biblical reference using World English Bible (WEB) translation: "${targetText}".
Rules:
1. Identify the exact text for this reference and analyze it strictly. Do not confuse it with other verses.
2. If the reference is ambiguous or you cannot find reliable patristic commentary, state it. Do NOT hallucinate.
3. Structure: 1. Intro (Context), 2. Linguistics (Include key words in their original languages - Hebrew for OT, Greek for NT - with transliteration and precise linguistic meaning), 3. History, 4. Exegesis (Based on Church Fathers like Fr. Tadros Malaty and Fr. Antonios Fekry), 5. Application, 6. Clarifying common misconceptions.
4. Do not use Markdown formatting (like ** or #).`,
    fr: (targetText) => `Vous êtes "Assistant Agios". Analysez UNIQUEMENT la référence biblique suivante (Traduction Louis Segond) : "${targetText}".
Règles :
1. Identifiez le texte exact de cette référence et analysez-le strictement. Ne pas confondre avec d'autres versets.
2. Ne pas inventer d'informations. Si vous n'êtes pas sûr, dites-le.
3. Structure : 1. Intro (Contexte), 2. Linguistique (Inclure les mots-clés dans leurs langues originales - hébreu pour l'AT, grec pour le NT - avec translittération et explication linguistique), 3. Histoire, 4. Exégèse (Basée sur les Pères de l'Église comme Fr. Tadros Malaty et Fr. Antonios Fekry), 5. Application, 6. Clarification des idées reçues.
4. Pas de Markdown.`,
    de: (targetText) => `Sie sind "Agios-Assistent". Analysieren Sie NUR die folgende biblische Referenz (Luther-Bibel) : "${targetText}".
Regeln :
1. Identifizieren Sie den exakten Text dieser Referenz und analysieren Sie ihn streng. Nicht mit anderen Versen verwechseln.
2. Erfinden Sie keine Informationen. Wenn Sie unsicher sind, sagen Sie es.
3. Struktur : 1. Intro (Context), 2. Linguistik (Schlüsselwörter in den Originalsprachen - Hebräisch für AT, Griechisch für NT - mit Transliteration und linguistischer Erklärung), 3. Geschichte, 4. Exegese (Basierend auf Kirchenvätern wie Fr. Tadros Malaty und Fr. Antonios Fekry), 5. Anwendung, 6. Klärung von Missverständnissen.
4. Kein Markdown.`
  },
  derivatives: {
    ar: (term) => `أنت خبير لغوي. استخرج الجذر الثلاثي وقائمة شاملة جداً من المشتقات (أفعال، أسماء، مصادر) للكلمة "${term}". الرد يجب أن يكون بصيغة JSON فقط كالتالي: {"root": "الجذر", "derivatives": ["مشتق1", "مشتق2"]}`,
    en: (term) => `You are a linguist. Extract the tri-literal root and a comprehensive list of derivatives (verbs, nouns, sources) for the word "${term}". Response must be JSON only: {"root": "root", "derivatives": ["der1", "der2"]}`,
    fr: (term) => `Vous êtes linguiste. Extrayez la racine tri-littère et une liste complète de dérivés (verbes, noms, sources) pour le mot "${term}". La réponse doit être en JSON uniquement : {"root": "racine", "derivatives": ["der1", "der2"]}`,
    de: (term) => `Sie sind Linguist. Extrahieren Sie die trilitere Wurzel und eine umfassende Liste von Derivaten (Verben, Substantive, Quellen) für das Wort "${term}". Die Antwort muss nur JSON sein : {"root": "Wurzel", "derivatives": ["der1", "der2"]}`
  },
  semantic: {
    ar: (term, allowedBooks, filterContext) => `ابحث عن أكثر الآيات صلة بمفهوم: "${term}". السياق: ${filterContext}. الأسفار المتاحة للاستخدام: [${allowedBooks}]. الرد يجب أن يكون JSON فقط بنفس الهيكل التالي: {"results": [{"title": "عنوان موجز للمجموعة", "book": "اسم السفر", "chapter": 1, "verses": [1, 2], "reason": "سبب اختيار هذه الآيات"}]}`,
    en: (term, allowedBooks, filterContext) => `Find the most relevant Bible verses for the concept: "${term}". Context: ${filterContext}. Allowed books: [${allowedBooks}]. Response must be JSON only: {"results": [{"title": "Brief title", "book": "Book Name", "chapter": 1, "verses": [1, 2], "reason": "Reason for selection"}]}`,
    fr: (term, allowedBooks, filterContext) => `Trouvez les versets bibliques les plus pertinents pour le concept : "${term}". Contexte : ${filterContext}. Livres autorisés : [${allowedBooks}]. La réponse doit être en JSON uniquement : {"results": [{"title": "Titre bref", "book": "Nom du livre", "chapter": 1, "verses": [1, 2], "reason": "Raison de la sélection"}]}`,
    de: (term, allowedBooks, filterContext) => `Finden Sie die relevantesten Bibelseiten für das Konzept: "${term}". Kontext : ${filterContext}. Erlaubte Bücher: [${allowedBooks}]. Die Antwort muss nur JSON sein : {"results": [{"title": "Kurzer Titel", "book": "Buchname", "chapter": 1, "verses": [1, 2], "reason": "Grund für die Auswahl"}]}`
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
    en: (mood, durationDays, intensityLabel, allowedBooks) => `You are "Agios", a spiritual guidance expert. Create a reading journey for: "${mood}", duration: ${durationDays} days, intensity: ${intensityLabel}.
Required: JSON only with the following structure:
{
  "title": "Plan Title",
  "description": "Plan Description",
  "readings": [
    { "day": 1, "books": ["Book Name Chapter Number", "Example: Genesis 1"] },
    { "day": 2, "books": ["..."] }
  ]
}
Allowed books: [${allowedBooks}]`,
    fr: (mood, durationDays, intensityLabel, allowedBooks) => `Vous êtes "Agios", expert en orientation spirituelle. Élaborez un plan de lecture pour : "${mood}", durée : ${durationDays} jours, intensité : ${intensityLabel}.
Requis : JSON uniquement avec la structure suivante :
{
  "title": "Titre du plan",
  "description": "Description du plan",
  "readings": [
    { "day": 1, "books": ["Nom du livre Numéro du chapitre", "Exemple : Genèse 1"] },
    { "day": 2, "books": ["..."] }
  ]
}
Livres autorisés : [${allowedBooks}]`,
    de: (mood, durationDays, intensityLabel, allowedBooks) => `Sie sind "Agios", Experte für geistliche Begleitung. Erstellen Sie einen Leseplan für: "${mood}", Dauer: ${durationDays} Tage, Intensität: ${intensityLabel}.
Erforderlich: Nur JSON mit folgender Struktur:
{
  "title": "Titel des Plans",
  "description": "Beschreibung des Plans",
  "readings": [
    { "day": 1, "books": ["Buchname Kapitelnummer", "Beispiel: Genesis 1"] },
    { "day": 2, "books": ["..."] }
  ]
}
Erlaubte Bücher: [${allowedBooks}]`
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
