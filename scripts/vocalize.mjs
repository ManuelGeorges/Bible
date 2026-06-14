import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- إعدادات Gemini ---
// يرجى وضع مفتاح API الخاص بك هنا
const API_KEY = "YOUR_GEMINI_API_KEY";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function vocalizeBatch(verses) {
    const prompt = `قم بتشكيل الآيات العربية التالية تشكيلاً كاملاً ودقيقاً. أعد النتيجة كقائمة نصوص فقط، كل آية في سطر جديد، وبنفس الترتيب:\n\n${verses.join('\n')}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error("Batch error:", error.message);
        return verses; // العودة بالأصل في حال الخطأ
    }
}

async function main() {
    const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');
    const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');

    if (!fs.existsSync(inputPath)) {
        console.error("❌ ملف ar_svd.json غير موجود!");
        return;
    }

    const bible = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log("🚀 بدء التشكيل باستخدام ذكاء Gemini الاصطناعي...");

    for (let b = 0; b < bible.length; b++) {
        const book = bible[b];
        console.log(`\n📦 جاري معالجة سفر: ${book.abbrev} (${b + 1}/${bible.length})`);

        for (let c = 0; c < book.chapters.length; c++) {
            const chapter = book.chapters[c];
            // سنرسل كل 10 آيات معاً لتسريع العملية وضمان الجودة
            for (let i = 0; i < chapter.length; i += 10) {
                const batch = chapter.slice(i, i + 10);
                const vocalizedBatch = await vocalizeBatch(batch);

                // تحديث الآيات في الملف
                for (let j = 0; j < vocalizedBatch.length; j++) {
                    if (chapter[i + j]) {
                        bible[b].chapters[c][i + j] = vocalizedBatch[j];
                    }
                }
                process.stdout.write(`\r   - أصحاح ${c + 1} | تقدم: ${Math.min(i + 10, chapter.length)}/${chapter.length}`);
            }
            // حفظ دوري
            fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2));
        }
    }
    console.log("\n\n✅ تم الانتهاء بنجاح! الملف جاهز في ar_svd_tashkeel.json");
}

if (API_KEY === "YOUR_GEMINI_API_KEY") {
    console.error("❌ من فضلك حط الـ API Key بتاع Gemini في الملف أولاً!");
} else {
    main();
}
