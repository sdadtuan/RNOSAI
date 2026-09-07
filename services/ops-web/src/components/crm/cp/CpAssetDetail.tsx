'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_MIME_ALLOWLIST,
  getCpAsset,
  getCpAssetUsage,
  replaceCpAsset,
  type CpAsset,
  type CpAssetFileVersion,
  type CpAssetUsage,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash, rightsStatus } from '@/lib/crm/cp-format';

function scopeFrom(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function rightsClass(status: ReturnType<typeof rightsStatus>): string {
  if (status === 'block') return 'cp-pill cp-pill--danger';
  if (status === 'warn') return 'cp-pill cp-pill--warning';
  return 'cp-pill';
}

function booleanLabel(value: boolean | null | undefined): string {
  return value == null ? dash(value) : value ? 'Có' : 'Không';
}

function uniqueVersions(
  usages: CpAssetUsage[],
  versions?: CpAssetFileVersion[],
): CpAssetFileVersion[] {
  if (versions?.length) {
    return [...versions].sort((a, b) => Number(a.n) - Number(b.n));
  }
  const seen = new Map<string, CpAssetFileVersion>();
  for (const usage of usages) {
    if (!usage.asset_version_id || seen.has(usage.asset_version_id)) continue;
    seen.set(usage.asset_version_id, {
      id: usage.asset_version_id,
      n: usage.n,
      storage_key: usage.storage_key,
      mime: usage.mime,
      bytes: usage.bytes,
    });
  }
  return [...seen.values()].sort((a, b) => Number(a.n) - Number(b.n));
}

export function CpAssetDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const assetId = params.id;
  const scope = scopeFrom(searchParams.get('scope'));
  const [asset, setAsset] = useState<CpAsset | null>(null);
  const [usages, setUsages] = useState<CpAssetUsage[]>([]);
  const [versions, setVersions] = useState<CpAssetFileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [assetOut, usageOut] = await Promise.all([
        getCpAsset(token, assetId, scope),
        getCpAssetUsage(token, assetId, scope),
      ]);
      setAsset(assetOut);
      setUsages(usageOut.usages);
      setVersions(uniqueVersions(usageOut.usages, usageOut.versions));
    } catch (err) {
      setAsset(null);
      setUsages([]);
      setVersions([]);
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết asset');
    } finally {
      setLoading(false);
    }
  }, [assetId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function replace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const mime = String(form.get('mime') ?? '').trim();
    if (!(CP_MIME_ALLOWLIST as readonly string[]).includes(mime)) {
      setError('mime_not_allowed');
      return;
    }
    const storageKey = String(form.get('storage_key') ?? '').trim();
    const bytes = Number(String(form.get('bytes') ?? '').trim());
    if (!storageKey) {
      setError('storage_key_required');
      return;
    }
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      setError('invalid_bytes');
      return;
    }
    setReplacing(true);
    setError('');
    setNotice('');
    try {
      const created = await replaceCpAsset(token, assetId, {
        mime,
        storage_key: storageKey,
        bytes,
        filename: String(form.get('filename') ?? '').trim() || null,
        hash: String(form.get('hash') ?? '').trim() || null,
      });
      setNotice(`Đã thêm v${created.n} — completed usage giữ asset_version_id cũ`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thay được file');
    } finally {
      setReplacing(false);
    }
  }

  const status = asset?.rights_status;

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Asset</p>
          <h1>Asset — {asset?.filename ?? (loading ? 'Đang tải…' : dash(null))}</h1>
          <p className="cp-muted">Metadata, versions, usage và trạng thái quyền.</p>
        </div>
        <Link className="cp-btn" href="/crm/creative-os/media">Về thư viện</Link>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}
      {notice ? <section className="cp-alert"><p>{notice}</p></section> : null}

      <div className="cp-overview-grid">
        <section className="cp-card">
          <header className="cp-card__head"><h2>Metadata</h2><span className="cp-pill">{dash(asset?.state)}</span></header>
          <dl className="cp-health">
            <div><dt>Filename</dt><dd>{dash(asset?.filename)}</dd></div>
            <div><dt>MIME</dt><dd>{dash(asset?.mime)}</dd></div>
            <div><dt>Bytes</dt><dd>{dash(asset?.bytes)}</dd></div>
            <div><dt>Hash</dt><dd>{dash(asset?.hash)}</dd></div>
            <div><dt>Owner staff</dt><dd>{dash(asset?.owner_staff_id)}</dd></div>
            <div><dt>Agency client</dt><dd>{dash(asset?.agency_client_id)}</dd></div>
            <div><dt>Project</dt><dd>{dash(asset?.project_id)}</dd></div>
            <div><dt>Created</dt><dd>{dash(asset?.created_at)}</dd></div>
          </dl>
        </section>

        <section className="cp-card">
          <header className="cp-card__head"><h2>Rights</h2></header>
          <dl className="cp-health">
            <div><dt>License</dt><dd>{dash(asset?.license_type)}</dd></div>
            <div><dt>Territory</dt><dd>{asset?.territory == null ? dash(asset?.territory) : asset.territory.join(', ')}</dd></div>
            <div><dt>Channels</dt><dd>{asset?.channels == null ? dash(asset?.channels) : asset.channels.join(', ')}</dd></div>
            <div><dt>Model release</dt><dd>{booleanLabel(asset?.model_release)}</dd></div>
            <div><dt>Talent release</dt><dd>{booleanLabel(asset?.talent_release)}</dd></div>
            <div><dt>Expiry</dt><dd>{dash(asset?.expiry_on)}</dd></div>
            <div>
              <dt>Rights status</dt>
              <dd>{status ? <span className={rightsClass(status)}>{status}</span> : dash(null)}</dd>
            </div>
          </dl>
          <Link className="cp-btn" href="/crm/creative-os/media?tab=rights">Mở Rights Center</Link>
        </section>
      </div>

      <section className="cp-card">
        <header className="cp-card__head"><h2>Versions</h2></header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr><th>n</th><th>Storage key</th><th>MIME</th><th>Bytes</th></tr>
            </thead>
            <tbody>
              {versions.length ? versions.map((version) => (
                <tr key={version.id}>
                  <td>v{dash(version.n)}</td>
                  <td>{dash(version.storage_key)}</td>
                  <td>{dash(version.mime)}</td>
                  <td>{dash(version.bytes)}</td>
                </tr>
              )) : (
                <tr><td className="cp-empty" colSpan={4}>{loading ? 'Đang tải…' : dash(null)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <form className="cp-filters" style={{ marginTop: 12 }} onSubmit={(event) => void replace(event)}>
          <label>
            <span>MIME *</span>
            <input name="mime" list="cp-replace-mime" defaultValue={asset?.mime ?? ''} required />
            <datalist id="cp-replace-mime">
              {CP_MIME_ALLOWLIST.map((mime) => <option key={mime} value={mime} />)}
            </datalist>
          </label>
          <label>
            <span>Storage key *</span>
            <input name="storage_key" required />
          </label>
          <label>
            <span>Bytes *</span>
            <input name="bytes" type="number" min="0" step="1" required />
          </label>
          <label>
            <span>Filename</span>
            <input name="filename" defaultValue={asset?.filename ?? ''} />
          </label>
          <label>
            <span>Hash</span>
            <input name="hash" />
          </label>
          <button className="cp-btn cp-btn--primary" type="submit" disabled={replacing || !asset}>
            {replacing ? 'Đang thay…' : 'Replace file'}
          </button>
        </form>
      </section>

      <section className="cp-card">
        <header className="cp-card__head"><h2>Usage graph</h2></header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr><th>Version</th><th>Storage key</th><th>MIME</th><th>Bytes</th><th>Object type</th><th>Object ID</th></tr>
            </thead>
            <tbody>
              {usages.length ? usages.map((usage, index) => (
                <tr key={`${usage.asset_version_id}-${usage.object_type ?? 'none'}-${usage.object_id ?? index}`}>
                  <td>v{dash(usage.n)}</td>
                  <td>{dash(usage.storage_key)}</td>
                  <td>{dash(usage.mime)}</td>
                  <td>{dash(usage.bytes)}</td>
                  <td>{dash(usage.object_type)}</td>
                  <td>{dash(usage.object_id)}</td>
                </tr>
              )) : (
                <tr><td className="cp-empty" colSpan={6}>{loading ? 'Đang tải…' : dash(null)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
