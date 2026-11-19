/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['xlsx', 'sharp', 'pdf-lib'],
  },
  async headers() {
    return [
      {
        // Cegah caching pada seluruh halaman HTML dan API agar user selalu mendapatkan versi terbaru
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // Aset statis dengan content-hash Next.js tetap di-cache secara permanen demi performa tinggi
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/uploads/:path*',
          destination: '/:path*',
        },
      ],
    };
  },
};

export default nextConfig;
