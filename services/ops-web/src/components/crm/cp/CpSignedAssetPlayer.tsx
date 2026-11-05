'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { getCpAssetStreamUrl, type CpScope } from '@/lib/crm/cp-api';

function playableSrc(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

function mediaKind(mime?: string | null): 'video' | 'image' | null {
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('image/')) return 'image';
  return null;
}

export function CpSignedAssetPlayer({
  assetId,
  mime,
  scope = 'me',
  compact = false,
}: {
  assetId: string;
  mime?: string | null;
  scope?: CpScope;
  compact?: boolean;
}) {
  const kind = mediaKind(mime);
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!kind) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    setSrc('');
    setError('');
    void getCpAssetStreamUrl(token, assetId, scope)
      .then((out) => {
        if (!cancelled) setSrc(playableSrc(out.url));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không mở được file');
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, kind, scope]);

  if (!kind) return null;
  if (error) return <p className="cp-muted">{error}</p>;
  if (!src) return <p className="cp-muted">Đang tải preview…</p>;
  if (kind === 'video') {
    return (
      <video
        className={compact ? 'cp-asset-player cp-asset-player--compact' : 'cp-asset-player'}
        controls
        playsInline
        src={src}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="cp-asset-player" src={src} alt="" />
  );
}
