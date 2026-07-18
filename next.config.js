const JavaScriptObfuscator = require('webpack-obfuscator');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل التصدير الثابت فقط عند البناء للموبايل
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  trailingSlash: true,

  // تفعيل التشفير والتصغير القوي باستخدام SWC
  swcMinify: true,

  // منع إنشاء ملفات الـ Source Maps نهائياً لإخفاء الكود الأصلي
  productionBrowserSourceMaps: false,

  webpack: (config, { dev, isServer }) => {
    // التشفير يعمل فقط في النسخة النهائية (Production)
    if (!dev && !isServer) {
      config.plugins.push(
        new JavaScriptObfuscator({
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.5,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.2,
          debugProtection: true, // يمنع فتح الـ Console أو محاولة الـ Debugging
          disableConsoleOutput: true,
          selfDefending: true, // الكود يعطل نفسه إذا حاول أحد تعديله
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
