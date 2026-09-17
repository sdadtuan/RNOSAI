import type { ReactNode } from 'react';
import { VideoSopShell } from '@/components/video-sop/VideoSopShell';
import '@/styles/video-sop-shell.css';

export default function VideoSopLayout({ children }: { children: ReactNode }) {
  return <VideoSopShell>{children}</VideoSopShell>;
}
