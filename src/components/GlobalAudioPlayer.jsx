"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause, X, RotateCcw, RotateCw, SkipBack, SkipForward,
    Settings, Repeat, ListEnd, Volume2, Highlighter, Clock
} from 'lucide-react';
import { useAudio } from '../app/context/AudioContext';
import styles from './GlobalAudioPlayer.module.css';

export default function GlobalAudioPlayer() {
    const {
        isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer, timeLeft,
        setIsPanelOpen, togglePlay, seek, skip, setPlaybackSpeed, goToChapter,
        setIsRepeat, setIsAutoPlay, setVolume, setIsHighlightEnabled, setSleepTimer
    } = useAudio();

    const [showSettings, setShowSettings] = useState(false);

    if (!isPanelOpen) return null;

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = (currentTime / duration) * 100 || 0;

    return (
        <AnimatePresence>
            <motion.div
                className={styles.audioPanel}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                dir="rtl"
            >
                {/* Settings Overlay */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            className={styles.settingsMenu}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                        >
                            <div className={styles.settingsHeader}>
                                <span>إعدادات التشغيل</span>
                                <button onClick={() => setShowSettings(false)}><X size={18}/></button>
                            </div>

                            <div className={styles.settingItem}>
                                <div className={styles.settingLabel}><Volume2 size={18}/> مستوى الصوت</div>
                                <input
                                    type="range" min="0" max="1" step="0.05"
                                    value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    className={styles.volumeSlider}
                                />
                            </div>

                            <div className={styles.settingsGrid}>
                                <button
                                    className={`${styles.settingBtn} ${isRepeat ? styles.activeSetting : ''}`}
                                    onClick={() => setIsRepeat(!isRepeat)}
                                >
                                    <Repeat size={18}/> {isRepeat ? 'التكرار مفعل' : 'تكرار'}
                                </button>
                                <button
                                    className={`${styles.settingBtn} ${isAutoPlay ? styles.activeSetting : ''}`}
                                    onClick={() => setIsAutoPlay(!isAutoPlay)}
                                >
                                    <ListEnd size={18}/> {isAutoPlay ? 'تلقائي مفعل' : 'تشغيل تلقائي'}
                                </button>
                                <button
                                    className={`${styles.settingBtn} ${isHighlightEnabled ? styles.activeSetting : ''}`}
                                    onClick={() => setIsHighlightEnabled(!isHighlightEnabled)}
                                >
                                    <Highlighter size={18}/> {isHighlightEnabled ? 'تلوين الآية' : 'بدون تلوين'}
                                </button>
                            </div>

                            <div className={styles.sleepTimerSection}>
                                <div className={styles.settingLabel}><Clock size={18}/> مؤقت النوم</div>
                                <div className={styles.timerChips}>
                                    {[null, 15, 30, 45, 60].map(m => (
                                        <button
                                            key={m}
                                            className={`${styles.timerChip} ${sleepTimer === m ? styles.activeChip : ''}`}
                                            onClick={() => setSleepTimer(m)}
                                        >
                                            {m ? `${m}د` : 'إيقاف'}
                                        </button>
                                    ))}
                                </div>
                                {timeLeft && <div className={styles.timeLeft}>سيتوقف خلال: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={styles.audioPanelHeader}>
                    <span className={styles.audioPanelTitle}>{trackTitle}</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className={styles.iconBtn} onClick={() => setShowSettings(!showSettings)}>
                            <Settings size={20} color={showSettings ? "var(--color-accent)" : "currentColor"}/>
                        </button>
                        <button className={styles.iconBtn} onClick={() => setIsPanelOpen(false)}>
                            <X size={20}/>
                        </button>
                    </div>
                </div>

                <div className={styles.progressBarContainer}>
                    <input
                        type="range" min="0" max={duration || 0} step="0.1"
                        value={currentTime} onChange={(e) => seek(parseFloat(e.target.value))}
                        className={styles.progressBar}
                        style={{ background: `linear-gradient(to left, var(--color-accent) ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%)` }}
                    />
                    <div className={styles.timeDisplay}>
                        <span className={styles.elapsedTime}>{formatTime(currentTime)}</span>
                        <span className={styles.totalTime}>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className={styles.audioMainControls}>
                    {/* السابق (جهة اليمين) - الأيقونة تشير لليمين (الماضي) */}
                    <button className={styles.panelBtn} onClick={() => goToChapter(-1)} title="الإصحاح السابق">
                        <SkipBack size={26} style={{ transform: 'scaleX(-1)' }} />
                    </button>

                    {/* تأخير ١٠ ثواني (جهة اليمين) - السهم يلف لليمين */}
                    <button className={styles.panelBtn} onClick={() => skip(-10)} title="رجوع ١٠ ثواني">
                        <RotateCcw size={26} style={{ transform: 'scaleX(-1)' }} />
                    </button>

                    <button className={styles.playPauseCircle} onClick={togglePlay}>
                        {isPlaying ? <Pause size={35} fill="white"/> : <Play size={35} fill="white" style={{ marginRight: '5px' }}/>}
                    </button>

                    {/* تقديم ١٠ ثواني (جهة اليسار) - السهم يلف لليسار */}
                    <button className={styles.panelBtn} onClick={() => skip(10)} title="تقديم ١٠ ثواني">
                        <RotateCw size={26} style={{ transform: 'scaleX(-1)' }} />
                    </button>

                    {/* القادم (جهة اليسار) - الأيقونة تشير لليسار (المستقبل) */}
                    <button className={styles.panelBtn} onClick={() => goToChapter(1)} title="الإصحاح التالي">
                        <SkipForward size={26} style={{ transform: 'scaleX(-1)' }} />
                    </button>
                </div>

                <div className={styles.speedSelector}>
                    {[1, 1.25, 1.5, 2].map(speed => (
                        <button
                            key={speed}
                            className={`${styles.speedChip} ${playbackSpeed === speed ? styles.speedChipActive : ''}`}
                            onClick={() => setPlaybackSpeed(speed)}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
