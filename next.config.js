/** @type {import('next').NextConfig} */
const nextConfig = {
  // تم إزالة output: 'export' لكي تعمل الـ API Routes على Vercel
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  // سنترك الـ trailingSlash إذا كنت تحتاجه للـ SEO، ولكننا سنعالج الروابط في الكود
  trailingSlash: true,
};

module.exports = nextConfig;
