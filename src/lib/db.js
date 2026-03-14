import { openDB } from 'idb';

const DB_NAME = 'agios_bible_db';
const DB_VERSION = 11;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('verses')) {
        db.createObjectStore('verses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('daily_data')) {
        db.createObjectStore('daily_data');
      }
    },
  });
};

export const saveToLocal = async (storeName, data) => {
  try {
    const db = await initDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    if (Array.isArray(data)) {
      for (const item of data) {
        if (storeName === 'verses') {
          await store.put(item);
        } else {
          const key = item.id || (item.month ? `${item.question ? 'q' : 'v'}-${item.month}-${item.day}` : null);
          if (key) await store.put(item, key);
        }
      }
    } else {
      const key = data.id || (data.month ? `${data.question ? 'q' : 'v'}-${data.month}-${data.day}` : null);
      if (storeName === 'verses') {
        await store.put(data);
      } else {
        await store.put(data, key);
      }
    }
    await tx.done;
  } catch (err) {
    console.error("IndexedDB Save Error:", err);
  }
};

export const getDailyVerseOffline = async (month, day) => {
  const db = await initDB();
  return await db.get('daily_data', `v-${month}-${day}`);
};

export const getDailyQuestionOffline = async (month, day) => {
  const db = await initDB();
  return await db.get('daily_data', `q-${month}-${day}`);
};