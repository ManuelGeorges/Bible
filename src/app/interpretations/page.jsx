'use client';

import tafsirData from './interpretations.json';
import styles from './interpretations.module.css';
import ChapterCard from './chapterCard';
import { useLanguage } from '../context/LanguageContext';

export default function InterpretationsPage() {
    const { strings } = useLanguage();
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