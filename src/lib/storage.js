import { Preferences } from '@capacitor/preferences';

const KEYS = {
    NOTES: 'agios_notes',
    POINTS: 'agios_points',
    STREAK: 'agios_streak',
    FAVORITES: 'agios_favorites',
    COMPLETED_PLANS: 'agios_completed_plans',
    COMPLETED_CHAPTERS: 'agios_completed_chapters',
    LAST_READ: 'agios_last_read',
    READING_HISTORY: 'agios_reading_history',
    LAST_ACTIVE: 'agios_last_active',
    SHOWN_BADGES: 'agios_shown_badges',
    POINTS_HISTORY: 'points_history',
    ANSWERED_QUESTIONS: 'agios_answered_questions',
    LOCAL_BADGES: 'agios_local_badges',
    CUSTOM_PLANS: 'agios_custom_plans',
    VISITED_MAP_POINTS: 'agios_visited_map_points',
    COMPLETED_QUIZZES: 'agios_completed_quizzes',
    SHARED_PLANS_CACHE: 'agios_shared_plans_cache',
    LAST_SHARED_PLANS_FETCH: 'agios_last_shared_plans_fetch'
};

export const StorageService = {
    async save(key, data) {
        try {
            await Preferences.set({
                key,
                value: JSON.stringify(data)
            });
        } catch (e) {
            console.error("Storage save error:", e);
        }
    },

    async get(key) {
        if (!key) return null;
        try {
            const { value } = await Preferences.get({ key });
            if (value === null || value === undefined) return null;

            // محاولة التحويل من JSON
            try {
                return JSON.parse(value);
            } catch (jsonError) {
                // إذا لم يكن JSON (ربما نص عادي)، نرجعه كما هو
                return value;
            }
        } catch (e) {
            // في حال حدوث ClassCastException في أندرويد (مثل حالتنا)
            // نقوم بمسح المفتاح التالف لمنع الكراش المتكرر
            console.warn(`Storage error for key ${key}, removing it...`, e);
            try {
                await Preferences.remove({ key });
            } catch (removeError) {}
            return null;
        }
    },

    async addNote(note) {
        const notes = (await this.get(KEYS.NOTES)) || [];
        const newNote = {
            ...note,
            id: Date.now().toString(),
            synced: false,
            createdAt: new Date().toISOString()
        };
        notes.push(newNote);
        await this.save(KEYS.NOTES, notes);
        return newNote;
    },

    async addPoints(amount) {
        const currentPoints = (await this.get(KEYS.POINTS)) || 0;
        const newPoints = (Number(currentPoints) || 0) + amount;
        await this.save(KEYS.POINTS, newPoints);
        return newPoints;
    },

    async toggleFavorite(verseKey, verseData) {
        let favorites = (await this.get(KEYS.FAVORITES)) || {};
        if (favorites[verseKey]) {
            delete favorites[verseKey];
        } else {
            favorites[verseKey] = { ...verseData, synced: false };
        }
        await this.save(KEYS.FAVORITES, favorites);
        return favorites;
    },

    async updateStreak(streak) {
        await this.save(KEYS.STREAK, streak);
    },

    async addToReadingHistory(readingData) {
        try {
            const history = (await this.get(KEYS.READING_HISTORY)) || [];

            // إضافة القراءة الجديدة في بداية المصفوفة
            const newEntry = {
                ...readingData,
                id: Date.now().toString(),
                timestamp: readingData.timestamp || new Date().toISOString()
            };

            // تجنب التكرار المتتالي لنفس الفصل
            if (history.length > 0) {
                const lastEntry = history[0];
                if (lastEntry.bookIndex === newEntry.bookIndex && lastEntry.chapterIndex === newEntry.chapterIndex) {
                    // تحديث الوقت فقط إذا كان نفس الفصل
                    history[0].timestamp = newEntry.timestamp;
                } else {
                    history.unshift(newEntry);
                }
            } else {
                history.unshift(newEntry);
            }

            // الاحتفاظ بآخر 100 قراءة مثلاً لعدم تضخم حجم الملف
            const limitedHistory = history.slice(0, 100);
            await this.save(KEYS.READING_HISTORY, limitedHistory);
            return limitedHistory;
        } catch (e) {
            console.error("Error adding to reading history:", e);
        }
    },

    async getLocalStats() {
        return {
            points: (await this.get(KEYS.POINTS)) || 0,
            streak: (await this.get(KEYS.STREAK)) || 0,
            notes: (await this.get(KEYS.NOTES)) || [],
            favorites: (await this.get(KEYS.FAVORITES)) || {},
            readingHistory: (await this.get(KEYS.READING_HISTORY)) || [],
        };
    }
};

export { KEYS };
