import json
import os

def convert_niv():
    # المسارات
    base_path = "F:/AlMalak system/Agios Bible/website/public/data"
    niv_folder = os.path.join(base_path, "bibles/Bible-niv-main/Bible-niv-main")
    output_path = os.path.join(base_path, "bibles/en_niv.json")
    book_names_path = os.path.join(base_path, "bookNames.json")

    if not os.path.exists(niv_folder):
        print(f"❌ Error: NIV folder not found at {niv_folder}")
        return

    # 1. تحميل الاختصارات والترتيب من bookNames (English)
    with open(book_names_path, 'r', encoding='utf-8') as f:
        book_names_meta = json.load(f).get('en', [])

    final_output = []

    # 2. الحصول على قائمة بكل الملفات في مجلد NIV لتسهيل البحث (بدون اعتبار لحالة الأحرف)
    niv_files = {f.lower(): f for f in os.listdir(niv_folder) if f.endswith('.json')}

    # 3. معالجة كل سفر بالترتيب الصحيح
    for meta in book_names_meta:
        book_name = meta['name']
        abbrev = meta['book_id']

        # محاولة إيجاد الملف (مثلاً Genesis.json أو 1 Chronicles.json)
        filename_to_find = f"{book_name.lower()}.json"

        if filename_to_find in niv_files:
            file_path = os.path.join(niv_folder, niv_files[filename_to_find])
            print(f"Processing: {book_name}...")

            with open(file_path, 'r', encoding='utf-8') as f:
                book_data = json.load(f)

            chapters_list = []
            # استخراج الآيات من هيكل NIV (chapters -> verses -> text)
            for ch in book_data['chapters']:
                verses_list = []
                for v in ch['verses']:
                    verses_list.append(v['text'].strip())
                chapters_list.append(verses_list)

            # إضافة السفر للهيكل النهائي بنفس فورمات KJV
            final_output.append({
                "abbrev": abbrev,
                "chapters": chapters_list
            })
        else:
            print(f"⚠️ Warning: File for {book_name} not found in NIV folder.")

    # 4. حفظ الملف المجمع
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Success! All 66 NIV books combined into: {output_path}")
    print(f"Total books in file: {len(final_output)}")

if __name__ == "__main__":
    convert_niv()
