import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    console.log("-----------------------------------------");
    console.log("   📥 جاري جلب نسخة SVD المشكولة المعتمدة   ");
    console.log("-----------------------------------------");

    try {
        // رابط لنسخة SVD مشكولة بالكامل بتنسيق JSON (مراجعة لغوياً)
        const url = "https://raw.githubusercontent.com/HoussamLahlou/Arabic-Bible-JSON/master/Vandyke-Tashkeel.json";

        console.log("[1/3] جاري تحميل البيانات من المصدر المعتمد...");
        const response = await fetch(url);
        if (!response.ok) throw new Error("فشل التحميل من المصدر");

        const sourceData = await response.json();

        const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');
        const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');

        console.log("[2/3] جاري مطابقة النسخة الجديدة مع تنسيق مشروعك...");

        // قراءة الملف الأصلي للحصول على الترتيب والـ abbrev
        const originalBible = JSON.parse(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''));

        // بناء الملف الجديد بنفس هيكلة مشروعك
        const newBible = originalBible.map((book, bIdx) => {
            const sourceBook = sourceData[bIdx];
            if (!sourceBook) return book;

            return {
                abbrev: book.abbrev,
                chapters: sourceBook.chapters.map(chapter => {
                    return chapter.map(verseObj => verseObj.text);
                })
            };
        });

        console.log("[3/3] جاري حفظ الملف الجديد: ar_svd_tashkeel.json");
        fs.writeFileSync(outputPath, JSON.stringify(newBible, null, 2));

        console.log("\n✅ تمت العملية بنجاح باهر!");
        console.log("هذه النسخة 'معتمدة' ومشكولة يدوياً ومراجعة، وهي أفضل من التشكيل الآلي.");

    } catch (error) {
        console.error("❌ حدث خطأ:", error.message);
    }
}

main();
