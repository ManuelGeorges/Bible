import json
import os

def check_consistency():
    base_path = "F:/AlMalak system/Agios Bible/website/public/data"
    book_names_path = os.path.join(base_path, "bookNames.json")

    with open(book_names_path, 'r', encoding='utf-8') as f:
        book_names = json.load(f)

    bibles = {
        "ar": "bibles/ar_svd_tashkeel_site.json",
        "en": "bibles/en_kjv.json",
        "fr": "bibles/fr_apee.json",
        "de": "bibles/de_schlachter.json"
    }

    for lang, bible_rel_path in bibles.items():
        print(f"\nChecking {lang} ({bible_rel_path})...")
        bible_path = os.path.join(base_path, bible_rel_path)

        if not os.path.exists(bible_path):
            print(f"File {bible_path} not found.")
            continue

        with open(bible_path, 'r', encoding='utf-8') as f:
            bible_data = json.load(f)

        bible_books = {book['abbrev'].lower(): len(book['chapters']) for book in bible_data}

        lang_books = book_names.get(lang, [])

        # Check if all books in bookNames.json exist in Bible file
        for book in lang_books:
            bid = book['book_id'].lower()
            if bid not in bible_books:
                print(f"  Missing in Bible file: {book['name']} (book_id: {book['book_id']})")
            else:
                bible_chapters = bible_books[bid]
                if bible_chapters != book['chapters']:
                    print(f"  Chapter mismatch for {book['name']} ({book['book_id']}): bookNames has {book['chapters']}, Bible has {bible_chapters}")
                del bible_books[bid]

        # Check if there are extra books in Bible file
        for bid, chapters in bible_books.items():
            print(f"  Extra in Bible file: {bid} with {chapters} chapters")

if __name__ == "__main__":
    check_consistency()
