/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['arabic-stemmer'],

  async rewrites() {
    return [
      {
        source: '/api/search',
        destination: 'http://localhost:5000/api/search',
      },
    ];
  },
};

module.exports = nextConfig;