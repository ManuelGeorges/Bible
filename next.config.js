/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  experimental: {
    turbo: {
      enabled: false,
    },
  },
  reactStrictMode: true,
};

module.exports = nextConfig;