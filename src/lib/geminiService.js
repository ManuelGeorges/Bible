import { fetchWithTimeout } from './utils';

// تم نقل العمليات إلى السيرفر لحماية المفاتيح والبرومبتات
const API_BASE_URL = 'https://www.agiosbible.com';

export async function generateWithGemini(prompt, config = {}) {
  try {
    // توجيه الطلب إلى السيرفر الخاص بنا بدلاً من جوجل مباشرة
    // استخدام مهلة زمنية 20 ثانية لأن مهام الذكاء الاصطناعي قد تستغرق وقتاً
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'general', // مهمة عامة
        payload: { prompt, config }
      }),
      timeout: 20000
    });

    if (!response.ok) {
      throw new Error("Server Error");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini Service Redirect Error (Connection slow?):", error);
    throw error;
  }
}
