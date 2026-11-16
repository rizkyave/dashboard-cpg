/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['xlsx', 'sharp', 'pdf-lib'],
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

