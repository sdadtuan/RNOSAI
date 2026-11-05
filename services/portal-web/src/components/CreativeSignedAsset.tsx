'use client';

import { useEffect, useState } from 'react';
import { fetchCreativeAssetUrl, playableAssetSrc, type CreativeRow } from '@/lib/api';

function isImageRow(row: CreativeRow): boolean {
  return row.asset_type === 'image' || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(row.asset_url ?? '');
}

function isVideoRow(row: CreativeRow, mime?: string): boolean {
  return row.asset_type === 'video' || Boolean(mime?.startsWith('video/'))
    || /\.(mp4|webm|mov)(\?|$)/i.test(row.asset_url ?? '');
}

export function CreativeSignedAsset({ token, row }: { token: string; row: CreativeRow }) {
  const [src, setSrc] = useState('');
  const [mime, setMime] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!row.asset_url) return;
    let cancelled = false;
    setSrc('');
    setError('');
    void fetchCreativeAssetUrl(token, row.id)
      .then((out) => {
        if (cancelled) return;
        setMime(out.mime);
        setSrc(playableAssetSrc(out.url));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không mở được file');
      });
    return () => {
      cancelled = true;
    };
  }, [row.asset_url, row.id, token]);

  if (!row.asset_url) return null;
  if (error) return <p className="muted creative-card__desc">{error}</p>;
  if (!src) return <p className="muted creative-card__desc">Đang tải preview…</p>;

  if (isVideoRow(row, mime)) {
    return (
      <div className="creative-card__asset">
        <video controls playsInline preload="metadata" src={src} />
      </div>
    );
  }
  if (isImageRow(row) || mime.startsWith('image/')) {
    return (
      <div className="creative-card__asset">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={row.title} />
      </div>
    );
  }
  return (
    <p className="muted creative-card__desc">
      Asset:{' '}
      <a href={src} target="_blank" rel="noreferrer">
        mở preview ({row.asset_type || 'file'})
      </a>
    </p>
  );
}
