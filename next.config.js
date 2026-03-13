/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true, 
  sw: "sw.js",
  aggressiveFrontEndNavCaching: true, 
  reloadOnOnline: true,
  swMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: "NetworkFirst", 
        options: {
          cacheName: "pages-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: /\.(?:json|xml|csv)$/i,
        handler: "CacheFirst", 
        options: {
          cacheName: "static-data-assets",
          expiration: {
            maxEntries: 10000, 
            maxAgeSeconds: 365 * 24 * 60 * 60, 
          },
        },
      },
      {
        // 3. تخزين الصور والخطوط والأيقونات
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-media-assets",
          expiration: {
            maxEntries: 1000,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
        },
      },
      {
        // 4. تخزين ملفات الـ JS والـ CSS الأساسية لعمل التطبيق
        urlPattern: /\.(?:js|css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-resources",
        },
      },
    ],
  },
});

const nextConfig = {
  experimental: {
    turbo: {
      enabled: false,
    },
  },
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);