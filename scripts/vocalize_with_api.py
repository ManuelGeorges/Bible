import json
import os
import urllib.request
import urllib.parse
import time
import sys

def vocalize_api(text):
    if not text.strip():
        return text
    try:
        # استخدام API مشكال العام
        url = f"https://misqal.pythonanywhere.com/vocalize?text={urllib.parse.quote(text)}"
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.read().decode('utf-8')
    except Exception:
        return text

def main():
    # المسارات
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd.json')
    output_path = os.path.join(base_dir, 'public', 'data', 'bibles', 'ar_svd_tashkeel.json')

    if not os.path.exists(input_path):
        print(f"Error: File not found at {input_path}")
        return

    print("--- البدء في تشكيل الكتاب المقدس عبر الـ API ---")

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_books = len(data)

    for b_idx, book in enumerate(data):
        print(f"\n[{b_idx+1}/{total_books}] جاري تشكيل: {book.get('abbrev', b_idx)}")

        for c_idx, chapter in enumerate(book['chapters']):
            for v_idx, verse in enumerate(chapter):
                # إرسال الآية للتشكيل
                vocalized = vocalize_api(verse)
                data[b_idx]['chapters'][c_idx][v_idx] = vocalized

                # طباعة التقدم
                sys.stdout.write(f"\r   - الأصحاح {c_idx+1} | الآية {v_idx+1}/{len(chapter)}")
                sys.stdout.flush()

                # تأخير بسيط لتجنب حظر الـ API
                time.sleep(0.1)

            # حفظ دوري بعد كل أصحاح لضمان عدم ضياع الجهد
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n\n✅ تم الانتهاء بنجاح! الملف موجود في: public/data/bibles/ar_svd_tashkeel.json")

if __name__ == "__main__":
    main()
