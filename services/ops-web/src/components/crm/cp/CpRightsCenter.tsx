'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  listCpAssets,
  setCpAssetRights,
  type CpAsset,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash, rightsStatus } from '@/lib/crm/cp-format';

const MEDIA_TABS = [
  { label: 'Library', href: '/crm/creative-os/media' },
  { label: 'Ingest', href: '/crm/creative-os/media?tab=ingest' },
  { label: 'Collections', href: '/crm/creative-os/media?tab=collections' },
  { label: 'Rights', href: '/crm/creative-os/media?tab=rights' },
  { label: 'Quality', href: '/crm/creative-os/media?tab=quality' },
] as const;

function scopeFrom(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function rightsPill(expiry: string | null | undefined) {
  const status = rightsStatus(expiry);
  if (!status) return dash(null);
  const className = status === 'block'
    ? 'cp-pill cp-pill--danger'
    : status === 'warn'
      ? 'cp-pill cp-pill--warning'
      : 'cp-pill';
  return <span className={className}>{status}</span>;
}

function commaList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function CpRightsCenter() {
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [assets, setAssets] = useState<CpAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setAssets((await listCpAssets(token, scope)).items);
    } catch (err) {
      setAssets([]);
      setError(err instanceof Error ? err.message : 'Không tải được quyền tài nguyên');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(formElement);
    const assetId = String(form.get('asset_id') ?? '');
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await setCpAssetRights(token, assetId, {
        license_type: String(form.get('license_type') ?? '').trim() || null,
        owner_name: String(form.get('owner_name') ?? '').trim() || null,
        effective_on: String(form.get('effective_on') ?? '') || null,
        expiry_on: String(form.get('expiry_on') ?? '') || null,
        territory: commaList(form.get('territory')),
        channels: commaList(form.get('channels')),
        restriction: String(form.get('restriction') ?? '').trim() || null,
        model_release: form.get('model_release') === 'on',
        talent_release: form.get('talent_release') === 'on',
        proof_asset_id: String(form.get('proof_asset_id') ?? '').trim() || null,
      });
      setNotice('Đã cập nhật quyền tài nguyên.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được quyền');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Asset Rights Center</p>
          <h1>Asset Rights Center</h1>
          <p className="cp-muted">Theo dõi expiry và cập nhật metadata quyền sử dụng.</p>
        </div>
      </header>

      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((tab) => (
          <Link key={tab.href} className={tab.label === 'Rights' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}
      {notice ? <section className="cp-alert"><span>{notice}</span></section> : null}

      <section className="cp-card">
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Asset</th><th>License</th><th>Territory</th><th>Channel</th>
                <th>Expiry</th><th>Release</th><th>Policy</th>
              </tr>
            </thead>
            <tbody>
              {assets.length ? assets.map((asset) => (
                <tr key={asset.id}>
                  <td><Link className="cp-link" href={`/crm/creative-os/media/${asset.id}`}>{dash(asset.filename)}</Link></td>
                  <td>{dash(null)}</td>
                  <td>{dash(null)}</td>
                  <td>{dash(null)}</td>
                  <td>{dash(asset.expiry_on)}</td>
                  <td>{dash(null)}</td>
                  <td>{rightsPill(asset.expiry_on)}</td>
                </tr>
              )) : (
                <tr><td className="cp-empty" colSpan={7}>{loading ? 'Đang tải…' : dash(null)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <form className="cp-card" onSubmit={saveRights}>
        <header className="cp-card__head"><h2>Cập nhật rights</h2></header>
        {assets.length ? (
          <>
            <div className="cp-filters">
              <label><span>Asset *</span><select name="asset_id" required>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select></label>
              <label><span>License</span><input name="license_type" /></label>
              <label><span>Owner</span><input name="owner_name" /></label>
              <label><span>Effective</span><input name="effective_on" type="date" /></label>
              <label><span>Expiry</span><input name="expiry_on" type="date" /></label>
              <label><span>Proof asset ID</span><input name="proof_asset_id" /></label>
            </div>
            <div className="cp-filters" style={{ marginTop: 10 }}>
              <label><span>Territory (phân cách dấu phẩy)</span><input name="territory" /></label>
              <label><span>Channels (phân cách dấu phẩy)</span><input name="channels" /></label>
              <label><span>Restriction</span><input name="restriction" /></label>
              <label><span>Model release</span><input name="model_release" type="checkbox" style={{ width: 18 }} /></label>
              <label><span>Talent release</span><input name="talent_release" type="checkbox" style={{ width: 18 }} /></label>
              <button className="cp-btn cp-btn--primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu rights'}</button>
            </div>
          </>
        ) : (
          <>
            <p className="cp-muted">Chưa có dữ liệu</p>
            <p className="cp-empty">{dash(null)}</p>
          </>
        )}
      </form>
    </div>
  );
}
