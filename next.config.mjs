/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['xlsx', 'sharp', 'pdf-lib'],
  },
};

export default nextConfig;

