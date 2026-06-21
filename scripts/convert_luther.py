import json
import os
import xml.etree.ElementTree as ET

def convert_luther():
    # المسارات
    base_path = "F:/AlMalak system/Agios Bible/website/public/data"
    xml_path = os.path.join(base_path, "bibles/luth1912.xml")
    output_path = os.path.join(base_path, "bibles/de_luther.json")
    book_names_path = os.path.join(base_path, "bookNames.json")

    if not os.path.exists(xml_path):
        print(f"❌ Error: Luther XML file not found at {xml_path}")
        return

    # 1. تحميل الاختصارات من bookNames (English/Standard IDs)
    with open(book_names_path, 'r', encoding='utf-8') as f:
        book_names_meta = json.load(f).get('en', [])

    # خريطة لتحويل أسماء OSIS للاختصارات المعتمدة في السيستم
    # معظم ملفات OSIS بتستخدم اختصارات قريبة جداً من اللي عندنا
    standard_ids = [meta['book_id'] for meta in book_names_meta]

    print("Parsing XML... (This might take a few seconds)")
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # تحديد الـ namespace بتاع OSIS لو موجود
    ns = {'ns': 'http://www.bibletechnologies.net/2003/OSIS/namespace'}

    final_output = []

    # 2. البحث عن الكتب (div type='book')
    # بنستخدم findall مع الـ namespace أو بدونه حسب الملف
    books = root.findall(".//{http://www.bibletechnologies.net/2003/OSIS/namespace}div[@type='book']")
    if not books:
        books = root.findall(".//div[@type='book']")

    processed_books = 0

    for book_el in books:
        osis_id = book_el.get('osisID')
        # محاولة مطابقة osisID مع الـ book_id بتاعنا (زي Gen, Exo...)
        # بنحول لـ lowercase للمقارنة لضمان الدقة
        matched_id = next((sid for sid in standard_ids if sid.lower() == osis_id.lower()), osis_id)

        # تصحيح يدوي لبعض الحالات لو لزم الأمر
        if matched_id.lower() == 'ps': matched_id = 'PSA'

        print(f"Processing: {osis_id} -> {matched_id}")

        chapters_list = []

        # البحث عن الأصحاحات جوه الكتاب
        chapters = book_el.findall(".//{http://www.bibletechnologies.net/2003/OSIS/namespace}chapter")
        if not chapters:
            chapters = book_el.findall(".//chapter")

        for ch_el in chapters:
            verses_list = []

            # البحث عن الآيات جوه الأصحاح
            verses = ch_el.findall(".//{http://www.bibletechnologies.net/2003/OSIS/namespace}verse")
            if not verses:
                verses = ch_el.findall(".//verse")

            for v_el in verses:
                # استخراج النص فقط وتجاهل الـ tags الداخلية زي <note>
                verse_text = "".join(v_el.itertext()).strip()
                if verse_text:
                    verses_list.append(verse_text)

            if verses_list:
                chapters_list.append(verses_list)

        if chapters_list:
            final_output.append({
                "abbrev": matched_id,
                "chapters": chapters_list
            })
            processed_books += 1

    # 3. حفظ النتيجة
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Success! {processed_books} books converted into: {output_path}")

if __name__ == "__main__":
    convert_luther()
