"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { toast } from 'react-hot-toast'; // FIX #7: replace alert() with toast for consistency
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
    // FIX #13: downloadProgress now holds a real 0-100 percentage per locKey, driven by XHR progress events
    const [downloadProgress, setDownloadProgress] = useState({});

    const [isRepeat, setIsRepeat] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isHighlightEnabled, setIsHighlightEnabled] = useState(true);
    const [sleepTimer, setSleepTimer] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);

    const [currentLocation, setCurrentLocation] = useState({ bookIdx: -1, chapIdx: -1 });
    const [bibleData, setBibleData] = useState(null);
    // FIX #2/#28: navigationCallback now has a real contract - see registerNavigationCallback below.
    const [navigationCallback, setNavigationCallbackState] = useState(null);

    const audioRef = useRef(null);
    const lastUrlRef = useRef(null);
    const timestampsRef = useRef([]);
    const fetchingRef = useRef(null);
    const currentLocationRef = useRef({ bookIdx: -1, chapIdx: -1 });
    const downloadingRef = useRef({}); // FIX #29: prevents duplicate concurrent downloads per chapter
    const dataLoadTokenRef = useRef(0); // FIX #15: stale-response guard for bible data load

    useEffect(() => {
        currentLocationRef.current = currentLocation;
    }, [currentLocation]);

    useEffect(() => {
        const loadDownloads = async () => {
            try {
                const { value } = await Preferences.get({ key: 'downloaded_audio' });
                if (value) setDownloadedChapters(JSON.parse(value));
            } catch (e) {
                console.error('Failed to load downloaded chapters list', e);
            }
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
                    if (e.name !== 'AbortError') {
                        console.error("Playback error", e);
                        toast.error(strings?.audio?.playback_error || 'Could not play audio.'); // FIX #6: surface playback failures
                    }
                });
            }
        }
        if (shouldOpenPanel) setIsPanelOpen(true);
    }, [processTimestamps, strings]);

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
            toast.error(strings?.audio?.fetch_error || 'Could not load audio for this chapter.'); // FIX #6
            return null;
        } finally {
            if (fetchingRef.current === locKey) fetchingRef.current = null;
            setIsAudioLoading(false);
        }
    }, [bookNames, strings, language, downloadedChapters]);

    // FIX #14: guard against re-downloading a chapter that's already saved locally
    // FIX #29: guard against duplicate concurrent downloads of the same chapter (debounce)
    // FIX #13: real progress via XHR instead of a fake 0 -> deleted flash
    // FIX #7/#8: use toast + localized strings instead of alert() + hardcoded Arabic
    const downloadChapter = useCallback(async (bookIdx, chapIdx) => {
        if (!Capacitor.isNativePlatform()) {
            toast.error(strings?.audio?.download_native_only || 'Downloads are only available in the mobile app.');
            return;
        }

        const book = bookNames[bookIdx];
        if (!book) return;
        const chapter = chapIdx + 1;
        const locKey = `${book.book_id}-${chapter}`;

        if (downloadedChapters[locKey]) {
            toast(strings?.audio?.already_downloaded || 'This chapter is already downloaded.');
            return;
        }
        if (downloadingRef.current[locKey]) return; // already in progress, ignore duplicate tap
        downloadingRef.current[locKey] = true;

        try {
            const data = await fetchAudioData(bookIdx, chapIdx);
            if (!data || data.url.startsWith('file://')) {
                downloadingRef.current[locKey] = false;
                return;
            }

            setDownloadProgress(prev => ({ ...prev, [locKey]: 0 }));
            await Filesystem.mkdir({ path: 'audio', directory: Directory.Data, recursive: true }).catch(() => {});

            const base64Data = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', data.url, true);
                xhr.responseType = 'blob';
                xhr.onprogress = (evt) => {
                    if (evt.lengthComputable) {
                        const pct = Math.round((evt.loaded / evt.total) * 100);
                        setDownloadProgress(prev => ({ ...prev, [locKey]: pct }));
                    }
                };
                xhr.onload = () => {
                    if (xhr.status < 200 || xhr.status >= 300) {
                        reject(new Error(`Download failed with status ${xhr.status}`));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(xhr.response);
                };
                xhr.onerror = () => reject(new Error('Network error during download'));
                xhr.send();
            });

            await Filesystem.writeFile({
                path: `audio/${locKey}.mp3`,
                data: base64Data,
                directory: Directory.Data
            });

            const newDownloads = { ...downloadedChapters, [locKey]: true };
            setDownloadedChapters(newDownloads);
            await Preferences.set({ key: 'downloaded_audio', value: JSON.stringify(newDownloads) });
            await Preferences.set({ key: `times_${locKey}`, value: JSON.stringify(data.times) });

            toast.success(strings?.audio?.download_success || 'Download complete.');
        } catch (e) {
            console.error("Download Error:", e);
            toast.error(strings?.audio?.download_failed || 'Download failed. Please try again.');
        } finally {
            setDownloadProgress(prev => {
                const next = { ...prev };
                delete next[locKey];
                return next;
            });
            downloadingRef.current[locKey] = false;
        }
    }, [bookNames, downloadedChapters, fetchAudioData, strings]);

    const deleteDownload = useCallback(async (bookIdx, chapIdx) => {
        const book = bookNames[bookIdx];
        if (!book) return;
        const locKey = `${book.book_id}-${chapIdx + 1}`;
        try {
            await Filesystem.deleteFile({ path: `audio/${locKey}.mp3`, directory: Directory.Data });
            const newDownloads = { ...downloadedChapters };
            delete newDownloads[locKey];
            setDownloadedChapters(newDownloads);
            await Preferences.set({ key: 'downloaded_audio', value: JSON.stringify(newDownloads) });
            toast.success(strings?.audio?.delete_success || 'Download removed.'); // FIX #6: feedback on delete too
        } catch (e) {
            console.error(e);
            toast.error(strings?.audio?.delete_failed || 'Could not remove download.');
        }
    }, [bookNames, downloadedChapters, strings]);

    // FIX #2/#3/#28: navigationCallback now has a real, documented contract.
    // A consumer (BibleContent) registers a function: (direction) => { bookIdx, chapIdx } | null
    // That function is the SINGLE source of truth for "what is the next/previous chapter",
    // including cross-book wrap-around, and it is responsible for updating its own displayed
    // chapter state as a side effect. goToChapter then just fetches + plays audio for whatever
    // location the callback resolved to, so the visible chapter and the playing chapter can never
    // drift apart (this fixes both the audio-vs-screen desync and the manual-paging-vs-audio
    // cross-book inconsistency in one place).
    const registerNavigationCallback = useCallback((fn) => {
        setNavigationCallbackState(() => fn);
    }, []);

    const goToChapter = useCallback(async (direction, forceOpen = false) => {
        let target = null;

        if (navigationCallback) {
            target = navigationCallback(direction);
        } else {
            // Fallback path (e.g. no reading screen mounted yet, or called from media session
            // controls before BibleContent has registered): fall back to internal bibleData lookup.
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
                } else {
                    return;
                }
            }
            target = { bookIdx: bIdx, chapIdx: cIdx };
        }

        if (!target) return;

        const data = await fetchAudioData(target.bookIdx, target.chapIdx);
        if (data) playTrack(data.url, data.title, data.times, target.bookIdx, target.chapIdx, forceOpen);
    }, [navigationCallback, bibleData, bookNames, fetchAudioData, playTrack]);

    useEffect(() => {
        const loadInitialData = async () => {
            const myToken = ++dataLoadTokenRef.current; // FIX #15: stale-response guard
            try {
                const folder = FOLDER_MAP[language] || 'arabic';
                const fileName = BIBLE_FILE_MAP[language] || BIBLE_FILE_MAP.ar;

                const data = await languageManager.getFile(folder, fileName);

                if (myToken !== dataLoadTokenRef.current) return; // a newer load has since started; discard this one

                if (!data) {
                    throw new Error(`Failed to load ${fileName}`);
                }

                setBibleData(data);
            } catch (e) {
                console.error("AudioContext Data Load Error:", e);
                if (myToken === dataLoadTokenRef.current && strings) setBibleData(strings);
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
        else audioRef.current.play().catch(() => {
            toast.error(strings?.audio?.playback_error || 'Could not play audio.'); // FIX #6
        });
    }, [isPlaying, strings]);

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
        setIsRepeat, setIsAutoPlay, setVolume, setIsHighlightEnabled, setSleepTimer,
        // FIX #2/#28: expose the new, documented registration function. Keep the old name as an
        // alias so any other existing caller of setNavigationCallback keeps working.
        setNavigationCallback: registerNavigationCallback,
        registerNavigationCallback,
        goToChapter
    }), [
        audioUrl, isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle, currentVerseId,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft, currentLocation, bookNames, isAutoNext, isAudioLoading,
        downloadedChapters, downloadProgress,
        playTrack, togglePlay, goToChapter, processTimestamps, fetchAudioData, downloadChapter, deleteDownload,
        registerNavigationCallback
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