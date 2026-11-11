/** @type {import('next').NextConfig} */
const basePath = (process.env.NEXT_PUBLIC_PORTAL_BASE_PATH ?? '/client').trim().replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
