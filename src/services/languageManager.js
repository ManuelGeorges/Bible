import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const R2_URL = 'https://translations.agiosbible.com';
const MANIFEST_URL = `${R2_URL}/manifest.json`;

const DB_NAME = 'agios-translations';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const METADATA_KEY = 'translation_metadata';

let manifestCache = null;

const isNative = () => Capacitor.isNativePlatform();

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: 'key'
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function idbGet(key) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function idbSet(value) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function idbDelete(key) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function getMetadata() {
    try {
        const result = await Preferences.get({
            key: METADATA_KEY
        });

        if (!result.value) {
            return {};
        }

        return JSON.parse(result.value);
    } catch {
        return {};
    }
}

async function saveMetadata(metadata) {
    await Preferences.set({
        key: METADATA_KEY,
        value: JSON.stringify(metadata)
    });
}

async function setFileMetadata(key, version) {
    const metadata = await getMetadata();

    metadata[key] = {
        version,
        updatedAt: Date.now()
    };

    await saveMetadata(metadata);
}

async function removeFileMetadata(key) {
    const metadata = await getMetadata();

    delete metadata[key];

    await saveMetadata(metadata);
}

async function getFileMetadata(key) {
    const metadata = await getMetadata();

    return metadata[key] || null;
}

async function getNativeFile(path) {
    try {
        const file = await Filesystem.readFile({
            path,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });

        return JSON.parse(file.data);
    } catch {
        return null;
    }
}

async function saveNativeFile(path, data) {
    const folder = path.substring(0, path.lastIndexOf('/'));

    await Filesystem.mkdir({
        path: folder,
        directory: Directory.Data,
        recursive: true
    }).catch(() => {});

    await Filesystem.writeFile({
        path,
        directory: Directory.Data,
        data: JSON.stringify(data),
        encoding: Encoding.UTF8
    });
}

async function deleteNativeFile(path) {
    try {
        await Filesystem.deleteFile({
            path,
            directory: Directory.Data
        });
    } catch {}
}

export const languageManager = {
    async init() {
        try {
            const response = await fetch(
                `${MANIFEST_URL}?t=${Date.now()}`,
                {
                    cache: 'no-store'
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Manifest request failed: ${response.status}`
                );
            }

            manifestCache = await response.json();

            return true;
        } catch (error) {
            console.error(
                '[LanguageManager] Manifest error:',
                error
            );

            return false;
        }
    },

    async getManifest(forceRefresh = false) {
        if (manifestCache && !forceRefresh) {
            return manifestCache;
        }

        await this.init();

        return manifestCache;
    },

    async refreshManifest() {
        const previous = manifestCache;

        manifestCache = null;

        const success = await this.init();

        if (!success) {
            manifestCache = previous;
        }

        return manifestCache;
    },

    async hasLocalCopy(langFolder, fileName) {
        const key = `${langFolder}/${fileName}`;

        if (isNative()) {
            const path =
                `translations/${langFolder}/${fileName}`;

            const data = await getNativeFile(path);

            return data !== null;
        }

        const cached = await idbGet(key);

        return cached !== null;
    },

    async getLocalCopy(langFolder, fileName) {
        const key = `${langFolder}/${fileName}`;

        if (isNative()) {
            const path =
                `translations/${langFolder}/${fileName}`;

            return await getNativeFile(path);
        }

        const cached = await idbGet(key);

        return cached ? cached.data : null;
    },

    async getFile(langFolder, fileName) {
        const manifest = await this.getManifest();

        if (!manifest) {
            const fallback = await this.getLocalCopy(
                langFolder,
                fileName
            );

            if (fallback !== null) {
                return fallback;
            }

            throw new Error(
                'Manifest unavailable and no local copy found'
            );
        }

        const language = manifest.languages?.[langFolder];

        if (!language) {
            const fallback = await this.getLocalCopy(
                langFolder,
                fileName
            );

            if (fallback !== null) {
                return fallback;
            }

            throw new Error(
                `Language "${langFolder}" not found`
            );
        }

        const manifestFile = language.files?.[fileName];

        if (!manifestFile) {
            const fallback = await this.getLocalCopy(
                langFolder,
                fileName
            );

            if (fallback !== null) {
                return fallback;
            }

            throw new Error(
                `File "${fileName}" not found in "${langFolder}"`
            );
        }

        const version = manifestFile.version || language.version || 1;

        const key = `${langFolder}/${fileName}`;

        const metadata = await getFileMetadata(key);

        if (isNative()) {
            const localPath =
                `translations/${langFolder}/${fileName}`;

            const localData =
                await getNativeFile(localPath);

            if (
                localData !== null &&
                metadata?.version === version
            ) {
                return localData;
            }

            return await this.downloadAndSave(
                langFolder,
                fileName,
                manifestFile,
                version
            );
        }

        const cached = await idbGet(key);

        if (
            cached &&
            metadata?.version === version
        ) {
            return cached.data;
        }

        return await this.downloadAndSave(
            langFolder,
            fileName,
            manifestFile,
            version
        );
    },

    async isUpToDate(langFolder, fileName) {
        const manifest = await this.getManifest(true);

        const language = manifest?.languages?.[langFolder];
        const manifestFile = language?.files?.[fileName];

        if (!manifestFile) {
            return true;
        }

        const version = manifestFile.version || language.version || 1;

        const key = `${langFolder}/${fileName}`;

        const metadata = await getFileMetadata(key);

        return metadata?.version === version;
    },

    async downloadAndSave(
        langFolder,
        fileName,
        manifestFile,
        version
    ) {
        const key = `${langFolder}/${fileName}`;

        const url =
            `${R2_URL}/${manifestFile.path}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Failed to download ${url}: ${response.status}`
            );
        }

        const data = await response.json();

        if (isNative()) {
            const path =
                `translations/${langFolder}/${fileName}`;

            await saveNativeFile(path, data);
        } else {
            await idbSet({
                key,
                language: langFolder,
                fileName,
                data,
                cachedAt: Date.now()
            });
        }

        await setFileMetadata(
            key,
            version
        );

        return data;
    },

    async clearCache(langFolder) {
        const manifest = await this.getManifest();

        const language =
            manifest?.languages?.[langFolder];

        if (!language) {
            return;
        }

        for (const fileName of Object.keys(
            language.files || {}
        )) {
            const key =
                `${langFolder}/${fileName}`;

            if (isNative()) {
                const path =
                    `translations/${langFolder}/${fileName}`;

                await deleteNativeFile(path);
            } else {
                await idbDelete(key);
            }

            await removeFileMetadata(key);
        }

        if (isNative()) {
            try {
                await Filesystem.rmdir({
                    path: `translations/${langFolder}`,
                    directory: Directory.Data,
                    recursive: true
                });
            } catch {}
        }
    },

    async isFileDownloaded(
        langFolder,
        fileName
    ) {
        const manifest =
            await this.getManifest();

        const manifestFile =
            manifest?.languages?.[
                langFolder
            ]?.files?.[fileName];

        if (!manifestFile) {
            return false;
        }

        const version =
            manifestFile.version || 1;

        const key =
            `${langFolder}/${fileName}`;

        const metadata =
            await getFileMetadata(key);

        if (
            !metadata ||
            metadata.version !== version
        ) {
            return false;
        }

        if (isNative()) {
            const data =
                await getNativeFile(
                    `translations/${langFolder}/${fileName}`
                );

            return data !== null;
        }

        const cached =
            await idbGet(key);

        return cached !== null;
    },

    async clearAllCache() {
        const manifest =
            await this.getManifest();

        for (const langFolder of Object.keys(
            manifest?.languages || {}
        )) {
            await this.clearCache(
                langFolder
            );
        }
    }
};