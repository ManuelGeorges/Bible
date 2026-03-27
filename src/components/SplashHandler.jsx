"use client";

import { useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import styles from './SplashHandler.module.css';

const SplashHandler = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        
        // بنخفي الـ Native بـ Fade سريع جداً عشان ميبانش فراغ
        await SplashScreen.hide({ fadeOutDuration: 200 });
        
        // بنستنى فمتو ثانية كمان قبل ما نشيل الـ React Overlay
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsReady(true);
      } catch (error) {
        await SplashScreen.hide();
        setIsReady(true);
      }
    };
    initApp();
  }, []);

  if (!isReady) {
    return (
      <div className={styles.splashWrapper}>
        <div className={styles.logoContainer}>
          <img src="/splash_full.png" alt="Logo" className={styles.mainLogo} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SplashHandler;