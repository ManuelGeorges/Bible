"use client";

import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';

const SplashHandler = ({ children }) => {
  useEffect(() => {
    const initApp = async () => {
      try {
        // هنا ممكن تضيف أي عمليات تحميل بيانات (اختياري)
        // await new Promise(resolve => setTimeout(resolve, 500)); 

        // إخفاء الـ Splash Screen بنعومة
        await SplashScreen.hide({
          fadeOutDuration: 500, // مدة التلاشي بالملي ثانية
        });
      } catch (error) {
        console.error("Error hiding splash screen:", error);
        // نضمن إخفاءها حتى لو حدث خطأ
        await SplashScreen.hide();
      }
    };

    initApp();
  }, []);

  return <>{children}</>;
};

export default SplashHandler;