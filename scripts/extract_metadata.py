import json
import os

def extract_metadata():
    base_path = "F:/AlMalak system/Agios Bible/website/public/data/bibles"
    files = [
        "ar_svd_tashkeel_site.json",
        "en_kjv.json",
        "fr_apee.json",
        "de_schlachter.json"
    ]

    for filename in files:
        path = os.path.join(base_path, filename)
        if not os.path.exists(path):
            print(f"{filename} not found")
            continue
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            abbrevs = [book.get('abbrev') for book in data]
            print(f"{filename}: {abbrevs[:5]} ... (total {len(abbrevs)})")

if __name__ == "__main__":
    extract_metadata()
