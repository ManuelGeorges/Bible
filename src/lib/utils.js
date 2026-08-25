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
    window.open(url, '_blank');
  }
};

/**
 * وظيفة لجلب البيانات مع مهلة زمنية (Timeout)
 * إذا تأخر الرد، يتم إلغاء الطلب واعتباره فشلاً في الشبكة
 */
export async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 4000 } = options; // مهلة افتراضية 8 ثوانٍ للنت الضعيف

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}
