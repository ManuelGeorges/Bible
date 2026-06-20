import requests
from bs4 import BeautifulSoup
import json
import os
import time
import re
import random

# إعدادات الربط للـ 73 سفر مع دمج التتمات
BOOK_CONFIG = {
    "gn": {"st_id": 1}, "ex": {"st_id": 2}, "lv": {"st_id": 3}, "nm": {"st_id": 4}, "dt": {"st_id": 5},
    "js": {"st_id": 6}, "jud": {"st_id": 7}, "rt": {"st_id": 8}, "1sm": {"st_id": 9}, "2sm": {"st_id": 10},
    "1kgs": {"st_id": 11}, "2kgs": {"st_id": 12}, "1ch": {"st_id": 13}, "2ch": {"st_id": 14},
    "ezr": {"st_id": 15}, "ne": {"st_id": 16}, "tob": {"st_id": 17}, "jdt": {"st_id": 18},
    "et": {"st_id": 19, "extra": {"st_id": 20, "start_ch": 11}}, # أستير + التتمة
    "job": {"st_id": 21},
    "ps": {"st_id": 22, "extra": {"st_id": 23, "start_ch": 151, "force_ch": 1}}, # المزامير + مزمور 151
    "prv": {"st_id": 24}, "ec": {"st_id": 25}, "so": {"st_id": 26}, # نشيد الأنشاد
    "wis": {"st_id": 27}, "sir": {"st_id": 28},
    "is": {"st_id": 29}, "jr": {"st_id": 30}, "lm": {"st_id": 31}, "bar": {"st_id": 32}, "ez": {"st_id": 33},
    "dn": {"st_id": 34, "extra": {"st_id": 35, "start_ch": 13}}, # دانيال + التتمة
    "ho": {"st_id": 36}, "jl": {"st_id": 37}, "am": {"st_id": 38}, "ob": {"st_id": 39}, "jn": {"st_id": 40},
    "mi": {"st_id": 41}, "na": {"st_id": 42}, "hk": {"st_id": 43}, "zp": {"st_id": 44}, "hg": {"st_id": 45},
    "zc": {"st_id": 46}, "ml": {"st_id": 47}, "1ma": {"st_id": 48}, "2ma": {"st_id": 49},
    "mt": {"st_id": 50}, "mk": {"st_id": 51}, "lk": {"st_id": 52}, "jo": {"st_id": 53}, "act": {"st_id": 54},
    "rm": {"st_id": 55}, "1co": {"st_id": 56}, "2co": {"st_id": 57}, "gl": {"st_id": 58}, "eph": {"st_id": 59},
    "ph": {"st_id": 60}, "cl": {"st_id": 61}, "1ts": {"st_id": 62}, "2ts": {"st_id": 63}, "1tm": {"st_id": 64},
    "2tm": {"st_id": 65}, "tt": {"st_id": 66}, "phm": {"st_id": 67}, "hb": {"st_id": 68}, "jm": {"st_id": 69},
    "1pe": {"st_id": 70}, "2pe": {"st_id": 71}, "1jo": {"st_id": 72}, "2jo": {"st_id": 73}, "3jo": {"st_id": 74},
    "jd": {"st_id": 75}, "re": {"st_id": 76}
}

def strip_tashkeel(text):
    """إزالة التشكيل من النص العربي"""
    # يشمل الفتحة، الضمة، الكسرة، السكون، التنوين، والشدة
    tashkeel_pattern = re.compile(r'[\u064B-\u0652]')
    return tashkeel_pattern.sub('', text)

def scrape_chapter(st_id, chapter_id):
    url = f"https://st-takla.org/Bibles/BibleSearch/showChapter.php?book={st_id}&chapter={chapter_id}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    try:
        response = requests.get(url, headers=headers, timeout=20)
        response.encoding = 'utf-8'
        if response.status_code != 200: return None
        soup = BeautifulSoup(response.text, 'html.parser')
        bodytext = soup.find('div', id='bodytext')
        if not bodytext: return None

        verses = []
        # البحث عن العناصر التي تحتوي على النص (div المشكل أو strong)
        targets = bodytext.find_all(['div', 'strong'], class_=lambda x: x != 'HColor2Div')

        for item in targets:
            if item.name == 'div' and 'HColor1Div' not in item.get('class', []):
                continue

            text = item.get_text().strip()
            # تنظيف رقم الآية
            text = re.sub(r'^\d+[\s\.]+', '', text)

            if text and not text.isdigit() and len(text) > 3:
                # إزالة التشكيل
                clean_text = strip_tashkeel(text)
                verses.append(clean_text)

        # إزالة التكرارات الناتجة عن تداخل العناصر
        unique_verses = []
        for v in verses:
            if v not in unique_verses:
                unique_verses.append(v)
        return unique_verses
    except:
        return None

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd.json')
    output_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd_no_tashkeel.json')

    with open(input_path, 'r', encoding='utf-8-sig') as f:
        bible_data = json.load(f)

    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            result_data = json.load(f)
    else:
        result_data = []

    for b_idx, book in enumerate(bible_data):
        abbrev = book['abbrev'].lower()
        config = BOOK_CONFIG.get(abbrev)
        if not config:
            if b_idx >= len(result_data): result_data.append(book)
            continue

        # استكمال السحب إذا كان الملف موجوداً
        if b_idx < len(result_data) and len(result_data[b_idx]['chapters']) == len(book['chapters']):
            print(f"Skipping {abbrev.upper()} (Completed)")
            continue

        print(f"\n>>> Scraping Full Bible (No Tashkeel): {abbrev.upper()}")

        if b_idx < len(result_data):
            new_chapters = result_data[b_idx]['chapters']
        else:
            new_chapters = []
            result_data.append({"abbrev": abbrev, "chapters": new_chapters, "name": book.get('name', '')})

        for c_idx in range(len(new_chapters), len(book['chapters'])):
            chapter_num = c_idx + 1
            st_book_id = config['st_id']
            fetch_ch_num = chapter_num

            # منطق دمج التتمات
            if 'extra' in config and chapter_num >= config['extra']['start_ch']:
                st_book_id = config['extra']['st_id']
                fetch_ch_num = config['extra'].get('force_ch', chapter_num)

            scraped = scrape_chapter(st_book_id, fetch_ch_num)

            if scraped:
                print(f"  [OK] {abbrev} {chapter_num}")
                new_chapters.append(scraped)
            else:
                print(f"  [Fallback] {abbrev} {chapter_num} (From Original)")
                fallback = [strip_tashkeel(v) for v in book['chapters'][c_idx]]
                new_chapters.append(fallback)

            # حفظ لحظي
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, ensure_ascii=False, indent=2)

            time.sleep(random.uniform(1.0, 2.0))

    print(f"\n✅ Success! Plain Bible saved to: ar_svd_no_tashkeel.json")

if __name__ == "__main__":
    main()
