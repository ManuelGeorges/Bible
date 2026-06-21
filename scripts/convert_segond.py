import json
import os

def convert_segond():
    # المسارات بناءً على بنية مشروعك
    base_path = "F:/AlMalak system/Agios Bible/website/public/data"
    input_path = os.path.join(base_path, "bibles/segond_1910.json")
    output_path = os.path.join(base_path, "bibles/fr_segond.json")
    book_names_path = os.path.join(base_path, "bookNames.json")

    if not os.path.exists(input_path):
        print(f"❌ Error: Source file not found at {input_path}")
        return

    # 1. تحميل الملف المصدري (الذي يحتوي على metadata و verses)
    with open(input_path, 'r', encoding='utf-8') as f:
        source_data = json.load(f)

    # 2. تحميل الاختصارات المعتمدة في مشروعك من bookNames.json (قسم fr)
    with open(book_names_path, 'r', encoding='utf-8') as f:
        book_names_meta = json.load(f).get('fr', [])

    # تنظيم الآيات في قاموس مؤقت لتسهيل الترتيب
    # { رقم_السفر: { رقم_الإصحاح: [نصوص_الآيات] } }
    temp_bible = {}
    for v in source_data['verses']:
        b_num = v['book']
        c_num = v['chapter']
        # تنظيف النص من علامة الفقرة ¶ والمسافات الزائدة
        v_text = v['text'].replace('¶ ', '').strip()

        if b_num not in temp_bible:
            temp_bible[b_num] = {}
        if c_num not in temp_bible[b_num]:
            temp_bible[b_num][c_num] = []

        temp_bible[b_num][c_num].append(v_text)

    # 3. بناء الهيكل النهائي مطابق لـ en_kjv.json و ar_svd_no_tashkeel.json
    final_output = []

    # نستخدم الترتيب الرسمي للأسفار في مشروعك
    for i, meta in enumerate(book_names_meta, start=1):
        # i يمثل رقم السفر (1 للتكوين، 2 للخروج، إلخ)
        if i in temp_bible:
            chapters_dict = temp_bible[i]
            # ترتيب الإصحاحات تصاعدياً (1, 2, 3...)
            sorted_chapters_keys = sorted(chapters_dict.keys())

            chapters_list = []
            for ch_idx in sorted_chapters_keys:
                chapters_list.append(chapters_dict[ch_idx])

            # الفورمات المطلوب بالظبط
            final_output.append({
                "abbrev": meta['book_id'], # سيستخدم "Gen", "Exo", إلخ
                "chapters": chapters_list
            })
        else:
            # تنبيه في حال كان السفر مفقوداً في نسخة Segond (مثل الأسفار القانونية الثانية)
            print(f"⚠️ Note: {meta['name']} not found in source.")

    # 4. حفظ الملف النهائي بتنسيق JSON نظيف
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Success! File created at: {output_path}")
    print(f"Format matches your existing Bible files perfectly.")

if __name__ == "__main__":
    convert_segond()
