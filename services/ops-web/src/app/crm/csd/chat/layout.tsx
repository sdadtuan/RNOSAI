import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat SD',
  description: 'Chat nội bộ',
  manifest: '/csd-chat-manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Chat SD' },
};

export default function CsdChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
