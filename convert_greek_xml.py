import xml.etree.ElementTree as ET
import json
import os

def convert_bible_xml_to_json(xml_path, output_path):
    # خريطة تحويل أرقام الكتب (SBLGNT) إلى الاختصارات القياسية في تطبيقك
    book_mapping = {
        "40": "MAT", "41": "MRK", "42": "LUK", "43": "JHN",
        "44": "ACT", "45": "ROM", "46": "1CO", "47": "2CO",
        "48": "GAL", "49": "EPH", "50": "PHP", "51": "COL",
        "52": "1TH", "53": "2TH", "54": "1TI", "55": "2TI",
        "56": "TIT", "57": "PHM", "58": "HEB", "59": "JAS",
        "60": "1PE", "61": "2PE", "62": "1JN", "63": "2JN",
        "64": "3JN", "65": "JUD", "66": "REV"
    }

    if not os.path.exists(xml_path):
        print(f"Error: {xml_path} not found.")
        return

    tree = ET.parse(xml_path)
    root = tree.getroot()
    bible_json = []

    # معالجة الكتب
    for book in root.findall('.//book'):
        book_num = book.get('number')
        abbrev = book_mapping.get(book_num)

        if not abbrev: continue

        chapters_data = []
        # معالجة الفصول
        for chapter in book.findall('chapter'):
            verses_data = []
            # معالجة الآيات
            for verse in chapter.findall('verse'):
                text = verse.text.strip() if verse.text else ""
                verses_data.append(text)
            chapters_data.append(verses_data)

        bible_json.append({
            "abbrev": abbrev,
            "chapters": chapters_data
        })

    # حفظ الملف النهائي
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(bible_json, f, ensure_ascii=False, indent=2)

    print(f"Done! Saved to: {output_path}")

if __name__ == "__main__":
    xml_file = "public/data/translations/GreekSBLGNTBible.xml"
    json_file = "public/data/translations/gr.json"
    convert_bible_xml_to_json(xml_file, json_file)