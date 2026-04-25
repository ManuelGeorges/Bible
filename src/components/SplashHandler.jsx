"use client";

import { useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import styles from './SplashHandler.module.css';

const SplashHandler = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        setIsReady(true);
      } catch (error) {
        setIsReady(true);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    if (isReady && Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <div className={styles.splashWrapper}>
        <div className={styles.logoContainer}>
          <img src="/logo.png" alt="Logo" className={styles.mainLogo} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SplashHandler;