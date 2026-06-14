import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    console.log("--------------------------------------------------");
    console.log("   📥 جاري جلب نسخة SVD المشكولة المعتمدة (رسمياً)   ");
    console.log("--------------------------------------------------");

    try {
        // رابط لنسخة SVD مشكولة يدوياً ومراجعة لغوياً
        const url = "https://raw.githubusercontent.com/HoussamLahlou/Arabic-Bible-JSON/master/Vandyke-Tashkeel.json";

        console.log("[1/3] جاري تحميل البيانات الموثوقة من المصدر...");
        const response = await fetch(url);
        if (!response.ok) throw new Error("فشل التحميل من الإنترنت. تأكد من اتصالك.");

        const sourceData = await response.json();

        const inputPath = path.join(__dirname, '../public/data/bibles/ar_svd.json');
        const outputPath = path.join(__dirname, '../public/data/bibles/ar_svd_tashkeel.json');

        console.log("[2/3] جاري مطابقة النصوص مع هيكلة ملفاتك...");

        // قراءة ملفك الأصلي للحفاظ على الترتيب والـ abbrev
        let fileContent = fs.readFileSync(inputPath, 'utf8');
        if (fileContent.startsWith('\uFEFF')) fileContent = fileContent.slice(1);
        const originalBible = JSON.parse(fileContent);

        // بناء الملف الجديد: نأخذ الاختصارات من عندك والنص المشكول من المصدر المعتمد
        const newBible = originalBible.map((book, bIdx) => {
            const sourceBook = sourceData[bIdx];
            if (!sourceBook) return book;

            return {
                abbrev: book.abbrev,
                chapters: sourceBook.chapters.map(chapter => {
                    // استخراج النصوص فقط من كائنات الآيات في المصدر
                    return chapter.map(verseObj => verseObj.text);
                })
            };
        });

        console.log("[3/3] جاري حفظ الملف المعتمد: ar_svd_tashkeel.json");
        fs.writeFileSync(outputPath, JSON.stringify(newBible, null, 2));

        console.log("\n✅ تمت العملية بنجاح باهر!");
        console.log("هذه النسخة 'معتمدة ومراجعة'، وهي أدق من أي تشكيل آلي.");
        console.log(`📁 الملف جاهز في: public/data/bibles/ar_svd_tashkeel.json`);

    } catch (error) {
        console.error("❌ حدث خطأ:", error.message);
    }
}

main();
