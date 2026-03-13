/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /\.(?:json|xml|csv)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-data-assets",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "static-media-assets",
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 60 * 24 * 60 * 60, // 60 يوم
          },
        },
      },
    ],
  },
});

const nextConfig = {
};

module.exports = withPWA(nextConfig);