import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- إعدادات Gemini ---
// يرجى وضع مفتاح API الخاص بك هنا
// يمكنك الحصول عليه مجاناً من: https://aistudio.google.com/app/apikey
const API_KEY = "YOUR_GEMINI_API_KEY";

async function main() {
    if (API_KEY === "YOUR_GEMINI_API_KEY") {
        console.error("❌ خطأ: يجب وضع مفتاح API Gemini داخل ملف scripts/vocalize_gemini.mjs");
        return;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');
    const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');

    const fileContent = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '');
    const bible = JSON.parse(fileContent);

    console.log("🚀 بدء التشكيل الاحترافي باستخدام Gemini AI...");

    for (let b = 0; b < bible.length; b++) {
        const book = bible[b];
        console.log(`\n📦 جاري تشكيل سفر: ${book.abbrev} (${b + 1}/${bible.length})`);

        for (let c = 0; c < book.chapters.length; c++) {
            const chapter = book.chapters[c];

            // سنرسل 15 آية في كل طلب لتوفير الوقت وضمان الدقة
            for (let i = 0; i < chapter.length; i += 15) {
                const batch = chapter.slice(i, i + 15);
                const prompt = `قم بتشكيل الآيات العربية التالية تشكيلاً كاملاً ودقيقاً. أعد النتيجة كقائمة نصوص فقط، كل آية في سطر جديد، بنفس الترتيب وبدون أي شرح أو مقدمات:\n\n${batch.join('\n')}`;

                try {
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const vocalizedText = response.text().trim();
                    const vocalizedVerses = vocalizedText.split('\n').filter(l => l.trim() !== '');

                    for (let j = 0; j < vocalizedVerses.length; j++) {
                        if (bible[b].chapters[c][i + j]) {
                            bible[b].chapters[c][i + j] = vocalizedVerses[j];
                        }
                    }
                } catch (e) {
                    console.error(`\n❌ فشل في الطلب عند أصحاح ${c+1}:`, e.message);
                    // في حال الفشل ننتظر ثواني ونكمل
                    await new Promise(r => setTimeout(r, 2000));
                }

                process.stdout.write(`\r   - أصحاح ${c + 1} | تقدم: ${Math.min(i + 15, chapter.length)}/${chapter.length}`);
            }
            // حفظ دوري لضمان الأمان
            fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2));
        }
    }

    console.log("\n\n✅ تم الانتهاء بنجاح! الملف جاهز: ar_svd_tashkeel.json");
}

main();
