const JavaScriptObfuscator = require('webpack-obfuscator');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  trailingSlash: true,
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,

  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups || {}),
          mapVendor: {
            test: /[\\/]node_modules[\\/](maplibre-gl|pmtiles|mapbox-gl)[\\/]/,
            name: 'map-vendor',
            chunks: 'all',
            priority: 40,
          },
        },
      };
    }

    if (!dev && !isServer) {
      config.plugins.push(
        new JavaScriptObfuscator({
          rotateStringArray: true,
          stringArray: true,
          stringArrayThreshold: 0.5,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          debugProtection: false,
          disableConsoleOutput: true,
          selfDefending: false,
          unicodeEscapeSequence: false
        }, [
          'static/chunks/react-refresh.js',
          'static/chunks/main-app.js',
          'static/chunks/webpack.js',
          'static/chunks/map-vendor*.js'
        ])
      );
    }
    return config;
  },
};

module.exports = nextConfig;