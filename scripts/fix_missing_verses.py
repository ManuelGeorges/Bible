import json
import os
import re

def strip_tashkeel(text):
    """إزالة التشكيل من النص العربي"""
    tashkeel_pattern = re.compile(r'[\u064B-\u0652]')
    return tashkeel_pattern.sub('', text)

def fix_bible_data():
    # تحديد المسارات بناءً على بنية مشروعك
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # الملف المرجع (اللي فيه التشكيل وكامل)
    reference_path = os.path.join(base_dir, 'public/data/translations/arabic/ar_svd_tashkeel_site.json')
    # الملف اللي عايز نكمله (النص العادي)
    target_path = os.path.join(base_dir, 'public/data/translations/arabic/ar_svd_no_tashkeel.json')

    if not os.path.exists(reference_path):
        print(f"❌ الملف المرجع غير موجود في: {reference_path}")
        return
    if not os.path.exists(target_path):
        print(f"❌ الملف الهدف غير موجود في: {target_path}")
        return

    print("📖 جاري تحميل البيانات...")
    with open(reference_path, 'r', encoding='utf-8') as f:
        ref_data = json.load(f)

    with open(target_path, 'r', encoding='utf-8') as f:
        target_data = json.load(f)

    fixed_verses_count = 0
    fixed_chapters_count = 0

    # تحويل بيانات الهدف لقاموس للوصول السريع
    target_books = {b['abbrev'].lower(): b for b in target_data}

    for book in ref_data:
        abbrev = book['abbrev'].lower()
        if abbrev not in target_books:
            print(f"⚠️ السفر {abbrev} مفقود تماماً من النسخة العادية!")
            continue

        target_book = target_books[abbrev]

        for c_idx, ref_chapter in enumerate(book['chapters']):
            chapter_num = c_idx + 1

            # إذا كان الإصحاح مفقوداً بالكامل
            if c_idx >= len(target_book['chapters']):
                missing_ch = [strip_tashkeel(v) for v in ref_chapter]
                target_book['chapters'].append(missing_ch)
                fixed_verses_count += len(ref_chapter)
                fixed_chapters_count += 1
                continue

            target_chapter = target_book['chapters'][c_idx]

            # إذا كان هناك نقص في عدد الآيات داخل الإصحاح
            if len(target_chapter) != len(ref_chapter):
                print(f"🔧 تصليح {abbrev.upper()} {chapter_num}: (كان {len(target_chapter)} آية -> أصبح {len(ref_chapter)})")

                new_chapter = []
                for v_idx, ref_verse in enumerate(ref_chapter):
                    # إذا كانت الآية موجودة أصلاً في الملف الهدف ولها طول منطقي
                    if v_idx < len(target_chapter) and len(target_chapter[v_idx]) > 2:
                        new_chapter.append(target_chapter[v_idx])
                    else:
                        # إذا كانت ناقصة، خذها من المرجع ونظفها من التشكيل
                        clean_verse = strip_tashkeel(ref_verse)
                        new_chapter.append(clean_verse)
                        fixed_verses_count += 1

                target_book['chapters'][c_idx] = new_chapter
                fixed_chapters_count += 1

    # حفظ النتائج
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(target_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ تم الانتهاء بنجاح!")
    print(f"   - عدد الآيات التي تم إضافتها/تصحيحها: {fixed_verses_count}")
    print(f"   - عدد الإصحاحات التي تم تعديلها: {fixed_chapters_count}")

if __name__ == "__main__":
    fix_bible_data()
