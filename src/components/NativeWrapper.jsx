"use client"; // ده الكلاينت كومبوننت

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

export default function NativeWrapper({ children }) {
  useEffect(() => {
    async function setupNative() {
      if (Capacitor.isNativePlatform()) {
        try {
          // 1. فصل الساعة عن محتوى التطبيق تماماً
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: '#0f172a' }); // لونك الكحلي
          await StatusBar.setStyle({ style: Style.Dark }); // أيقونات بيضاء

          // 2. ضبط الكيبورد عشان ميبوظش الأبعاد
          if (Capacitor.getPlatform() === 'android') {
            await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
          }
        } catch (e) {
          console.warn("Capacitor features not available:", e);
        }
      }
    }
    setupNative();
  }, []);

  return <>{children}</>;
}