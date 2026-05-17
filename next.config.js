/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل التصدير الثابت فقط عند البناء للموبايل
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  trailingSlash: true,
};

module.exports = nextConfig;
