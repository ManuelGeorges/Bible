import { Preferences } from '@capacitor/preferences';

const KEYS = {
    NOTES: 'agios_notes',
    POINTS: 'agios_points',
    STREAK: 'agios_streak',
    FAVORITES: 'agios_favorites',
    COMPLETED_PLANS: 'agios_completed_plans', // For study plans progress
    COMPLETED_CHAPTERS: 'agios_completed_chapters', // For bible chapters
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
        const { value } = await Preferences.get({ key });
        try {
            return value ? JSON.parse(value) : null;
        } catch (e) {
            return value;
        }
    },

    // Notes
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

    // Points
    async addPoints(amount) {
        const currentPoints = (await this.get(KEYS.POINTS)) || 0;
        const newPoints = currentPoints + amount;
        await this.save(KEYS.POINTS, newPoints);
        return newPoints;
    },

    // Favorites
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

    // Streak
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
