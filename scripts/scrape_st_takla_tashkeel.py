import requests
from bs4 import BeautifulSoup
import json
import os
import time
import re
import random

# الإعدادات المحدثة: جعل التتمات تطلب نفس رقم الأصحاح (بدون طرح offset)
BOOK_CONFIG = {
    "et": {"st_id": 19, "extra": {"st_id": 20, "start_ch": 11, "offset": 0}}, # أستير (1-10) + التتمة (11-16)
    "dn": {"st_id": 34, "extra": {"st_id": 35, "start_ch": 13, "offset": 0}}, # دانيال (1-12) + التتمة (13-14)
    "ps": {"st_id": 22, "extra": {"st_id": 23, "start_ch": 151, "force_ch": 1}},
}

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
        # البحث عن النص المشكل
        verse_divs = bodytext.find_all('div', class_='HColor1Div')
        if not verse_divs:
             verse_divs = bodytext.find_all('strong')

        for item in verse_divs:
            text = item.get_text().strip()
            # تنظيف رقم الآية (أحياناً يكون بصيغة "1. النص" أو "1 النص")
            text = re.sub(r'^\d+[\s\.]+', '', text)
            if text and not text.isdigit() and len(text) > 2:
                verses.append(text)
        return verses
    except:
        return None

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd.json')
    output_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd_tashkeel_site.json')

    with open(input_path, 'r', encoding='utf-8-sig') as f:
        bible_data = json.load(f)

    if os.path.exists(output_path):
        with open(output_path, 'r', encoding='utf-8') as f:
            result_data = json.load(f)
    else:
        result_data = bible_data

    for b_idx, book in enumerate(bible_data):
        abbrev = book['abbrev'].lower()

        if abbrev != 'et': # التركيز على أستير حالياً كما طلبت
            continue

        print(f"\n>>> Re-Scraping Vocalized Esther: {abbrev.upper()}")

        new_chapters = []
        for c_idx, chapter in enumerate(book['chapters']):
            chapter_num = c_idx + 1
            config = BOOK_CONFIG[abbrev]
            st_book_id = config['st_id']
            fetch_ch_num = chapter_num

            if 'extra' in config and chapter_num >= config['extra']['start_ch']:
                st_book_id = config['extra']['st_id']
                offset = config['extra'].get('offset', 0)
                fetch_ch_num = config['extra'].get('force_ch', chapter_num - offset)

            scraped = scrape_chapter(st_book_id, fetch_ch_num)

            if scraped and len(scraped) >= len(chapter) * 0.7: # تأكد أننا سحبنا معظم الآيات
                print(f"  [OK] Chapter {chapter_num} (ID:{st_book_id} Ch:{fetch_ch_num}) - {len(scraped)} Verses")
                new_chapters.append(scraped)
            else:
                print(f"  [Error/Fallback] Chapter {chapter_num} (URL ID:{st_book_id} Ch:{fetch_ch_num}) - Using original")
                new_chapters.append(chapter)

            time.sleep(random.uniform(2.0, 4.0))

        result_data[b_idx]['chapters'] = new_chapters

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Finished updating Esther with proper Tashkeel and Chapter mapping!")

if __name__ == "__main__":
    main()
