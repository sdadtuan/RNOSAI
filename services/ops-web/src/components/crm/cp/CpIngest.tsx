'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { FormCombobox } from '@/components/form/FormCombobox';
import { getAccessToken } from '@/lib/auth';
import {
  CP_MIME_ALLOWLIST,
  createCpAsset,
  finalizeCpAsset,
  getCpProjectLookups,
  listCpProjects,
  type CpAsset,
  type CpProjectLookups,
  type CpProjectSummary,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import {
  agencyClientSearchOptions,
  clientIdFromProject,
  filterProjectsForClient,
  parseCpFinalizeInput,
} from '@/lib/crm/cp-media-form.util';
import { projectSearchOptions } from '@/lib/crm/cp-video-list.util';

const MEDIA_TABS = [
  { label: 'Library', href: '/crm/creative-os/media' },
  { label: 'Ingest', href: '/crm/creative-os/media?tab=ingest' },
  { label: 'Collections', href: '/crm/creative-os/media?tab=collections' },
  { label: 'Rights', href: '/crm/creative-os/media?tab=rights' },
  { label: 'Quality', href: '/crm/creative-os/media?tab=quality' },
] as const;

const EMPTY_LOOKUPS: CpProjectLookups = { clients: [], staff: [], lifecycles: [] };

function scopeFrom(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpIngest() {
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CpAsset | null>(null);
  const [lookups, setLookups] = useState<CpProjectLookups>(EMPTY_LOOKUPS);
  const [projects, setProjects] = useState<CpProjectSummary[]>([]);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState(searchParams.get('project') ?? '');

  const clientOptions = useMemo(() => agencyClientSearchOptions(lookups.clients), [lookups.clients]);
  const projectOptions = useMemo(
    () => projectSearchOptions(filterProjectsForClient(projects, clientId)),
    [clientId, projects],
  );

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [lookupOut, projectOut] = await Promise.all([
        getCpProjectLookups(token),
        listCpProjects(token, { scope }),
      ]);
      setLookups(lookupOut);
      setProjects(projectOut.items);
      setProjectId((current) => {
        const next = current || searchParams.get('project') || '';
        if (!next) return '';
        const fromProject = clientIdFromProject(projectOut.items, next);
        if (fromProject) setClientId((prev) => prev || fromProject);
        return next;
      });
    } catch (err) {
      setLookups(EMPTY_LOOKUPS);
      setProjects([]);
      setError(err instanceof Error ? err.message : 'Không tải được khách / project');
    } finally {
      setLoading(false);
    }
  }, [scope, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  function onClientChange(value: string) {
    setClientId(value);
    if (value && clientIdFromProject(projects, projectId) !== value) {
      setProjectId('');
    }
  }

  function onProjectChange(value: string) {
    setProjectId(value);
    const fromProject = clientIdFromProject(projects, value);
    if (fromProject) setClientId(fromProject);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) return;
    if (!clientId.trim()) {
      setError('Chọn khách Agency trước khi tạo asset');
      return;
    }
    const form = new FormData(formElement);
    const mime = String(form.get('mime') ?? '').trim();
    if (!(CP_MIME_ALLOWLIST as readonly string[]).includes(mime)) {
      setError('mime_not_allowed');
      return;
    }
    let finalizeInput: ReturnType<typeof parseCpFinalizeInput>;
    try {
      finalizeInput = parseCpFinalizeInput(
        form.get('finalize') === 'on',
        String(form.get('bytes') ?? ''),
        String(form.get('hash') ?? ''),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'invalid_finalize');
      return;
    }

    setSaving(true);
    setError('');
    setCreated(null);
    try {
      let asset = await createCpAsset(token, {
        agency_client_id: clientId.trim(),
        mime,
        filename: String(form.get('filename') ?? '').trim(),
        project_id: projectId.trim() || null,
      });
      if (finalizeInput) {
        asset = await finalizeCpAsset(token, asset.id, finalizeInput);
      }
      setCreated(asset);
      formElement.reset();
      setClientId('');
      setProjectId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được asset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Upload &amp; Ingestion</p>
          <h1>Upload &amp; Ingestion</h1>
          <p className="cp-muted">
            Tìm khách Agency và project CP — không dán UUID. MIME allowlist, rồi finalize khi đã có hash.
          </p>
        </div>
      </header>

      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((tab) => (
          <Link key={tab.href} className={tab.label === 'Ingest' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}
      {created ? (
        <section className="cp-alert">
          <span>Đã tạo asset {created.filename} · {created.state}</span>
          <Link className="cp-btn" href={`/crm/creative-os/media/${created.id}`}>Chi tiết</Link>
        </section>
      ) : null}

      <form className="cp-card" onSubmit={submit}>
        <div className="cp-filters">
          <label>
            <span>Khách (Agency) *</span>
            <FormCombobox
              value={clientId}
              onChange={onClientChange}
              options={clientOptions}
              loading={loading}
              allowCustom={false}
              showCode={false}
              placeholder="Tìm khách Agency…"
              emptyMessage="Không có khách khớp — tạo trên AM 360"
            />
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
            <span>Project</span>
            <FormCombobox
              value={projectId}
              onChange={onProjectChange}
              options={projectOptions}
              loading={loading}
              allowCustom={false}
              showCode={false}
              placeholder="Tìm project CP…"
              emptyMessage="Không có project khớp — tạo ở Dự án"
            />
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
          <button className="cp-btn cp-btn--primary" type="submit" disabled={saving || loading || !clientId}>
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
