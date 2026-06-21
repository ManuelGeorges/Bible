const fs = require('fs');
const path = require('path');

const webSourceDir = path.join(__dirname, '../public/data/bibles/world-english-bible-master/world-english-bible-master/json');
const outputFilePath = path.join(__dirname, '../public/data/bibles/en_web.json');

// ترتيب الكتب والاختصارات بنفس فورمات KJV
const bookMapping = [
    { file: 'genesis.json', abbrev: 'Gen' }, { file: 'exodus.json', abbrev: 'Exo' },
    { file: 'leviticus.json', abbrev: 'Lev' }, { file: 'numbers.json', abbrev: 'Num' },
    { file: 'deuteronomy.json', abbrev: 'Deu' }, { file: 'joshua.json', abbrev: 'Jos' },
    { file: 'judges.json', abbrev: 'Jdg' }, { file: 'ruth.json', abbrev: 'Rut' },
    { file: '1samuel.json', abbrev: '1Sa' }, { file: '2samuel.json', abbrev: '2Sa' },
    { file: '1kings.json', abbrev: '1Ki' }, { file: '2kings.json', abbrev: '2Ki' },
    { file: '1chronicles.json', abbrev: '1Ch' }, { file: '2chronicles.json', abbrev: '2Ch' },
    { file: 'ezra.json', abbrev: 'Ezr' }, { file: 'nehemiah.json', abbrev: 'Neh' },
    { file: 'esther.json', abbrev: 'Est' }, { file: 'job.json', abbrev: 'Job' },
    { file: 'psalms.json', abbrev: 'Psa' }, { file: 'proverbs.json', abbrev: 'Pro' },
    { file: 'ecclesiastes.json', abbrev: 'Ecc' }, { file: 'songofsolomon.json', abbrev: 'Sng' },
    { file: 'isaiah.json', abbrev: 'Isa' }, { file: 'jeremiah.json', abbrev: 'Jer' },
    { file: 'lamentations.json', abbrev: 'Lam' }, { file: 'ezekiel.json', abbrev: 'Eze' },
    { file: 'daniel.json', abbrev: 'Dan' }, { file: 'hosea.json', abbrev: 'Hos' },
    { file: 'joel.json', abbrev: 'Joe' }, { file: 'amos.json', abbrev: 'Amo' },
    { file: 'obadiah.json', abbrev: 'Oba' }, { file: 'jonah.json', abbrev: 'Jon' },
    { file: 'micah.json', abbrev: 'Mic' }, { file: 'nahum.json', abbrev: 'Nam' },
    { file: 'habakkuk.json', abbrev: 'Hab' }, { file: 'zephaniah.json', abbrev: 'Zep' },
    { file: 'haggai.json', abbrev: 'Hag' }, { file: 'zechariah.json', abbrev: 'Zec' },
    { file: 'malachi.json', abbrev: 'Mal' }, { file: 'matthew.json', abbrev: 'Mat' },
    { file: 'mark.json', abbrev: 'Mrk' }, { file: 'luke.json', abbrev: 'Luk' },
    { file: 'john.json', abbrev: 'Jhn' }, { file: 'acts.json', abbrev: 'Act' },
    { file: 'romans.json', abbrev: 'Rom' }, { file: '1corinthians.json', abbrev: '1Co' },
    { file: '2corinthians.json', abbrev: '2Co' }, { file: 'galatians.json', abbrev: 'Gal' },
    { file: 'ephesians.json', abbrev: 'Eph' }, { file: 'philippians.json', abbrev: 'Php' },
    { file: 'colossians.json', abbrev: 'Col' }, { file: '1thessalonians.json', abbrev: '1Th' },
    { file: '2thessalonians.json', abbrev: '2Th' }, { file: '1timothy.json', abbrev: '1Ti' },
    { file: '2timothy.json', abbrev: '2Ti' }, { file: 'titus.json', abbrev: 'Tit' },
    { file: 'philemon.json', abbrev: 'Phm' }, { file: 'hebrews.json', abbrev: 'Heb' },
    { file: 'james.json', abbrev: 'Jas' }, { file: '1peter.json', abbrev: '1Pe' },
    { file: '2peter.json', abbrev: '2Pe' }, { file: '1john.json', abbrev: '1Jn' },
    { file: '2john.json', abbrev: '2Jn' }, { file: '3john.json', abbrev: '3Jn' },
    { file: 'jude.json', abbrev: 'Jud' }, { file: 'revelation.json', abbrev: 'Rev' }
];

const fullBible = [];

bookMapping.forEach(bookInfo => {
    const filePath = path.join(webSourceDir, bookInfo.file);
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: Missing file ${bookInfo.file}`);
        return;
    }

    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const bookData = {
        abbrev: bookInfo.abbrev,
        chapters: []
    };

    const chaptersMap = {};

    rawData.forEach(item => {
        if (item.chapterNumber && item.verseNumber && item.value) {
            const ch = item.chapterNumber;
            const vs = item.verseNumber;

            if (!chaptersMap[ch]) chaptersMap[ch] = {};
            if (!chaptersMap[ch][vs]) chaptersMap[ch][vs] = "";

            // دمج النصوص للآيات التي تظهر في أكثر من عنصر
            chaptersMap[ch][vs] += item.value.trim() + " ";
        }
    });

    // تحويل الـ Map إلى المصفوفة النهائية مرتبة
    const sortedChapters = Object.keys(chaptersMap).sort((a, b) => parseInt(a) - parseInt(b));
    sortedChapters.forEach(chNum => {
        const versesMap = chaptersMap[chNum];
        const sortedVerses = Object.keys(versesMap).sort((a, b) => parseInt(a) - parseInt(b));
        const chapterArray = sortedVerses.map(vsNum => versesMap[vsNum].trim());
        bookData.chapters.push(chapterArray);
    });

    fullBible.push(bookData);
    console.log(`✓ Processed: ${bookInfo.abbrev}`);
});

fs.writeFileSync(outputFilePath, JSON.stringify(fullBible, null, 2));
console.log(`\nSuccess! Created: ${outputFilePath}`);
