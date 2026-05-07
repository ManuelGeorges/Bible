"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';

const AudioContext = createContext();

export function AudioProvider({ children }) {
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
    const sleepTimerRef = useRef(null);

    // Load book names and bible data once
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [namesRes, bibleRes] = await Promise.all([
                    fetch('/data/bookNames.json').then(r => r.json()),
                    fetch('/data/bibles/ar_svd.json').then(r => r.json())
                ]);
                setBookNames(namesRes.ar || []);
                setBibleData(bibleRes);
            } catch (e) {
                console.error("Failed to load initial data in context", e);
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if ('mediaSession' in navigator && audioUrl) {
            navigator.mediaSession.metadata = new window.MediaMetadata({
                title: trackTitle,
                artist: 'عادل نصحي',
                album: 'الكتاب المقدس',
                artwork: [{ src: '/agios.png', sizes: '512x512', type: 'image/png' }]
            });
            navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
            navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
            navigator.mediaSession.setActionHandler('seekbackward', () => skip(-10));
            navigator.mediaSession.setActionHandler('seekforward', () => skip(10));
            navigator.mediaSession.setActionHandler('previoustrack', () => goToChapter(-1));
            navigator.mediaSession.setActionHandler('nexttrack', () => goToChapter(1));
        }
    }, [audioUrl, trackTitle]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.volume = volume;
        }
    }, [playbackSpeed, volume]);

    useEffect(() => {
        if (sleepTimer) {
            setTimeLeft(sleepTimer * 60);
            if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
            sleepTimerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev !== null && prev <= 1) {
                        audioRef.current?.pause();
                        setSleepTimer(null);
                        return 0;
                    }
                    return prev !== null ? prev - 1 : null;
                });
            }, 1000);
        } else {
            if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
            setTimeLeft(null);
        }
        return () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); };
    }, [sleepTimer]);

    const playTrack = useCallback((url, title, chapterTimestamps = [], bookIdx, chapIdx) => {
        setIsAutoNext(false);
        if (audioUrl !== url) {
            setAudioUrl(url);
            setTrackTitle(title);
            setTimestamps(chapterTimestamps);
            setCurrentLocation({ bookIdx, chapIdx });
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.load();
                audioRef.current.play().catch(e => console.log("Play failed", e));
            }
        }
        setIsPanelOpen(true);
    }, [audioUrl]);

    const fetchAudioData = useCallback(async (bookIdx, chapIdx) => {
        const book = bookNames[bookIdx];
        if (!book || !book.book_id) return null;

        const chapter = chapIdx + 1;
        const audioFilesetId = book.type === 'new' ? 'ARZVDVN1DA' : 'ARZVDVO1DA';
        const timingFilesetId = book.type === 'new' ? 'ARZVDVN1DA' : 'ARZVDVO1DA';
        const key = '5e4b1535-5f2b-4f13-9032-9db0297664a6';

        const audioUrlRequest = `https://4.dbt.io/api/bibles/filesets/${audioFilesetId}/${book.book_id}/${chapter}?v=4&key=${key}`;
        const timestampUrl = `https://4.dbt.io/api/timestamps/${timingFilesetId}/${book.book_id}/${chapter}?v=4&key=${key}`;

        try {
            const [audioRes, timeRes] = await Promise.allSettled([
                fetch(audioUrlRequest),
                fetch(timestampUrl)
            ]);

            let url = null;
            let times = [];

            if (audioRes.status === 'fulfilled' && audioRes.value.ok) {
                const audioData = await audioRes.value.json();
                url = audioData.data?.[0]?.path;
            }

            if (timeRes.status === 'fulfilled' && timeRes.value.ok) {
                const timeData = await timeRes.value.json();
                times = timeData.data || (Array.isArray(timeData) ? timeData : []);
            }

            if (url) {
                const arabicChapter = chapter.toLocaleString('ar-EG');
                const title = `عادل نصحي - ${book.name} ${arabicChapter}`;
                return { url, title, times };
            }
        } catch (error) {
            console.error("Global fetch error", error);
        }
        return null;
    }, [bookNames]);

    const goToChapter = useCallback(async (direction) => {
        // 1. Try to navigate within the current page if a callback is registered
        if (navigationCallback) {
            const handled = navigationCallback(direction);
            if (handled) return;
        }

        // 2. Global navigation if outside Bible page or callback couldn't handle it
        if (currentLocation.bookIdx === -1 || !bibleData) return;

        let bIdx = currentLocation.bookIdx;
        let cIdx = currentLocation.chapIdx + direction;

        const currentBookChapters = bibleData[bIdx]?.chapters || [];

        if (cIdx >= 0 && cIdx < currentBookChapters.length) {
            // Within same book
        } else if (direction > 0 && bIdx < bookNames.length - 1) {
            // Next book
            bIdx++;
            cIdx = 0;
        } else if (direction < 0 && bIdx > 0) {
            // Previous book
            bIdx--;
            const prevBookChapters = bibleData[bIdx]?.chapters || [];
            cIdx = Math.max(0, prevBookChapters.length - 1);
        } else {
            return; // Nowhere to go
        }

        const data = await fetchAudioData(bIdx, cIdx);
        if (data) {
            playTrack(data.url, data.title, data.times, bIdx, cIdx);
        }
    }, [navigationCallback, currentLocation, bibleData, bookNames, fetchAudioData, playTrack]);

    const togglePlay = useCallback(() => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play();
    }, [isPlaying]);

    const seek = useCallback((time) => {
        if (audioRef.current) audioRef.current.currentTime = time;
    }, []);

    const skip = useCallback((amount) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + amount));
        }
    }, []);

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const curTime = audioRef.current.currentTime;
        setCurrentTime(curTime);

        if (isHighlightEnabled && timestamps.length > 0) {
            const found = timestamps.find((ts, idx) => {
                const start = parseFloat(ts.timestamp ?? ts.verse_start ?? 0);
                let end = 999999;
                if (ts.verse_end) end = parseFloat(ts.verse_end);
                else if (idx < timestamps.length - 1) end = parseFloat(timestamps[idx+1].timestamp ?? timestamps[idx+1].verse_start ?? 0);
                return curTime >= start && curTime < end;
            });
            if (found) {
                const vNum = found.verse_id ?? found.verse ?? found.verse_start;
                const vId = String(vNum).match(/(\d+)$/)?.[1] || String(vNum);
                setCurrentVerseId(vId);
            }
        }
    };

    const handleEnded = () => {
        if (isRepeat) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        } else if (isAutoPlay) {
            setIsAutoNext(true);
            goToChapter(1);
        }
    };

    const contextValue = useMemo(() => ({
        audioUrl, isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle, currentVerseId,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft, currentLocation, bookNames, isAutoNext,
        setIsPanelOpen, playTrack, togglePlay, seek, skip, setPlaybackSpeed, setTimestamps, setCurrentVerseId,
        setIsRepeat, setIsAutoPlay, setVolume, setIsHighlightEnabled, setSleepTimer, setNavigationCallback, goToChapter
    }), [
        audioUrl, isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle, currentVerseId,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft, currentLocation, bookNames, isAutoNext,
        playTrack, togglePlay, seek, skip, goToChapter
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
