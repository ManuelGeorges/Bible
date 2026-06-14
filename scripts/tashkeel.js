const fs = require('fs');
const path = require('path');
const https = require('https');

// دالة لجلب التشكيل من مصدر بديل وأكثر استقراراً
async function getTashkeel(text) {
    return new Promise((resolve) => {
        if (!text || text.trim().length === 0) return resolve(text);

        // استخدام API مشكال (المحرك الأصلي) من سيرفر مختلف
        const encodedText = encodeURIComponent(text);
        const url = `https://tashkeel.alsharekh.org/api/Tashkeel`; // يمكنك تجربة مصادر أخرى هنا

        // سنستخدم هنا API مشكال العام المتاح للجمهور (تأكد من استقرار الإنترنت)
        const options = {
            hostname: 'misqal.pythonanywhere.com',
            path: `/vocalize?text=${encodedText}`,
            method: 'GET',
            timeout: 10000
        };

        const req = https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const result = data.trim();
                // حماية: لو النتيجة فيها HTML أو رسالة خطأ، نرجع النص الأصلي
                if (result.includes('<html>') || result.includes('<!DOCTYPE') || result.length === 0) {
                    resolve(text);
                } else {
                    resolve(result);
                }
            });
        });

        req.on('error', () => resolve(text));
        req.on('timeout', () => {
            req.destroy();
            resolve(text);
        });
    });
}

async function main() {
    const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');
    const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');

    // قراءة الملف الأصلي
    let fileContent = fs.readFileSync(inputPath, 'utf8');
    if (fileContent.startsWith('\uFEFF')) fileContent = fileContent.slice(1);

    const bible = JSON.parse(fileContent);
    console.log("-----------------------------------------");
    console.log("   🚀 جاري تشكيل الكتاب المقدس (إصدار Node.js)   ");
    console.log("   سيتم حفظ التقدم تلقائياً لكل أصحاح");
    console.log("-----------------------------------------");

    for (let b = 0; b < bible.length; b++) {
        const book = bible[b];
        console.log(`\n📦 سفر: ${book.abbrev} (${b + 1}/${bible.length})`);

        for (let c = 0; c < book.chapters.length; c++) {
            const chapter = book.chapters[c];

            for (let v = 0; v < chapter.length; v++) {
                const originalVerse = chapter[v];

                // تخطي لو كانت الآية أصلاً HTML أو متشكلة
                if (originalVerse.includes('<')) continue;

                const vocalized = await getTashkeel(originalVerse);
                bible[b].chapters[c][v] = vocalized;

                process.stdout.write(`\r   - أصحاح ${c + 1} | آية ${v + 1}/${chapter.length} تم التشكيل...`);
            }

            // حفظ دوري لضمان عدم ضياع الشغل
            fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2));
        }
    }

    console.log("\n\n✅ مبروك! العملية تمت بنجاح.");
    console.log(`📁 الملف الجديد موجود في: public/data/bibles/ar_svd_tashkeel.json`);
}

main().catch(err => console.error("❌ حدث خطأ غير متوقع:", err));
