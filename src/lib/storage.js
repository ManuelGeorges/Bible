import { Preferences } from '@capacitor/preferences';

const KEYS = {
    NOTES: 'agios_notes',
    POINTS: 'agios_points',
    STREAK: 'agios_streak',
    FAVORITES: 'agios_favorites',
    COMPLETED_PLANS: 'agios_completed_plans',
    COMPLETED_CHAPTERS: 'agios_completed_chapters',
    LAST_READ: 'agios_last_read',
    LAST_ACTIVE: 'agios_last_active',
    SHOWN_BADGES: 'agios_shown_badges',
    POINTS_HISTORY: 'agios_points_history',
    ANSWERED_QUESTIONS: 'agios_answered_questions',
    LOCAL_BADGES: 'agios_local_badges',
    CUSTOM_PLANS: 'agios_custom_plans',
    VISITED_MAP_POINTS: 'agios_visited_map_points',
    COMPLETED_QUIZZES: 'agios_completed_quizzes'
};

export const StorageService = {
    async save(key, data) {
        await Preferences.set({
            key,
            value: JSON.stringify(data)
        });
    },

    async get(key) {
        if (!key) return null;
        try {
            const { value } = await Preferences.get({ key });
            if (value === null || value === undefined) return null;
            return JSON.parse(value);
        } catch (e) {
            await Preferences.remove({ key });
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
        const newPoints = currentPoints + amount;
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

    async getLocalStats() {
        return {
            points: (await this.get(KEYS.POINTS)) || 0,
            streak: (await this.get(KEYS.STREAK)) || 0,
            notes: (await this.get(KEYS.NOTES)) || [],
            favorites: (await this.get(KEYS.FAVORITES)) || {},
        };
    }
};

export { KEYS };
