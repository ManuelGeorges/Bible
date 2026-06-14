const fs = require('fs');
const path = require('path');

// ملاحظة: سنستخدم API مشكال العام.
// إذا كان لديك عدد كبير جداً من الطلبات، يفضل تشغيله على دفعات.

async function vocalizeText(text) {
    try {
        // نستخدم API مشكال المجاني
        const response = await fetch('https://tashkeel.alsharekh.org/api/Tashkeel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        const data = await response.json();
        return data.vocalized || text;
    } catch (error) {
        // في حال فشل الـ API، نستخدم API بديل أو نعود بالنص الأصلي
        try {
            const res = await fetch(`https://misqal.pythonanywhere.com/vocalize?text=${encodeURIComponent(text)}`);
            const val = await res.text();
            return val || text;
        } catch (e) {
            return text;
        }
    }
}

async function main() {
    const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');
    const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');

    if (!fs.existsSync(inputPath)) {
        console.error("الملف غير موجود!");
        return;
    }

    const bible = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log("--- بدء عملية التشكيل عبر الـ API ---");

    for (let b = 0; b < bible.length; b++) {
        const book = bible[b];
        console.log(`\nجاري معالجة سفر: ${book.abbrev} (${b + 1}/${bible.length})`);

        for (let c = 0; c < book.chapters.length; c++) {
            const chapter = book.chapters[c];

            // تشكيل الآيات داخل الأصحاح
            for (let v = 0; v < chapter.length; v++) {
                const originalVerse = chapter[v];
                // نقوم بالتشكيل
                const vocalized = await vocalizeText(originalVerse);
                bible[b].chapters[c][v] = vocalized;

                process.stdout.write(`\r   - الأصحاح ${c + 1} | الآية ${v + 1}/${chapter.length}`);
            }

            // حفظ دوري كل أصحاح لضمان عدم ضياع الشغل إذا انقطع الإنترنت
            fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2));
        }
    }

    console.log("\n\n✅ تم الانتهاء بنجاح! الملف موجود في: public/data/bibles/ar_svd_tashkeel.json");
}

main();
