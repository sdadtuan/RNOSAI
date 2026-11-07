/** @type {import('next').NextConfig} */
const stagingBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim().replace(/\/$/, '');
/** Dev-only: proxy /api → VPS so localhost avoids CORS (set in .env.local, not on prod build). */
const localApiProxy = (process.env.PTT_LOCAL_API_PROXY_TARGET ?? '').trim().replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.1.90', '10.201.124.71'],
  transpilePackages: ['@rnosai/ui'],
  ...(stagingBasePath ? { basePath: stagingBasePath, assetPrefix: stagingBasePath } : {}),
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/((?!_next/static|icons|sw\\.js|manifest\\.webmanifest).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/crm/agency', destination: '/agency', permanent: false },
      { source: '/crm/agency/:path*', destination: '/agency/:path*', permanent: false },
      ...(stagingBasePath
        ? [{ source: '/', destination: '/crm/leads', permanent: false }]
        : []),
    ];
  },
  async rewrites() {
    if (!localApiProxy) return [];
    return [
      { source: '/api/:path*', destination: `${localApiProxy}/api/:path*` },
      { source: '/health', destination: `${localApiProxy}/health` },
    ];
  },
};

export default nextConfig;
