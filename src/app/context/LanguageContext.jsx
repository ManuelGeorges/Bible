"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback
} from 'react';

import { usePathname } from 'next/navigation';
import { Preferences } from '@capacitor/preferences';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { toast } from 'react-hot-toast';

import allBookNames from '../data/bookNames.json';
import { languageManager } from '../../services/languageManager';

const LanguageContext = createContext();

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

const SHARED_FILES = [
    { folder: 'shared', fileName: 'dailyVerses.json' }
];

const getAuxFiles = (lang) => {
    const folder = FOLDER_MAP[lang] || 'arabic';

    return [
        { folder, fileName: `dailyQuestions_${lang}.json` },
        { folder, fileName: BIBLE_FILE_MAP[lang] || BIBLE_FILE_MAP.ar }
    ];
};

export function LanguageProvider({ children }) {
    const pathname = usePathname();

    const [language, setLanguage] =
        useState('ar');

    const [parallelLanguage, setParallelLanguage] =
        useState(null);

    const [strings, setStrings] =
        useState(null);

    const { theme, setTheme } =
        useTheme();

    const [useTashkeel, setUseTashkeel] =
        useState(false);

    const [keepAppAwake, setKeepAppAwake] =
        useState(true);

    const [keepBibleAwake, setKeepBibleAwake] =
        useState(true);

    const [isFirstTime, setIsFirstTime] =
        useState(false);

    const [onboardingStep, setOnboardingStep] =
        useState('language');

    const [isHydrated, setIsHydrated] =
        useState(false);

    const loadTranslations =
        useCallback(async (lang) => {
            try {
                const folder =
                    FOLDER_MAP[lang] || 'arabic';

                const mainFile =
                    lang === 'ar'
                        ? 'ar.json'
                        : `${lang}.json`;

                const mainData =
                    await languageManager.getFile(
                        folder,
                        mainFile
                    );

                if (!mainData) {
                    throw new Error(
                        'Main language data is empty'
                    );
                }

                setStrings(mainData);
            } catch (error) {
                console.error(
                    'Error loading language:',
                    error
                );

                if (lang === 'ar') {
                    try {
                        const fallback =
                            await import(
                                '../data/translations/arabic/ar.json'
                            );

                        setStrings(
                            fallback.default || fallback
                        );
                    } catch (fallbackError) {
                        console.error(
                            'Critical fallback error:',
                            fallbackError
                        );
                    }
                } else {
                    throw error;
                }
            }
        }, []);

    const prefetchAuxFiles =
        useCallback(async (lang) => {
            if (!Capacitor.isNativePlatform()) {
                return;
            }

            const files = getAuxFiles(lang);

            await Promise.allSettled(
                files.map(({ folder, fileName }) =>
                    languageManager.getFile(
                        folder,
                        fileName
                    )
                )
            );
        }, []);

    const prefetchSharedFiles =
        useCallback(async () => {
            if (!Capacitor.isNativePlatform()) {
                return;
            }

            await Promise.allSettled(
                SHARED_FILES.map(({ folder, fileName }) =>
                    languageManager.getFile(
                        folder,
                        fileName
                    )
                )
            );
        }, []);

    useEffect(() => {
        const init = async () => {
            try {
                await languageManager.init();

                const savedLang =
                    localStorage.getItem(
                        'app_lang'
                    );

                const onboardingDone =
                    localStorage.getItem(
                        'onboarding_done'
                    ) === 'true';

                if (
                    !savedLang ||
                    !onboardingDone
                ) {
                    setIsFirstTime(true);

                    const langToLoad =
                        savedLang || 'ar';

                    setLanguage(
                        langToLoad
                    );

                    await loadTranslations(
                        langToLoad
                    );

                    prefetchAuxFiles(
                        langToLoad
                    );

                    if (savedLang) {
                        setOnboardingStep(
                            'theme'
                        );
                    }
                } else {
                    setLanguage(
                        savedLang
                    );

                    await loadTranslations(
                        savedLang
                    );

                    prefetchAuxFiles(
                        savedLang
                    );
                }

                prefetchSharedFiles();

                const savedParallel =
                    localStorage.getItem(
                        'parallel_lang'
                    );

                if (savedParallel) {
                    setParallelLanguage(
                        savedParallel
                    );
                }

                const savedTashkeel =
                    localStorage.getItem(
                        'useTashkeel'
                    ) === 'true';

                setUseTashkeel(
                    savedTashkeel
                );

                const appAwakeRaw =
                    localStorage.getItem(
                        'keepAppAwake'
                    );

                const bibleAwakeRaw =
                    localStorage.getItem(
                        'keepBibleAwake'
                    );

                const appAwake =
                    appAwakeRaw === null
                        ? true
                        : appAwakeRaw === 'true';

                const bibleAwake =
                    bibleAwakeRaw === null
                        ? true
                        : bibleAwakeRaw === 'true';

                setKeepAppAwake(
                    appAwake
                );

                setKeepBibleAwake(
                    bibleAwake
                );

                setIsHydrated(true);
            } catch (error) {
                console.error(
                    'Language initialization error:',
                    error
                );

                setIsHydrated(true);
            }
        };

        init();
    }, [loadTranslations, prefetchAuxFiles, prefetchSharedFiles]);

    useEffect(() => {
        if (
            !isHydrated ||
            !Capacitor.isNativePlatform()
        ) {
            return;
        }

        const updateAwakeStatus =
            async () => {
                try {
                    if (
                        keepAppAwake
                    ) {
                        await KeepAwake.keepAwake();
                    } else if (
                        keepBibleAwake &&
                        pathname?.includes(
                            '/bible'
                        )
                    ) {
                        await KeepAwake.keepAwake();
                    } else {
                        await KeepAwake.allowSleep();
                    }
                } catch (error) {
                    console.error(
                        'Awake Status Error:',
                        error
                    );
                }
            };

        updateAwakeStatus();
    }, [
        keepAppAwake,
        keepBibleAwake,
        pathname,
        isHydrated
    ]);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        const checkForUpdates = async () => {
            try {
                await languageManager.refreshManifest();

                const folder =
                    FOLDER_MAP[language] || 'arabic';

                const mainFile =
                    language === 'ar'
                        ? 'ar.json'
                        : `${language}.json`;

                const upToDate =
                    await languageManager.isUpToDate(
                        folder,
                        mainFile
                    );

                if (!upToDate) {
                    await loadTranslations(language);
                }

                if (Capacitor.isNativePlatform()) {
                    const auxFiles =
                        getAuxFiles(language);

                    for (const { folder: auxFolder, fileName } of auxFiles) {
                        const auxUpToDate =
                            await languageManager.isUpToDate(
                                auxFolder,
                                fileName
                            );

                        if (!auxUpToDate) {
                            await languageManager.getFile(
                                auxFolder,
                                fileName
                            ).catch(() => {});
                        }
                    }

                    for (const { folder: sharedFolder, fileName } of SHARED_FILES) {
                        const sharedUpToDate =
                            await languageManager.isUpToDate(
                                sharedFolder,
                                fileName
                            );

                        if (!sharedUpToDate) {
                            await languageManager.getFile(
                                sharedFolder,
                                fileName
                            ).catch(() => {});
                        }
                    }
                }
            } catch (error) {
                console.error(
                    'Update Check Error:',
                    error
                );
            }
        };

        if (Capacitor.isNativePlatform()) {
            let listenerHandle;

            App.addListener(
                'appStateChange',
                ({ isActive }) => {
                    if (isActive) {
                        checkForUpdates();
                    }
                }
            ).then((handle) => {
                listenerHandle = handle;
            });

            return () => {
                listenerHandle?.remove();
            };
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        };

        document.addEventListener(
            'visibilitychange',
            handleVisibility
        );

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibility
            );
        };
    }, [
        isHydrated,
        language,
        loadTranslations
    ]);

    const bookNames = useMemo(() => {
        if (!allBookNames) {
            return [];
        }

        return (
            allBookNames[language] ||
            allBookNames.ar ||
            []
        );
    }, [language]);

    const dir = useMemo(
        () =>
            language === 'ar'
                ? 'rtl'
                : 'ltr',
        [language]
    );

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        document.documentElement.lang =
            language;

        document.documentElement.dir =
            dir;

        const syncLang =
            async () => {
                try {
                    await Preferences.set({
                        key: 'language',
                        value: language
                    });

                    if (
                        window
                            .AgiosScannerNative
                            ?.refreshAlarms
                    ) {
                        window
                            .AgiosScannerNative
                            .refreshAlarms();
                    }
                } catch (error) {
                    console.error(
                        'Language Sync Error:',
                        error
                    );
                }
            };

        syncLang();
    }, [
        language,
        dir,
        isHydrated
    ]);

    useEffect(() => {
        if (
            isHydrated &&
            Capacitor.isNativePlatform() &&
            theme
        ) {
            const syncTheme =
                async () => {
                    try {
                        await Preferences.set({
                            key: 'theme',
                            value: theme
                        });

                        if (
                            window
                                .AgiosScannerNative
                                ?.refreshWidgets
                        ) {
                            window
                                .AgiosScannerNative
                                .refreshWidgets();
                        }
                    } catch (error) {
                        console.error(
                            'Theme Sync Error:',
                            error
                        );
                    }
                };

            syncTheme();
        }
    }, [
        theme,
        isHydrated
    ]);

    const changeLanguage =
        async (newLang) => {
            if (
                newLang === language
            ) {
                localStorage.setItem(
                    'app_lang',
                    newLang
                );

                return;
            }

            const folder =
                FOLDER_MAP[newLang] || 'arabic';

            const mainFile =
                newLang === 'ar'
                    ? 'ar.json'
                    : `${newLang}.json`;

            if (
                typeof navigator !== 'undefined' &&
                !navigator.onLine
            ) {
                const alreadyAvailable =
                    await languageManager.hasLocalCopy(
                        folder,
                        mainFile
                    );

                if (!alreadyAvailable) {
                    toast.error(
                        strings?.common?.internet_required ||
                        'This feature requires an internet connection'
                    );

                    return;
                }
            }

            localStorage.setItem(
                'app_lang',
                newLang
            );

            setIsHydrated(false);

            try {
                await languageManager.refreshManifest();

                await loadTranslations(
                    newLang
                );

                prefetchAuxFiles(
                    newLang
                );

                setLanguage(
                    newLang
                );

                if (
                    parallelLanguage ===
                    newLang
                ) {
                    setParallelLanguage(
                        null
                    );

                    localStorage.removeItem(
                        'parallel_lang'
                    );
                }
            } catch (error) {
                console.error(
                    'Change Language Error:',
                    error
                );

                toast.error(
                    strings?.common?.internet_required ||
                    'This feature requires an internet connection'
                );
            } finally {
                setIsHydrated(true);
            }
        };

    const finishFirstTime =
        () => {
            setIsFirstTime(
                false
            );

            localStorage.setItem(
                'onboarding_done',
                'true'
            );
        };

    const changeParallelLanguage =
        (newLang) => {
            if (
                newLang === null
            ) {
                setParallelLanguage(
                    null
                );

                localStorage.removeItem(
                    'parallel_lang'
                );
            } else {
                setParallelLanguage(
                    newLang
                );

                localStorage.setItem(
                    'parallel_lang',
                    newLang
                );
            }

            window.dispatchEvent(
                new Event('storage')
            );
        };

    const toggleTashkeel =
        useCallback(() => {
            setUseTashkeel(
                previous => {
                    const newState =
                        !previous;

                    localStorage.setItem(
                        'useTashkeel',
                        newState.toString()
                    );

                    window.dispatchEvent(
                        new Event('storage')
                    );

                    return newState;
                }
            );
        }, []);

    const toggleKeepAppAwake =
        useCallback(async () => {
            setKeepAppAwake(
                previous => {
                    const newState =
                        !previous;

                    localStorage.setItem(
                        'keepAppAwake',
                        newState.toString()
                    );

                    return newState;
                }
            );
        }, []);

    const toggleKeepBibleAwake =
        useCallback(() => {
            setKeepBibleAwake(
                previous => {
                    const newState =
                        !previous;

                    localStorage.setItem(
                        'keepBibleAwake',
                        newState.toString()
                    );

                    return newState;
                }
            );
        }, []);

    const formatNumber =
        useCallback(
            num => {
                if (
                    num === null ||
                    num === undefined
                ) {
                    return '';
                }

                if (
                    language !== 'ar'
                ) {
                    return num.toString();
                }

                const arabicNums = [
                    '٠',
                    '١',
                    '٢',
                    '٣',
                    '٤',
                    '٥',
                    '٦',
                    '٧',
                    '٨',
                    '٩'
                ];

                return num
                    .toString()
                    .split('')
                    .map(
                        digit =>
                            arabicNums[
                                +digit
                            ] || digit
                    )
                    .join('');
            },
            [language]
        );

    const value = {
        language,
        parallelLanguage,
        useTashkeel,
        keepAppAwake,
        keepBibleAwake,
        strings,
        bookNames,
        allBookNames,
        dir,
        changeLanguage,
        changeParallelLanguage,
        toggleTashkeel,
        toggleKeepAppAwake,
        toggleKeepBibleAwake,
        isFirstTime,
        setIsFirstTime,
        onboardingStep,
        setOnboardingStep,
        finishFirstTime,
        isHydrated,
        formatNumber
    };

    if (
        !isHydrated ||
        !strings
    ) {
        return (
            <div
                style={{
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                        'var(--color-bg-start)',
                    color:
                        'var(--color-text-primary)',
                    fontFamily:
                        'sans-serif'
                }}
            >
                ...
            </div>
        );
    }

    return (
        <LanguageContext.Provider
            value={value}
        >
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage =
    () => useContext(
        LanguageContext
    );