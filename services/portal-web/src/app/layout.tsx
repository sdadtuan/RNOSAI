import type { Metadata, Viewport } from 'next';
import './globals.css';
import './portal-tables.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Cổng khách hàng PTT',
  description: 'Xem hiệu quả chiến dịch và duyệt nội dung cho khách hàng PTT',
  applicationName: 'Cổng khách hàng PTT',
  appleWebApp: {
    capable: true,
    title: 'PTT Portal',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#17692f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta name="ptt-app-version" content="0.1.0" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
