/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    webpackBuildWorker: false,
    serverComponentsExternalPackages: ['xlsx'],
  },
};

export default nextConfig;
