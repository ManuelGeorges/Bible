"use client";

import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

const SplashHandler = ({ children }) => {
  useEffect(() => {
    // إخفاء الشاشة الأصلية (Native) فور تحميل الجافا سكريبت وبدء التطبيق
    const hideNativeSplash = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await SplashScreen.hide();
        } catch (error) {
          console.warn('Native splash hide error:', error);
        }
      }
    };

    hideNativeSplash();
  }, []);

  // نعرض المحتوى فوراً دون أي واجهة سبلاش ويب
  return <>{children}</>;
};

export default SplashHandler;