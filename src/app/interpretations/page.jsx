
import tafsirData from './interpretations.json'; 
import styles from './interpretations.module.css';
import ChapterCard from './ChapterCard';

const firstBook = tafsirData && Array.isArray(tafsirData) && tafsirData.length > 0 ? tafsirData[0] : null;

export function generateMetadata() {
  const title = firstBook ? `تفسير سفر ${firstBook.book}` : 'تفسير الكتاب المقدس';
  return {
    title: title,
  };
}

export default function InterpretationsPage() {
    const data = tafsirData; 

    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className={styles.container}>
                <main className={styles.main}>
                    <h1 className={styles.bookTitle}>لم يتم العثور على بيانات التفسير</h1>
                </main>
            </div>
        );
    }

    const book = data[0]; 
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.bookTitle}>تفسير سفر {book.book}</h1>
                <p className={styles.bookSubtitle}>تحليل وشرح إصحاحات السفر</p>
            </header>
            <main className={styles.main}>
                {book.chapters.map((chap) => (
                    (chap.interpretation && chap.interpretation.trim() !== '') ? (
                        <ChapterCard
                            key={chap.chapter}
                            chapter={chap.chapter}
                            interpretation={chap.interpretation}
                        />
                    ) : null
                ))}
            </main>
        </div>
    );
}