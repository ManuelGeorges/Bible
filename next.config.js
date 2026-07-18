const JavaScriptObfuscator = require('webpack-obfuscator');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل التصدير الثابت فقط عند البناء للموبايل
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false, // تعطيله يزيد الأداء في الإنتاج ويمنع الرندر المزدوج
  trailingSlash: true,

  // تفعيل التصغير القوي باستخدام SWC
  swcMinify: true,

  // تفعيل ضغط الملفات
  compress: true,

  // منع إنشاء ملفات الـ Source Maps
  productionBrowserSourceMaps: false,

  webpack: (config, { dev, isServer }) => {
    // التشفير يعمل فقط في النسخة النهائية (Production)
    if (!dev && !isServer) {
      config.plugins.push(
        new JavaScriptObfuscator({
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.5, // تقليل القيمة لتقليل استهلاك الذاكرة (RAM)
          // تعطيل الخصائص التالية لأنها تستهلك المعالج (CPU) جداً في الأجهزة الضعيفة
          controlFlowFlattening: false,
          deadCodeInjection: false,
          debugProtection: true,
          disableConsoleOutput: true,
          selfDefending: true,
          unicodeEscapeSequence: false
        }, [
          'static/chunks/react-refresh.js',
          'static/chunks/main-app.js',
          'static/chunks/webpack.js'
        ])
      );
    }
    return config;
  },
};

module.exports = nextConfig;
