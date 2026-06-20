"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from './LanguageContext'; // استيراد سياق اللغة

const AudioContext = createContext();

export function AudioProvider({ children }) {
    const { strings, language } = useLanguage(); // الحصول على النصوص واللغة الحالية

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

    // Settings
    const [isRepeat, setIsRepeat] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isHighlightEnabled, setIsHighlightEnabled] = useState(true);
    const [sleepTimer, setSleepTimer] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);

    // Navigation & Data
    const [currentLocation, setCurrentLocation] = useState({ bookIdx: -1, chapIdx: -1 });
    const [bookNames, setBookNames] = useState([]);
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
                if (vIdRaw === undefined && ts.verse_start !== undefined) {
                    const vsNum = Number(ts.verse_start);
                    if (Number.isInteger(vsNum) && vsNum < 300) vIdRaw = ts.verse_start;
                }

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
        setAudioUrl(url);
        setTrackTitle(title);

        const processed = processTimestamps(chapterTimestamps);
        timestampsRef.current = processed;
        setTimestamps(processed);

        setCurrentLocation({ bookIdx, chapIdx });
        setCurrentVerseId(-1);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = url;
            audioRef.current.load();
            audioRef.current.play().catch(e => {
                if (e.name !== 'AbortError') console.error("Playback error", e);
            });
        }
        if (shouldOpenPanel) setIsPanelOpen(true);
    }, [processTimestamps]);

    const fetchAudioData = useCallback(async (bookIdx, chapIdx) => {
        const book = bookNames[bookIdx];
        if (!book || !book.book_id) return null;

        const chapter = chapIdx + 1;
        const locKey = `${book.book_id}-${chapter}`;

        if (fetchingRef.current === locKey) return null;
        fetchingRef.current = locKey;

        setIsAudioLoading(true);
        const key = '5e4b1535-5f2b-4f13-9032-9db0297664a6';
        const audioFilesetId = book.type === 'new' ? 'ARZVDVN1DA' : 'ARZVDVO1DA';
        const urlReq = `https://4.dbt.io/api/bibles/filesets/${audioFilesetId}/${book.book_id}/${chapter}?v=4&key=${key}`;

        try {
            const audioRes = await fetch(urlReq);
            if (!audioRes.ok) throw new Error("Audio not found");
            const audioData = await audioRes.json();
            const url = audioData.data?.[0]?.path;
            if (!url) throw new Error("URL not found");

            const timingCandidates = book.type === 'new'
                ? ['ARZVDVN1DA', 'ARZSMVN1DA', 'ARZALMN1DA']
                : ['ARZVDVO1DA', 'ARZSMVO1DA', 'ARZALMO1DA', 'ARZSMO1DA'];

            let times = [];
            for (const tId of timingCandidates) {
                try {
                    const timeReq = `https://4.dbt.io/api/timestamps/${tId}/${book.book_id}/${chapter}?v=4&key=${key}`;
                    const timeRes = await fetch(timeReq, { priority: 'low' });
                    if (timeRes.ok) {
                        const tData = await timeRes.json();
                        const fetchedTimes = tData.data || (Array.isArray(tData) ? tData : []);
                        if (fetchedTimes.length > 0) {
                            times = fetchedTimes;
                            break;
                        }
                    }
                } catch (e) {}
            }

            // استخدام أرقام عربية أو إنجليزية بناءً على اللغة
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
    }, [bookNames, strings, language]);

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
                const [namesRes, bibleRes] = await Promise.all([
                    fetch('/data/bookNames.json').then(r => r.json()),
                    fetch('/data/bibles/ar_svd.json').then(r => r.json())
                ]);
                setBookNames(namesRes.ar || []);
                setBibleData(bibleRes);
            } catch (e) { console.error(e); }
        };
        loadInitialData();
    }, []);

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

            const iconUrl = "https://agios-bible.vercel.app/agios.png";
            navigator.mediaSession.metadata = new MediaMetadata({
                title: trackTitle || `${strings.common.chapter} ${chapter}`,
                artist: book ? book.name : strings.audio.artist_default,
                album: strings.audio.album,
                artwork: [
                    { src: iconUrl, sizes: '192x192', type: 'image/png' },
                    { src: iconUrl.replace('192', '512'), sizes: '512x512', type: 'image/png' },
                ]
            });

            const handlers = {
                play: () => audioRef.current?.play(),
                pause: () => audioRef.current?.pause(),
                previoustrack: () => goToChapter(-1),
                nexttrack: () => goToChapter(1),
                seekbackward: (details) => {
                    const skipTime = details.seekOffset || 10;
                    if (audioRef.current) audioRef.current.currentTime -= skipTime;
                },
                seekforward: (details) => {
                    const skipTime = details.seekOffset || 10;
                    if (audioRef.current) audioRef.current.currentTime += skipTime;
                },
                seekto: (details) => {
                    if (details.seekTime !== undefined && audioRef.current) {
                        audioRef.current.currentTime = details.seekTime;
                    }
                }
            };

            Object.entries(handlers).forEach(([action, handler]) => {
                try {
                    navigator.mediaSession.setActionHandler(action, handler);
                } catch (e) {}
            });
        }
    }, [audioUrl, trackTitle, currentLocation, bookNames, goToChapter, strings]);

    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            if (isPlaying) {
                KeepAwake.keepAwake().catch(() => {});
            } else {
                KeepAwake.allowSleep().catch(() => {});
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

            if ('setPositionState' in navigator.mediaSession && audioRef.current && isFinite(duration)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: duration > 0 ? duration : 0,
                        playbackRate: playbackSpeed || 1,
                        position: currentTime || 0,
                    });
                } catch (e) {}
            }
        }
    }, [isPlaying, currentTime, duration, playbackSpeed]);

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
        setIsPanelOpen, playTrack, togglePlay, seek: (t) => { if(audioRef.current) audioRef.current.currentTime = t; },
        skip: (amt) => { if(audioRef.current) audioRef.current.currentTime += amt; },
        setPlaybackSpeed,
        setTimestamps: (t) => {
            const p = processTimestamps(t);
            timestampsRef.current = p;
            setTimestamps(p);
        },
        fetchAudioData,
        setIsRepeat, setIsAutoPlay, setVolume, setIsHighlightEnabled, setSleepTimer, setNavigationCallback, goToChapter
    }), [
        audioUrl, isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle, currentVerseId,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft, currentLocation, bookNames, isAutoNext, isAudioLoading,
        playTrack, togglePlay, goToChapter, processTimestamps, fetchAudioData
    ]);

    return (
        <AudioContext.Provider value={contextValue}>
            {children}
            <audio
                ref={audioRef}
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
