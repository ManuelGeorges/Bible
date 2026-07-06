import xml.etree.ElementTree as ET
import json
import os

# Mapping based on the Leningrad Codex XML sequence to your app's book_id
BOOK_MAPPING = {
    "1": "Gen", "2": "Exo", "3": "LEV", "4": "NUM", "5": "DEU",
    "6": "JOS", "7": "JDG", "8": "1SA", "9": "2SA", "10": "1KI",
    "11": "2KI", "12": "ISA", "13": "JER", "14": "EZK", "15": "HOS",
    "16": "JOL", "17": "AMO", "18": "OBA", "19": "JON", "20": "MIC",
    "21": "NAM", "22": "HAB", "23": "ZEP", "24": "HAG", "25": "ZEC",
    "26": "MAL", "27": "PSA", "28": "PRO", "29": "JOB", "30": "SNG",
    "31": "RUT", "32": "LAM", "33": "ECC", "34": "EST", "35": "DAN",
    "36": "EZR", "37": "NEH", "38": "1CH", "39": "2CH"
}

def convert_hebrew_xml_to_json(xml_path, output_path):
    if not os.path.exists(xml_path):
        print(f"Error: {xml_path} not found.")
        return

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        bible_json = []

        for book in root.findall('.//book'):
            book_num = book.get('number')
            abbrev = BOOK_MAPPING.get(book_num)
            if not abbrev: continue

            chapters_data = []
            for chapter in book.findall('chapter'):
                verses_data = [v.text.strip() if v.text else "" for v in chapter.findall('verse')]
                chapters_data.append(verses_data)

            bible_json.append({
                "abbrev": abbrev,
                "chapters": chapters_data
            })

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(bible_json, f, ensure_ascii=False, indent=2)

        print(f"Success! Saved to: {output_path}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    convert_hebrew_xml_to_json("public/data/translations/HebrewLeningradCodexBible.xml",
                               "public/data/translations/Hebrew/he.json")
