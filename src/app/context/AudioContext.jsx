"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { useLanguage } from './LanguageContext';
import { languageManager } from '../../services/languageManager';

const AudioContext = createContext();

const FOLDER_MAP = {
    ar: 'arabic',
    en: 'English',
    de: 'german',
    fr: 'French'
};

const BIBLE_FILE_MAP = {
    ar: 'ar_svd_no_tashkeel.json',
    en: 'en_web.json',
    fr: 'fr_segond.json',
    de: 'de_luther.json'
};

export function AudioProvider({ children }) {
    const { strings, language, bookNames } = useLanguage();

    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [trackTitle, setTrackTitle] = useState("");
    const [currentVerseId, setCurrentVerseId] = useState(-1);
    const [timestamps, setTimestamps] = useState([]);
    const [isAutoNext, setIsAutoNext] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);

    const [downloadedChapters, setDownloadedChapters] = useState({});
    const [downloadProgress, setDownloadProgress] = useState({});

    const [isRepeat, setIsRepeat] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isHighlightEnabled, setIsHighlightEnabled] = useState(true);
    const [sleepTimer, setSleepTimer] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);

    const [currentLocation, setCurrentLocation] = useState({ bookIdx: -1, chapIdx: -1 });
    const [bibleData, setBibleData] = useState(null);
    const [navigationCallback, setNavigationCallback] = useState(null);

    const audioRef = useRef(null);
    const lastUrlRef = useRef(null);
    const timestampsRef = useRef([]);
    const fetchingRef = useRef(null);
    const currentLocationRef = useRef({ bookIdx: -1, chapIdx: -1 });

    useEffect(() => {
        currentLocationRef.current = currentLocation;
    }, [currentLocation]);

    useEffect(() => {
        const loadDownloads = async () => {
            const { value } = await Preferences.get({ key: 'downloaded_audio' });
            if (value) setDownloadedChapters(JSON.parse(value));
        };
        if (Capacitor.isNativePlatform()) loadDownloads();
    }, []);

    const parseTimeToSeconds = useCallback((val) => {
        if (val === undefined || val === null) return -1;
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (!s) return -1;

        if (s.includes(':')) {
            const parts = s.split(':').map(parseFloat);
            if (parts.some(isNaN)) return -1;
            if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            if (parts.length === 2) return (parts[0] * 60) + parts[1];
        }
        const num = parseFloat(s);
        return isNaN(num) ? -1 : num;
    }, []);

    const processTimestamps = useCallback((rawTimes) => {
        if (!rawTimes || !Array.isArray(rawTimes)) return [];

        return rawTimes
            .map((ts) => {
                let startTime = -1;
                if (ts.timestamp !== undefined) startTime = parseTimeToSeconds(ts.timestamp);
                else if (ts.verse_start_time !== undefined) startTime = parseTimeToSeconds(ts.verse_start_time);
                else if (ts.seconds !== undefined) startTime = parseTimeToSeconds(ts.seconds);
                else if (ts.verse_start !== undefined) startTime = parseTimeToSeconds(ts.verse_start);

                let vIdRaw = ts.verse_id ?? ts.verse ?? ts.verse_number;
                if (vIdRaw === undefined || vIdRaw === null) return null;

                let vId = "";
                const s = String(vIdRaw).trim();
                const parts = s.split('.');
                const lastPart = parts[parts.length - 1];

                if (/^\d{6,}$/.test(lastPart)) {
                    vId = String(parseInt(lastPart) % 1000);
                } else {
                    const m = lastPart.match(/\d+/);
                    vId = m ? m[0] : lastPart;
                }

                return { startTime, vId: String(parseInt(vId) || vId) };
            })
            .filter(ts => ts !== null && ts.startTime >= 0 && !isNaN(ts.startTime) && ts.vId !== "" && ts.vId !== "NaN")
            .sort((a, b) => a.startTime - b.startTime);
    }, [parseTimeToSeconds]);

    const playTrack = useCallback((url, title, chapterTimestamps = [], bookIdx, chapIdx, shouldOpenPanel = true) => {
        setIsAutoNext(false);

        const isSameUrl = lastUrlRef.current === url;
        const isSameLocation = currentLocationRef.current.bookIdx === bookIdx && currentLocationRef.current.chapIdx === chapIdx;

        if (isSameUrl && isSameLocation) {
            if (shouldOpenPanel) setIsPanelOpen(true);
            return;
        }

        lastUrlRef.current = url;
        const finalUrl = (url && url.startsWith('file://')) ? Capacitor.convertFileSrc(url) : url;

        setAudioUrl(finalUrl);
        setTrackTitle(title);

        const processed = processTimestamps(chapterTimestamps);
        timestampsRef.current = processed;
        setTimestamps(processed);

        setCurrentLocation({ bookIdx, chapIdx });
        setCurrentVerseId(-1);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = finalUrl;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    if (e.name !== 'AbortError') console.error("Playback error", e);
                });
            }
        }
        if (shouldOpenPanel) setIsPanelOpen(true);
    }, [processTimestamps]);

    const fetchAudioData = useCallback(async (bookIdx, chapIdx) => {
        if (language === 'de') return null;

        const book = bookNames[bookIdx];
        if (!book || !book.book_id) return null;

        const chapter = chapIdx + 1;
        const locKey = `${book.book_id}-${chapter}`;

        if (downloadedChapters[locKey]) {
            try {
                const fileResult = await Filesystem.getUri({
                    directory: Directory.Data,
                    path: `audio/${locKey}.mp3`
                });

                const { value: storedTimes } = await Preferences.get({ key: `times_${locKey}` });
                const times = storedTimes ? JSON.parse(storedTimes) : [];

                const displayChapter = language === 'ar' ? chapter.toLocaleString('ar-EG') : chapter;
                const title = strings.audio.track_title
                    .replace('{book}', book.name)
                    .replace('{chapter}', displayChapter);

                return { url: fileResult.uri, title, times };
            } catch (e) {
                console.error("Local file fetch error, falling back to network", e);
            }
        }

        if (fetchingRef.current === locKey) return null;
        fetchingRef.current = locKey;

        setIsAudioLoading(true);
        const key = '5e4b1535-5f2b-4f13-9032-9db0297664a6';

        const fcbhMappings = {
            'ar': { new: 'ARZVDVN1DA', old: 'ARZVDVO1DA', bible: 'ARZVDV' },
            'en': { new: 'EN1WEBN2DA', old: 'EN1WEBO2DA', bible: 'ENGWEB' },
            'fr': { new: 'FRNTLSN2DA', old: 'FRNTLSO2DA', bible: 'FRNTLS' }
        };

        let config = fcbhMappings[language] || {
            new: `${language.toUpperCase()}N1DA`,
            old: `${language.toUpperCase()}O1DA`,
            bible: null
        };

        let audioFilesetId = book.type === 'new' ? config.new : config.old;

        try {
            const primaryAudioPromise = fetch(`https://4.dbt.io/api/bibles/filesets/${audioFilesetId}/${book.book_id}/${chapter}?v=4&key=${key}`, { priority: 'high' })
                .then(r => r.ok ? r.json() : null);

            let timingCandidates = [audioFilesetId];
            if (language === 'ar') timingCandidates.push('ARZVDVN1DA', 'ARZVDVO1DA');
            else if (language === 'en') timingCandidates.push('EN1WEBN2DA', 'EN1WEBO2DA');
            else if (language === 'fr') timingCandidates.push('FRNTLSN2DA', 'FRNTLSO2DA');

            const timestampsPromise = Promise.all(timingCandidates.map(tId =>
                fetch(`https://4.dbt.io/api/timestamps/${tId}/${book.book_id}/${chapter}?v=4&key=${key}`, { priority: 'low' })
                .then(r => r.ok ? r.json() : null)
                .then(tData => tData?.data || (Array.isArray(tData) ? tData : []))
                .catch(() => [])
            )).then(allResults => allResults.find(t => t.length > 0) || []);

            const audioData = await primaryAudioPromise;
            let url = audioData?.data?.[0]?.path;

            if (!url) throw new Error("Audio URL not found");

            const times = await Promise.race([
                timestampsPromise,
                new Promise(resolve => setTimeout(() => resolve([]), 1500))
            ]);

            const displayChapter = language === 'ar' ? chapter.toLocaleString('ar-EG') : chapter;
            const title = strings.audio.track_title
                .replace('{book}', book.name)
                .replace('{chapter}', displayChapter);

            return { url, title, times };
        } catch (error) {
            console.error("Fetch audio error", error);
            return null;
        } finally {
            if (fetchingRef.current === locKey) fetchingRef.current = null;
            setIsAudioLoading(false);
        }
    }, [bookNames, strings, language, downloadedChapters]);

    const downloadChapter = async (bookIdx, chapIdx) => {
        if (!Capacitor.isNativePlatform()) {
            alert("التحميل متاح فقط على تطبيقات الموبايل");
            return;
        }

        const data = await fetchAudioData(bookIdx, chapIdx);
        if (!data || data.url.startsWith('file://')) return;

        const book = bookNames[bookIdx];
        const chapter = chapIdx + 1;
        const locKey = `${book.book_id}-${chapter}`;

        try {
            setDownloadProgress(prev => ({ ...prev, [locKey]: 0 }));
            await Filesystem.mkdir({ path: 'audio', directory: Directory.Data, recursive: true }).catch(() => {});

            const response = await fetch(data.url);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64Data = reader.result.split(',')[1];
                await Filesystem.writeFile({
                    path: `audio/${locKey}.mp3`,
                    data: base64Data,
                    directory: Directory.Data
                });

                const newDownloads = { ...downloadedChapters, [locKey]: true };
                setDownloadedChapters(newDownloads);
                await Preferences.set({ key: 'downloaded_audio', value: JSON.stringify(newDownloads) });
                await Preferences.set({ key: `times_${locKey}`, value: JSON.stringify(data.times) });

                setDownloadProgress(prev => {
                    const next = { ...prev };
                    delete next[locKey];
                    return next;
                });
                alert(strings.audio.download_success || "تم التحميل بنجاح");
            };
        } catch (e) {
            console.error("Download Error:", e);
            alert("فشل التحميل، يرجى المحاولة لاحقاً");
        }
    };

    const deleteDownload = async (bookIdx, chapIdx) => {
        const book = bookNames[bookIdx];
        const locKey = `${book.book_id}-${chapIdx + 1}`;
        try {
            await Filesystem.deleteFile({ path: `audio/${locKey}.mp3`, directory: Directory.Data });
            const newDownloads = { ...downloadedChapters };
            delete newDownloads[locKey];
            setDownloadedChapters(newDownloads);
            await Preferences.set({ key: 'downloaded_audio', value: JSON.stringify(newDownloads) });
        } catch (e) { console.error(e); }
    };

    const goToChapter = useCallback(async (direction, forceOpen = false) => {
        if (navigationCallback) {
            const handled = navigationCallback(direction);
            if (handled) return;
        }

        const { bookIdx, chapIdx } = currentLocationRef.current;
        if (bookIdx === -1 || !bibleData) return;

        let bIdx = bookIdx;
        let cIdx = chapIdx + direction;
        const currentBookChapters = bibleData[bIdx]?.chapters || [];

        if (cIdx < 0 || cIdx >= currentBookChapters.length) {
            if (direction > 0 && bIdx < bookNames.length - 1) {
                bIdx++; cIdx = 0;
            } else if (direction < 0 && bIdx > 0) {
                bIdx--;
                cIdx = (bibleData[bIdx]?.chapters?.length || 1) - 1;
            } else return;
        }

        const data = await fetchAudioData(bIdx, cIdx);
        if (data) playTrack(data.url, data.title, data.times, bIdx, cIdx, forceOpen);
    }, [navigationCallback, bibleData, bookNames, fetchAudioData, playTrack]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const folder = FOLDER_MAP[language] || 'arabic';
                const fileName = BIBLE_FILE_MAP[language] || BIBLE_FILE_MAP.ar;

                const data = await languageManager.getFile(folder, fileName);

                if (!data) {
                    throw new Error(`Failed to load ${fileName}`);
                }

                setBibleData(data);
            } catch (e) {
                console.error("AudioContext Data Load Error:", e);
                if (strings) setBibleData(strings);
            }
        };
        if (language) loadInitialData();
    }, [language, strings]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.volume = volume;
        }
    }, [playbackSpeed, volume]);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'mediaSession' in navigator && audioUrl) {
            const book = bookNames[currentLocation.bookIdx];
            const chapter = currentLocation.chapIdx + 1;
            const iconUrl = "https://agios-bible.vercel.app/images/agios.png";

            if ('MediaMetadata' in window) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: trackTitle || `${strings.common.chapter} ${chapter}`,
                    artist: book ? book.name : strings.audio.artist_default,
                    album: strings.audio.album,
                    artwork: [
                        { src: iconUrl, sizes: '192x192', type: 'image/png' },
                        { src: iconUrl, sizes: '512x512', type: 'image/png' },
                    ]
                });
            }

            const handlers = {
                play: () => audioRef.current?.play().catch(() => {}),
                pause: () => audioRef.current?.pause(),
                previoustrack: () => goToChapter(-1),
                nexttrack: () => goToChapter(1),
                seekbackward: (details) => {
                    const skipTime = details?.seekOffset || 10;
                    if (audioRef.current) audioRef.current.currentTime -= skipTime;
                },
                seekforward: (details) => {
                    const skipTime = details?.seekOffset || 10;
                    if (audioRef.current) audioRef.current.currentTime += skipTime;
                },
                seekto: (details) => {
                    if (details?.seekTime !== undefined && audioRef.current) {
                        audioRef.current.currentTime = details.seekTime;
                    }
                }
            };

            Object.entries(handlers).forEach(([action, handler]) => {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (e) {}
            });

            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }, [audioUrl, trackTitle, currentLocation, bookNames, goToChapter, strings, isPlaying]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play().catch(() => {});
    }, [isPlaying]);

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const curTime = audioRef.current.currentTime;
        setCurrentTime(curTime);

        const currentTimes = timestampsRef.current;
        if (isHighlightEnabled && currentTimes.length > 0) {
            let activeTs = null;
            for (let i = 0; i < currentTimes.length; i++) {
                if (curTime >= currentTimes[i].startTime) activeTs = currentTimes[i];
                else break;
            }
            if (activeTs && activeTs.vId !== String(currentVerseId)) {
                setCurrentVerseId(activeTs.vId);
            } else if (!activeTs && currentVerseId !== -1) {
                setCurrentVerseId(-1);
            }
        }
    };

    const handleEnded = () => {
        if (isRepeat) {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
            }
        } else if (isAutoPlay) {
            setIsAutoNext(true);
            goToChapter(1, false);
        }
    };

    const contextValue = useMemo(() => ({
        audioUrl, isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle, currentVerseId,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft, currentLocation, bookNames, isAutoNext, isAudioLoading,
        downloadedChapters, downloadProgress,
        setIsPanelOpen, playTrack, togglePlay, seek: (t) => { if(audioRef.current) audioRef.current.currentTime = t; },
        skip: (amt) => { if(audioRef.current) audioRef.current.currentTime += amt; },
        setPlaybackSpeed,
        setTimestamps: (t) => {
            const p = processTimestamps(t);
            timestampsRef.current = p;
            setTimestamps(p);
        },
        fetchAudioData,
        downloadChapter,
        deleteDownload,
        setIsRepeat, setIsAutoPlay, setVolume, setIsHighlightEnabled, setSleepTimer, setNavigationCallback, goToChapter
    }), [
        audioUrl, isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle, currentVerseId,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft, currentLocation, bookNames, isAutoNext, isAudioLoading,
        downloadedChapters, downloadProgress,
        playTrack, togglePlay, goToChapter, processTimestamps, fetchAudioData, downloadChapter, deleteDownload
    ]);

    return (
        <AudioContext.Provider value={contextValue}>
            {children}
            <audio
                ref={audioRef}
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleEnded}
            />
        </AudioContext.Provider>
    );
}

export const useAudio = () => useContext(AudioContext);