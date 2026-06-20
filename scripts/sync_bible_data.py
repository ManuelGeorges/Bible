import json
import os

def sync_data():
    base_path = "F:/AlMalak system/Agios Bible/website/public/data"
    book_names_path = os.path.join(base_path, "bookNames.json")

    with open(book_names_path, 'r', encoding='utf-8-sig') as f:
        book_names_data = json.load(f)

    # الأسفار القانونية الثانية التي تميز نسخة الـ 73 سفر عن الـ 66
    deuterocanon_ids = {"TOB", "JDT", "WIS", "SIR", "BAR", "1MA", "2MA"}

    bibles = {
        "ar": ["bibles/ar_svd_tashkeel_site.json", "bibles/ar_svd_no_tashkeel.json"],
        "en": ["bibles/en_kjv.json"],
        "fr": ["bibles/fr_apee.json"],
        "de": ["bibles/de_schlachter.json"]
    }

    for lang, rel_paths in bibles.items():
        all_metadata = book_names_data.get(lang, [])
        if not all_metadata: continue

        # تحضير قائمة الـ 66 سفر فقط للترجمات التي لا تشمل القانونية الثانية
        metadata_66 = [m for m in all_metadata if m['book_id'].upper() not in deuterocanon_ids]

        for rel_path in rel_paths:
            full_path = os.path.join(base_path, rel_path)
            if not os.path.exists(full_path): continue

            print(f"Processing {full_path}...")
            with open(full_path, 'r', encoding='utf-8-sig') as f:
                bible_data = json.load(f)

            # تحديد القائمة المرجعية بناءً على عدد الكتب في الملف الفعلي
            count = len(bible_data)
            if count == 66:
                reference_metadata = metadata_66
                print(f"  -> Matching as 66-book Bible (Protestant Canon)")
            elif count == 73:
                reference_metadata = all_metadata
                print(f"  -> Matching as 73-book Bible (Orthodox Canon)")
            else:
                print(f"  -> Warning: File has {count} books. Matching by order with all metadata.")
                reference_metadata = all_metadata

            # تصحيح البيانات بناءً على القائمة المرجعية الصحيحة
            for i in range(min(len(bible_data), len(reference_metadata))):
                bible_data[i]['name'] = reference_metadata[i]['name']
                bible_data[i]['abbrev'] = reference_metadata[i]['book_id']

            # حفظ الملف بصيغة UTF-8 نظيفة وبدون أخطاء
            with open(full_path, 'w', encoding='utf-8') as f:
                json.dump(bible_data, f, ensure_ascii=False, indent=2)
            print(f"  Successfully fixed and synchronized {rel_path}")

if __name__ == "__main__":
    sync_data()