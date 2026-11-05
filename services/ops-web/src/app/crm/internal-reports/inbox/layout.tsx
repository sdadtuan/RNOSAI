import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hộp thư BC nội bộ',
  description: 'Hộp thư báo cáo công việc nội bộ',
  manifest: '/iwr-manifest.json',
  appleWebApp: {
    capable: true,
    title: 'BC nội bộ',
  },
};

export default function IwrInboxLayout({ children }: { children: React.ReactNode }) {
  return children;
}
