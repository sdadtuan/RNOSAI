'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  getCpVideo,
  type CpScope,
  type CpVideoDraft,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function displayJson(value: unknown): string {
  if (value == null) return dash(null);
  return JSON.stringify(value, null, 2);
}

export function CpVersionDetail({
  versionId,
  scope: scopeValue,
}: {
  versionId: string;
  scope?: string;
}) {
  const scope = scopeFrom(scopeValue);
  const [video, setVideo] = useState<CpVideoDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setVideo(await getCpVideo(token, versionId, scope));
    } catch (caught) {
      setVideo(null);
      setError(formatCpApiError(caught, 'Không tải được phiên bản video'));
    } finally {
      setLoading(false);
    }
  }, [scope, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Video Version</p>
          <h1>{video?.name ? `Video Version — ${video.name}` : 'Video Version'}</h1>
          <p className="cp-muted">Snapshot chi tiết từ API.</p>
        </div>
        <Link className="cp-btn" href={`/crm/creative-os/video/${video?.id ?? versionId}?scope=${scope}`}>Studio</Link>
      </header>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}
      <div className="cp-overview-grid">
        <section className="cp-card">
          <div className="cp-card__head"><h2>Snapshot</h2></div>
          <p>Draft: {dash(video?.id)}</p>
          <p>Revision: {dash(video?.revision)}</p>
          <p>Input mode: {dash(video?.input_mode)}</p>
          <p>Brand Kit version: {dash(video?.brand_kit_version_id)}</p>
          <p>Autosaved: {dash(video?.autosaved_at)}</p>
        </section>
        <section className="cp-card">
          <div className="cp-card__head"><h2>Output & cost</h2></div>
          <p className="cp-empty">{dash(null)}</p>
        </section>
      </div>
      <section className="cp-card">
        <div className="cp-card__head"><h2>Configuration</h2></div>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{displayJson(video?.config_json)}</pre>
      </section>
    </div>
  );
}
