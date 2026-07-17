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
  // تحسين معالجة الـ preload وتقليل التحذيرات
  optimizeFonts: false,

  webpack: (config, { dev, isServer }) => {
    // التعتيم يعمل فقط عند بناء النسخة النهائية (Production) وليس في وضع التطوير (Dev)
    // كما نتجنب تعتيم كود السيرفر إذا لم تكن بحاجة لذلك، ونركز على الكود الذي يذهب للموبايل (Client)
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
          unicodeEscapeSequence: false // قد تزيد الحجم جداً إذا كانت true
        }, [
          // استثناء الملفات التي قد تسبب مشاكل عند التعتيم
          'static/chunks/react-refresh.js',
          'static/chunks/main-app.js'
        ])
      );
    }
    return config;
  },
};

module.exports = nextConfig;
