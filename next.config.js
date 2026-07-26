const JavaScriptObfuscator = require('webpack-obfuscator');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,

  images: {
    unoptimized: true,
  },

  reactStrictMode: false,
  trailingSlash: true,
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
          // FIX: was `true` — this stripped every console.log/error from the
          // mobile production bundle, so real runtime errors (CORS failures,
          // fetch errors, JSON parse errors) were invisible in device debugging.
          disableConsoleOutput: false,
          selfDefending: false,
          unicodeEscapeSequence: false
        }, [
          'static/chunks/react-refresh.js',
          'static/chunks/main-app.js',
          'static/chunks/webpack.js',
          // FIX: removed 'static/chunks/map-vendor*.js' and the maplibre-gl /
          // @google/generative-ai node_modules entries below. maplibre-gl spins
          // up Web Workers by serializing its own function source into blobs at
          // runtime — obfuscating it rewrites that source and breaks worker
          // creation silently, which is almost certainly why the map didn't render.
        ])
      );
    }
    return config;
  },
};

module.exports = nextConfig;