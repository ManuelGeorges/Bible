import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateWithGemini(prompt, config = {}) {
  try {
    // نستخدم المفتاح العام المتاح في المتصفح/التطبيق
    const apiKey = AIzaSyDY3uFV5mupj3tgj6PDx3A_xKtZkLDvTcQ;

    if (!apiKey) {
      throw new Error("Gemini API Key is missing (NEXT_PUBLIC_GEMINI_API_KEY)");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: config?.model || "gemini-1.5-flash",
      generationConfig: config?.generationConfig,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
}
