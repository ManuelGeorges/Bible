import json
import os
import sys
import re

def get_vocalizer():
    print("[*] جاري البحث عن محرك التشكيل داخل المكتبة...")
    try:
        import mishkal.tashkeel
        engine = None
        possible_classes = ['Tashkeeler', 'Tashkeel', 'Mishkal']
        for cls_name in possible_classes:
            if hasattr(mishkal.tashkeel, cls_name):
                cls = getattr(mishkal.tashkeel, cls_name)
                try:
                    engine = cls()
                    print(f"[+] تم العثور على المحرك: {cls_name}")
                    break
                except: continue

        if not engine:
            for attr_name in dir(mishkal.tashkeel):
                attr = getattr(mishkal.tashkeel, attr_name)
                if isinstance(attr, type):
                    try:
                        temp_obj = attr()
                        if hasattr(temp_obj, 'tashkeel') or hasattr(temp_obj, 'vocalize'):
                            engine = temp_obj
                            print(f"[+] تم اكتشاف المحرك تلقائياً: {attr_name}")
                            break
                    except: continue

        if engine:
            return engine.tashkeel if hasattr(engine, 'tashkeel') else engine.vocalize
        return None
    except Exception as e:
        print(f"[!] خطأ تقني في المكتبة: {e}")
        return None

def clean_text(text):
    """تنظيف النص وضمان عدم التصاق الكلمات أو تقطيعها"""
    if not text: return ""

    # 1. استبدال كافة أنواع الأسطر والرموز الغريبة بمسافة واحدة
    text = re.sub(r'[\x00-\x1F\x7F\s\u200b\u200c\u200d\u200e\u200f]+', ' ', text)

    # 2. إضافة مسافة بعد علامات الترقيم (النقطة والفاصلة) إذا كانت مفقودة
    # هذا يمنع التصاق الجمل ببعضها
    text = re.sub(r'([\.،؛:])(?=[^\s\d])', r'\1 ', text)

    # 3. حذف الرموز غير المطبوعة مع الحفاظ على المسافات والتشكيل
    text = "".join(ch for ch in text if ch.isprintable() or ch == ' ')

    # 4. تصحيحات لغوية خاصة لترجمة فانديك
    text = text.replace('خَلْقَ اللهُ', 'خَلَقَ اللهُ').replace('بِدْءِ', 'بَدْءِ')

    # 5. تقليص المسافات الزائدة (بدون تقطيع الكلمات)
    text = re.sub(r' +', ' ', text)

    return text.strip()

def main():
    print("\n" + "="*50)
    print("   🚀 بدء التشكيل النهائي المعتمد (Mishkal 1.10)")
    print("   إصلاح المسافات ومنع تقطيع الكلمات")
    print("="*50)

    vocalize_func = get_vocalizer()
    if not vocalize_func:
        print("\n[!] فشل تحميل المكتبة. تأكد من تشغيل: pip install mishkal")
        return

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd.json')
    output_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd_tashkeel.json')

    try:
        with open(input_path, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ فشل فتح الملف الأصلي: {e}")
        return

    total_books = len(data)
    for b_idx, book in enumerate(data):
        print(f"\n[{b_idx+1}/{total_books}] جاري معالجة: {book.get('abbrev', b_idx)}")
        for c_idx, chapter in enumerate(book['chapters']):
            for v_idx, verse in enumerate(chapter):
                if verse.strip().startswith('<'): continue
                try:
                    # تنظيف النص الأصلي "قبل" إرساله للمحرك لضمان وجود الفواصل
                    prepared_verse = clean_text(verse)
                    # التشكيل
                    vocalized = vocalize_func(prepared_verse)
                    # تنظيف نهائي للناتج
                    data[b_idx]['chapters'][c_idx][v_idx] = clean_text(vocalized)
                except: continue

            sys.stdout.write(f"\r   - الأصحاح {c_idx + 1}/{len(book['chapters'])} مكتمل")
            sys.stdout.flush()

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n\n✅ مبروك! العملية تمت بنجاح والمسافات الآن سليمة.")

if __name__ == "__main__":
    main()
