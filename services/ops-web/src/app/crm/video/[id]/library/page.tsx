'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { VideoSopPageChrome } from '@/components/video-sop/VideoSopPageChrome';
import { VD_SOP_LAST_PROJECT_KEY } from '@/lib/crm/video-sop-nav';

export default function VideoSopLibraryStubPage() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const valid = Number.isInteger(projectId) && projectId > 0;

  useEffect(() => {
    if (valid) {
      window.localStorage.setItem(VD_SOP_LAST_PROJECT_KEY, String(projectId));
    }
  }, [projectId, valid]);

  if (!valid) {
    return (
      <VideoSopPageChrome title="Asset Library (SC-12)">
        <p className="vd-status vd-status--error">Project id không hợp lệ.</p>
      </VideoSopPageChrome>
    );
  }

  return (
    <VideoSopPageChrome title="Asset Library (SC-12)">
      <p className="vd-empty">
        SC-12 Asset Library chưa ship — dùng asset qua Keyframes / Delivery. Backlog FR-7.9.
      </p>
      <Link href={`/crm/video/${projectId}`} className="vd-btn">
        ← Về workspace
      </Link>
    </VideoSopPageChrome>
  );
}
