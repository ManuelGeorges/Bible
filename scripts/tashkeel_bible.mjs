import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function vocalizeText(text) {
    if (!text || text.trim().length === 0) return text;

    try {
        // نستخدم API مشكال المجاني المتاح للجمهور
        const response = await fetch(`https://misqal.pythonanywhere.com/vocalize?text=${encodeURIComponent(text)}`);
        if (!response.ok) throw new Error('API Error');
        const vocalized = await response.text();
        return vocalized || text;
    } catch (error) {
        // في حال فشل الـ API، ننتظر قليلاً ثم نحاول مرة أخرى أو نرجع النص الأصلي
        return text;
    }
}

async function main() {
    const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');
    const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');

    if (!fs.existsSync(inputPath)) {
        console.error("❌ الملف الأصلي غير موجود في: " + inputPath);
        return;
    }

    const bible = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log("-----------------------------------------");
    console.log("   🚀 بدء تشكيل الكتاب المقدس (JavaScript)   ");
    console.log("-----------------------------------------");

    for (let b = 0; b < bible.length; b++) {
        const book = bible[b];
        console.log(`\n📦 جاري معالجة: ${book.abbrev} (${b + 1}/${bible.length})`);

        for (let c = 0; c < book.chapters.length; c++) {
            const chapter = book.chapters[c];

            for (let v = 0; v < chapter.length; v++) {
                const originalVerse = chapter[v];
                // إرسال للتشكيل
                bible[b].chapters[c][v] = await vocalizeText(originalVerse);

                process.stdout.write(`\r   - أصحاح ${c + 1} | آية ${v + 1}/${chapter.length} جاري التشكيل...`);
            }

            // حفظ دوري كل أصحاح لضمان عدم ضياع البيانات
            fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2));
        }
    }

    console.log("\n\n✅ تمت المهمة بنجاح!");
    console.log("📁 الملف الجديد: public/data/bibles/ar_svd_tashkeel.json");
}

main().catch(console.error);
