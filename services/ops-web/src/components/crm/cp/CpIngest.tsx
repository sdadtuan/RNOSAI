'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_MIME_ALLOWLIST,
  createCpAsset,
  finalizeCpAsset,
  type CpAsset,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

const MEDIA_TABS = [
  { label: 'Library', href: '/crm/creative-os/media' },
  { label: 'Ingest', href: '/crm/creative-os/media?tab=ingest' },
  { label: 'Collections', href: '/crm/creative-os/media?tab=collections' },
  { label: 'Rights', href: '/crm/creative-os/media?tab=rights' },
  { label: 'Quality', href: '/crm/creative-os/media?tab=quality' },
] as const;

export function CpIngest() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CpAsset | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(formElement);
    const mime = String(form.get('mime') ?? '').trim();
    if (!(CP_MIME_ALLOWLIST as readonly string[]).includes(mime)) {
      setError('mime_not_allowed');
      return;
    }

    setSaving(true);
    setError('');
    setCreated(null);
    try {
      let asset = await createCpAsset(token, {
        agency_client_id: String(form.get('agency_client_id') ?? '').trim(),
        mime,
        filename: String(form.get('filename') ?? '').trim(),
        project_id: String(form.get('project_id') ?? '').trim() || null,
      });
      if (form.get('finalize') === 'on') {
        const rawBytes = String(form.get('bytes') ?? '').trim();
        if (!rawBytes) throw new Error('bytes_required');
        const bytes = Number(rawBytes);
        const hash = String(form.get('hash') ?? '').trim();
        if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid_bytes');
        if (!hash) throw new Error('hash_required');
        asset = await finalizeCpAsset(token, asset.id, { bytes, hash });
      }
      setCreated(asset);
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được asset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Upload &amp; Ingestion</p>
          <h1>Upload &amp; Ingestion</h1>
          <p className="cp-muted">Tạo asset theo MIME allowlist, sau đó finalize khi đã có hash và kích thước.</p>
        </div>
      </header>

      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((tab) => (
          <Link key={tab.href} className={tab.label === 'Ingest' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      {created ? (
        <section className="cp-alert">
          <span>Đã tạo asset {created.filename} · {created.state}</span>
          <Link className="cp-btn" href={`/crm/creative-os/media/${created.id}`}>Chi tiết</Link>
        </section>
      ) : null}

      <form className="cp-card" onSubmit={submit}>
        <div className="cp-filters">
          <label>
            <span>Agency client ID *</span>
            <input name="agency_client_id" required />
          </label>
          <label>
            <span>Filename *</span>
            <input name="filename" required />
          </label>
          <label>
            <span>MIME *</span>
            <input name="mime" list="cp-mime-allowlist" required />
            <datalist id="cp-mime-allowlist">
              {CP_MIME_ALLOWLIST.map((mime) => <option key={mime} value={mime} />)}
            </datalist>
          </label>
          <label>
            <span>Project ID</span>
            <input name="project_id" />
          </label>
        </div>
        <div className="cp-filters" style={{ marginTop: 10 }}>
          <label>
            <span>Finalize sau khi tạo</span>
            <input name="finalize" type="checkbox" style={{ width: 18 }} />
          </label>
          <label>
            <span>Bytes</span>
            <input name="bytes" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Hash</span>
            <input name="hash" />
          </label>
          <button className="cp-btn cp-btn--primary" type="submit" disabled={saving}>
            {saving ? 'Đang xử lý…' : 'Tạo asset'}
          </button>
        </div>
      </form>

      <section className="cp-card">
        <header className="cp-card__head"><h2>Pipeline</h2></header>
        <p className="cp-muted">Trạng thái gần nhất</p>
        <p className="cp-empty">{dash(created?.state)}</p>
      </section>
    </div>
  );
}
