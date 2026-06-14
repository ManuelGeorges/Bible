import json
import os
import sys
import re

def get_vocalizer():
    print("[*] جاري البحث عن محرك التشكيل داخل المكتبة...")
    try:
        import mishkal.tashkeel
        engine = None

        # 1. البحث عن أي كائن يحتوي على وظيفة التشكيل في المودول
        # نجرب الأسماء المشهورة أولاً
        possible_classes = ['Tashkeeler', 'Tashkeel', 'Mishkal']
        for cls_name in possible_classes:
            if hasattr(mishkal.tashkeel, cls_name):
                cls = getattr(mishkal.tashkeel, cls_name)
                try:
                    engine = cls()
                    print(f"[+] تم العثور على المحرك: {cls_name}")
                    break
                except: continue

        # 2. إذا لم نجد الأسماء المشهورة، نبحث في كل محتويات المودول
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
            # تحديد الدالة الصحيحة (tashkeel أو vocalize)
            if hasattr(engine, 'tashkeel'):
                return engine.tashkeel
            elif hasattr(engine, 'vocalize'):
                return engine.vocalize

        return None
    except Exception as e:
        print(f"[!] خطأ تقني في المكتبة: {e}")
        return None

def clean_text(text):
    if not text: return ""
    # حذف الرموز الغريبة \u0001 وأي رموز تحكم غير مطبوعة
    text = "".join(ch for ch in text if ch.isprintable())
    # حذف بقايا الرموز غير المرغوب فيها بالـ Regex
    text = re.sub(r'[\x00-\x1F\x7F]', '', text)
    # تصحيحات لغوية "رسمية" لترجمة فانديك
    text = text.replace('خَلْقَ اللهُ', 'خَلَقَ اللهُ')
    text = text.replace('بِدْءِ', 'بَدْءِ')
    return text.strip()

def main():
    print("\n" + "="*50)
    print("   🚀 بدء التشكيل النهائي المعتمد (Mishkal 1.10)")
    print("   المعالجة محلية 100% | تنظيف تلقائي للرموز")
    print("="*50)

    vocalize_func = get_vocalizer()
    if not vocalize_func:
        print("\n[!] لم نتمكن من تشغيل المحرك. تأكد من تثبيت المكتبة:")
        print(" py -m pip install mishkal")
        return

    # المسارات
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd.json')
    output_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd_tashkeel.json')

    # قراءة الملف الأصلي
    try:
        with open(input_path, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ فشل في فتح الملف الأصلي: {e}")
        return

    total_books = len(data)
    print(f"[*] تم تحميل {total_books} سفر. بدء المعالجة (قد تستغرق 20 دقيقة)...")

    for b_idx, book in enumerate(data):
        print(f"\n[{b_idx+1}/{total_books}] جاري تشكيل سفر: {book.get('abbrev', b_idx)}")
        for c_idx, chapter in enumerate(book['chapters']):
            for v_idx, verse in enumerate(chapter):
                if verse.strip().startswith('<'): continue # حماية من الـ HTML
                try:
                    # التشكيل + التنظيف الفوري
                    vocalized = vocalize_func(verse)
                    data[b_idx]['chapters'][c_idx][v_idx] = clean_text(vocalized)
                except: continue

            sys.stdout.write(f"\r   - الأصحاح {c_idx + 1}/{len(book['chapters'])} مكتمل")
            sys.stdout.flush()

        # حفظ دوري بعد كل سفر لضمان الأمان
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n\n✅ مبروك! العملية تمت بنجاح باهر والملف نظيف وجاهز.")

if __name__ == "__main__":
    main()
