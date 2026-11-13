/** @type {import('next').NextConfig} */
const basePath = (process.env.NEXT_PUBLIC_PORTAL_BASE_PATH ?? '/client').trim().replace(/\/$/, '');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  // Server-level redirects so /crm/customers/leads and /messages never
  // first-paint an empty PersistentPortalChrome shell.
  async redirects() {
    return [
      { source: '/crm/customers/leads', destination: '/crm/customers?source=lead', permanent: false },
      { source: '/crm/customers/messages', destination: '/crm/customers?source=message', permanent: false },
      { source: '/messages', destination: '/crm/messages', permanent: false },
    ];
  },
};

export default nextConfig;
