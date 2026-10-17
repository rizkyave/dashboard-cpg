/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['xlsx'],
  experimental: {
    webpackBuildWorker: false,
    serverComponentsExternalPackages: ['xlsx'],
  },
};

export default nextConfig;
