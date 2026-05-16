import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

export const openExternalLink = async (url) => {
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({
        url: url,
        windowName: '_blank',
        toolbarColor: '#1e3a8a'
      });
    } catch (error) {
      console.error("Could not open browser", error);
      window.open(url, '_blank');
    }
  } else {
    // على الويب نفتح الرابط بشكل طبيعي
    window.open(url, '_blank');
  }
};
