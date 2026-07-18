"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause, X, RotateCcw, RotateCw, SkipBack, SkipForward,
    Settings, Repeat, ListEnd, Volume2, Highlighter, Clock,
    Download, Trash2, Loader2, CheckCircle
} from 'lucide-react';
import { useAudio } from '../app/context/AudioContext';
import styles from './GlobalAudioPlayer.module.css';
import { useLanguage } from '../app/context/LanguageContext';
import { Capacitor } from '@capacitor/core';

export default function GlobalAudioPlayer() {
    const { strings, dir } = useLanguage();
    const {
        isPlaying, currentTime, duration, playbackSpeed, isPanelOpen, trackTitle,
        isRepeat, isAutoPlay, volume, isHighlightEnabled, sleepTimer,
        currentLocation, downloadedChapters, downloadProgress,
        setIsPanelOpen, togglePlay, seek, skip, setPlaybackSpeed, goToChapter,
        setIsRepeat, setIsAutoPlay, setVolume, setIsHighlightEnabled, setSleepTimer,
        downloadChapter, deleteDownload
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
    const iconStyle = dir === 'rtl' ? { transform: 'scaleX(-1)' } : {};

    // معرف الفصل الحالي للتحقق من حالة التحميل
    const locKey = `${currentLocation.bookIdx >= 0 ? currentLocation.bookIdx : ''}-${currentLocation.chapIdx + 1}`;
    const isDownloaded = downloadedChapters[locKey];
    const isDownloading = downloadProgress[locKey] !== undefined;

    const handleDownloadClick = () => {
        if (isDownloaded) {
            if (window.confirm(strings.common.confirm_delete || "هل تريد حذف هذا الملف؟")) {
                deleteDownload(currentLocation.bookIdx, currentLocation.chapIdx);
            }
        } else {
            downloadChapter(currentLocation.bookIdx, currentLocation.chapIdx);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className={styles.audioPanel}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                dir={dir}
            >
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            className={styles.settingsMenu}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className={styles.settingsHeader}>
                                <span>{strings.components.audio_player.settings}</span>
                                <button className={styles.iconBtn} onClick={() => setShowSettings(false)}>
                                    <X size={18}/>
                                </button>
                            </div>

                            <div className={styles.settingItem}>
                                <div className={styles.settingLabel}><Volume2 size={16}/> {strings.components.audio_player.volume}</div>
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
                                    <Repeat size={18}/> <span>{strings.components.audio_player.repeat}</span>
                                </button>
                                <button
                                    className={`${styles.settingBtn} ${isAutoPlay ? styles.activeSetting : ''}`}
                                    onClick={() => setIsAutoPlay(!isAutoPlay)}
                                >
                                    <ListEnd size={18}/> <span>{strings.components.audio_player.auto_play}</span>
                                </button>
                                <button
                                    className={`${styles.settingBtn} ${isHighlightEnabled ? styles.activeSetting : ''}`}
                                    onClick={() => setIsHighlightEnabled(!isHighlightEnabled)}
                                >
                                    <Highlighter size={18}/> <span>{strings.components.audio_player.highlight}</span>
                                </button>
                            </div>

                            <div className={styles.sleepTimerSection}>
                                <div className={styles.timerChips}>
                                    {[null, 15, 30, 60].map(m => (
                                        <button
                                            key={m}
                                            className={`${styles.timerChip} ${sleepTimer === m ? styles.activeChip : ''}`}
                                            onClick={() => setSleepTimer(m)}
                                        >
                                            {m ? `${m}${strings.common.day[0]}` : strings.components.audio_player.stop}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={styles.audioPanelHeader}>
                    <div className={styles.titleContainer}>
                        <span className={styles.audioPanelTitle}>{trackTitle}</span>
                        {isDownloaded && <CheckCircle size={14} color="#10b981" title="Offline" />}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* زر التحميل متاح فقط على تطبيقات الموبايل */}
                        {Capacitor.isNativePlatform() && (
                            <button
                                className={`${styles.iconBtn} ${isDownloaded ? styles.downloaded : ''}`}
                                onClick={handleDownloadClick}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <Loader2 size={18} className={styles.spinning} />
                                ) : isDownloaded ? (
                                    <Trash2 size={18} color="#ef4444" />
                                ) : (
                                    <Download size={18} />
                                )}
                            </button>
                        )}
                        <button className={styles.iconBtn} onClick={() => setShowSettings(true)}>
                            <Settings size={18} />
                        </button>
                        <button className={styles.iconBtn} onClick={() => setIsPanelOpen(false)}>
                            <X size={18}/>
                        </button>
                    </div>
                </div>

                <div className={styles.progressBarContainer}>
                    <input
                        type="range" min="0" max={duration || 0} step="0.1"
                        value={currentTime} onChange={(e) => seek(parseFloat(e.target.value))}
                        className={styles.progressBar}
                        style={{ background: `linear-gradient(to ${dir === 'rtl' ? 'left' : 'right'}, var(--color-accent) ${progressPercent}%, var(--color-border) ${progressPercent}%)` }}
                    />
                    <div className={styles.timeDisplay}>
                        <span className={styles.elapsedTime}>{formatTime(currentTime)}</span>
                        <span className={styles.totalTime}>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className={styles.audioMainControls}>
                    <button className={styles.panelBtn} onClick={() => goToChapter(-1)}>
                        <SkipBack size={24} style={iconStyle} />
                    </button>

                    <button className={styles.panelBtn} onClick={() => skip(-10)}>
                        <RotateCcw size={24} style={iconStyle} />
                    </button>

                    <button className={styles.playPauseCircle} onClick={togglePlay}>
                        {isPlaying ? <Pause size={30} fill="white"/> : <Play size={30} fill="white" style={{ [dir === 'rtl' ? 'marginRight' : 'marginLeft']: '3px' }}/>}
                    </button>

                    <button className={styles.panelBtn} onClick={() => skip(10)}>
                        <RotateCw size={24} style={iconStyle} />
                    </button>

                    <button className={styles.panelBtn} onClick={() => goToChapter(1)}>
                        <SkipForward size={24} style={iconStyle} />
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
