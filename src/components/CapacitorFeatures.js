"use client";
import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';

export default function CapacitorFeatures() {
  useEffect(() => {
    const initStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#0f172a' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (e) {
        console.log('StatusBar not available');
      }
    };
    initStatusBar();
  }, []);

  return null; 
}