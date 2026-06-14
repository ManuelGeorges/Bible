import json
import os
import sys

# التأكد من استخدام المكتبة من البيئة المحلية
try:
    from mishkal.tashkeel import Tashkeel
    print("[+] تم تحميل محرك مشكال المعتمد بنجاح.")
except ImportError:
    print("[!] خطأ: لم يتم العثور على المكتبة. تأكد من تشغيل pip install أولاً.")
    sys.exit()

def main():
    vocalizer = Tashkeel()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd.json')
    output_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd_tashkeel.json')

    if not os.path.exists(input_path):
        print(f"❌ لم يتم العثور على الملف في: {input_path}")
        return

    print("\n" + "="*50)
    print("   🚀 بدء التشكيل الاحترافي (Mishkal Local Engine)")
    print("   العملية تتم محلياً 100% لضمان الدقة والأمان")
    print("="*50)

    with open(input_path, 'r', encoding='utf-8-sig') as f:
        data = json.load(f)

    total_books = len(data)

    for b_idx, book in enumerate(data):
        print(f"\n[{b_idx+1}/{total_books}] جاري تشكيل سفر: {book['abbrev']}")
        for c_idx, chapter in enumerate(book['chapters']):
            for v_idx, verse in enumerate(chapter):
                # التشكيل الفعلي
                data[b_idx]['chapters'][c_idx][v_idx] = vocalizer.tashkeel(verse)

            sys.stdout.write(f"\r   - الأصحاح {c_idx + 1}/{len(book['chapters'])} مكتمل")
            sys.stdout.flush()

        # حفظ التقدم دورياً
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n\n✅ تمت المهمة بنجاح باهر!")
    print(f"📁 الملف المشكول متاح الآن في: {output_path}")

if __name__ == "__main__":
    main()
