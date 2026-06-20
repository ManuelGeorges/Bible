import tafsirData from './interpretations.json';
import styles from './interpretations.module.css';
import ChapterCard from './chapterCard';
import strings from '../data/ar.json';

const firstBook = tafsirData && Array.isArray(tafsirData) && tafsirData.length > 0 ? tafsirData[0] : null;

export function generateMetadata() {
  const title = firstBook ? `${strings.interpretations.title_prefix} ${firstBook.book}` : strings.interpretations.default_title;
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
                    <h1 className={styles.bookTitle}>{strings.interpretations.no_data}</h1>
                </main>
            </div>
        );
    }

    const book = data[0]; 
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.bookTitle}>{strings.interpretations.title_prefix} {book.book}</h1>
                <p className={styles.bookSubtitle}>{strings.interpretations.subtitle}</p>
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