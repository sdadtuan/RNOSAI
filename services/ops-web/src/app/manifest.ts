import type { MetadataRoute } from 'next';

/**
 * RNOS-41 — PWA manifest (Getfly parity P0-1: mobile lead care).
 * Served at /manifest.webmanifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PTT CRM Ops',
    short_name: 'PTT CRM',
    description: 'CSKH lead care — PTT agency staff console',
    start_url: '/crm/leads',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#1a1f16',
    theme_color: '#398b43',
    lang: 'vi',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
