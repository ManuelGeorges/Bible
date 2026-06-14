import json
import os
import sys

try:
    from mishkal.tashkeel import Tashkeel
    print("[+] مبروك! محرك مشكال شغال تمام.")
except ImportError:
    print("[-] لسه المكتبة مش مقروءة.")
    sys.exit()

vocalizer = Tashkeel()
input_file = 'public/data/bibles/ar_svd.json'
output_file = 'public/data/bibles/ar_svd_tashkeel.json'

# قراءة الملف (تأكد إن النسخة دي سليمة ومش الـ HTML)
with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("بدء التشكيل... (لو شفت أسماء أسفار يبقى إحنا ماشيين صح)")

for book in data:
    print(f"جاري تشكيل سفر: {book['abbrev']}")
    for c_idx, chapter in enumerate(book['chapters']):
        for v_idx, verse in enumerate(chapter):
            # لو النص فيه كود HTML (بيبدأ بـ <) نرجعه لأصله أو نسيبه
            if verse.strip().startswith('<'):
                 continue
            book['chapters'][c_idx][v_idx] = vocalizer.tashkeel(verse)

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("✅ خلصنا!")
