import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agios.bible',
  appName: 'Agios Bible',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0f172a",
      showSpinner: true,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: false, // بيمنع تداخل المحتوى مع الساعة
      backgroundColor: "#0f172a",
      style: 'DARK', // DARK هنا يعني الساعة والبطارية يبقوا بيض (عشان الخلفية غامقة)
    },
    Keyboard: {
      resize: 'body' as any, // بيزق الصفحة لفوق لما الكيبورد يفتح بدل ما يغطيها
      style: 'DARK' as any, // بيخلي الكيبورد نفسه لونه غامق
    }
  }
};

export default config;