import json
import os

def convert_web():
    # المسارات الأساسية
    base_path = "F:/AlMalak system/Agios Bible/website/public/data"
    web_folder = os.path.join(base_path, "bibles/world-english-bible-master/world-english-bible-master/json")
    output_path = os.path.join(base_path, "bibles/en_web.json")
    book_names_path = os.path.join(base_path, "bookNames.json")

    if not os.path.exists(web_folder):
        print(f"❌ Error: WEB folder not found at {web_folder}")
        return

    # 1. تحميل الاختصارات والترتيب من bookNames (English)
    try:
        with open(book_names_path, 'r', encoding='utf-8') as f:
            book_names_meta = json.load(f).get('en', [])
    except Exception as e:
        print(f"❌ Error loading bookNames.json: {e}")
        return

    final_output = []

    # 2. الحصول على قائمة بكل الملفات في مجلد WEB لتسهيل البحث
    web_files = {f.lower(): f for f in os.listdir(web_folder) if f.endswith('.json')}

    # 3. معالجة كل سفر بالترتيب الصحيح (66 سفر)
    processed_count = 0
    for meta in book_names_meta:
        book_name = meta['name']
        abbrev = meta['book_id']

        # تجهيز اسم الملف للبحث (إزالة المسافات وتحويل لـ lowercase)
        # مثال: "1 Samuel" -> "1samuel.json"
        filename_to_find = f"{book_name.lower().replace(' ', '')}.json"

        # تصحيح لبعض الأسماء الخاصة
        if book_name == "Song of Solomon":
            filename_to_find = "songofsolomon.json"

        if filename_to_find in web_files:
            file_path = os.path.join(web_folder, web_files[filename_to_find])
            print(f"Processing: {book_name} ({abbrev})...")

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    raw_data = json.load(f)

                # تجميع الداتا في هيكل مؤقت (Chapters -> Verses)
                chapters_dict = {}

                for item in raw_data:
                    if 'chapterNumber' in item and 'verseNumber' in item and 'value' in item:
                        ch_num = int(item['chapterNumber'])
                        vs_num = int(item['verseNumber'])
                        text = item['value'].strip()

                        if ch_num not in chapters_dict:
                            chapters_dict[ch_num] = {}

                        if vs_num not in chapters_dict[ch_num]:
                            chapters_dict[ch_num][vs_num] = []

                        if text:
                            chapters_dict[ch_num][vs_num].append(text)

                # تحويل الـ dict لمصفوفات مرتبة زي فورمات KJV
                chapters_list = []
                sorted_ch_keys = sorted(chapters_dict.keys())

                for ch_key in sorted_ch_keys:
                    verses_dict = chapters_dict[ch_key]
                    sorted_vs_keys = sorted(verses_dict.keys())

                    # دمج أجزاء الآية الواحدة بمسافة واحدة
                    verses_list = [" ".join(verses_dict[vs_key]).strip() for vs_key in sorted_vs_keys]
                    chapters_list.append(verses_list)

                # إضافة السفر للهيكل النهائي (نستخدم abbrev كما هو في bookNames)
                final_output.append({
                    "abbrev": abbrev,
                    "chapters": chapters_list
                })
                processed_count += 1
            except Exception as e:
                print(f"❌ Error processing {book_name}: {e}")
        else:
            # تنبيه لو الكتاب مش موجود (زي الكتب القانونية الثانية)
            # بما إننا شغالين على 66 سفر، فده متوقع لبعض الكتب
            pass

    # 4. حفظ الملف المجمع النهائي
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Success! {processed_count} books combined into: {output_path}")
    except Exception as e:
        print(f"❌ Error saving output file: {e}")

if __name__ == "__main__":
    convert_web()
