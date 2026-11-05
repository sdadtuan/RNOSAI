'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  getCpVideoVersion,
  type CpScope,
  type CpVideoVersion,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import { CpVideoReview } from './CpVideoReview';

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
  const [version, setVersion] = useState<CpVideoVersion | null>(null);
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
      setVersion(await getCpVideoVersion(token, versionId, scope));
    } catch (caught) {
      setVersion(null);
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
          <h1>{version?.draft_name ? `Video Version — ${version.draft_name}` : 'Video Version'}</h1>
          <p className="cp-muted">Snapshot chi tiết từ API.</p>
        </div>
        {version?.draft_id ? <Link className="cp-btn" href={`/crm/creative-os/video/${version.draft_id}?scope=${scope}`}>Studio</Link> : null}
      </header>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}
      <div className="cp-overview-grid">
        <section className="cp-card">
          <div className="cp-card__head"><h2>Snapshot</h2></div>
          <p>Version: {dash(version?.version_n)}</p>
          <p>Draft: {dash(version?.draft_id)}</p>
          <p>Brand Kit version: {dash(version?.brand_kit_version_id)}</p>
          <p>QC: {dash(version?.qc_status)}</p>
          <p>Approval: {dash(version?.approval_status)}</p>
          <p>Immutable: {version == null ? dash(null) : version.immutable ? 'true' : 'false'}</p>
        </section>
        <section className="cp-card">
          <div className="cp-card__head"><h2>Output & cost</h2></div>
          <p>Output URI: {dash(version?.output_uri)}</p>
          <p>Pricing version: {dash(version?.pricing_version)}</p>
        </section>
      </div>
      <section className="cp-card">
        <div className="cp-card__head"><h2>Configuration</h2></div>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{displayJson(version?.snapshot_json)}</pre>
      </section>
      <CpVideoReview versionId={versionId} scope={scopeValue} />
    </div>
  );
}
