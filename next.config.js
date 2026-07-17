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

  // منع إنشاء ملفات الـ Source Maps نهائياً
  productionBrowserSourceMaps: false,

  webpack: (config, { dev, isServer }) => {
    // التشفير يعمل فقط في النسخة النهائية (Production) لتجنب أخطاء Turbopack في التطوير
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
