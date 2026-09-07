'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_TEMPLATE_REQUIRED_VARS,
  createCpTemplate,
  formatCpApiError,
  listCpTemplates,
  publishCpTemplate,
  useCpTemplate,
  type CpScope,
  type CpTemplate,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function parseScope(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function variableCount(value: unknown): string | number {
  return Array.isArray(value) ? value.length : dash(null);
}

export function CpTemplates() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [items, setItems] = useState<CpTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
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
      setItems((await listCpTemplates(token)).items);
    } catch (caught) {
      setItems([]);
      setError(formatCpApiError(caught, 'Không tải được mẫu video'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const extra = String(form.get('extra') ?? '')
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    setBusy('create');
    setError('');
    try {
      await createCpTemplate(token, {
        name: String(form.get('name') ?? '').trim(),
        variables: [...CP_TEMPLATE_REQUIRED_VARS, ...extra],
        brand_kit_id: String(form.get('brand_kit_id') ?? '').trim() || null,
        rules_json: { unit_credits: 1 },
      });
      event.currentTarget.reset();
      await load();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tạo được mẫu'));
    } finally {
      setBusy('');
    }
  }

  async function publish(id: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusy(`publish:${id}`);
    setError('');
    try {
      await publishCpTemplate(token, id);
      await load();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không xuất bản được mẫu'));
    } finally {
      setBusy('');
    }
  }

  async function useTemplate(event: FormEvent<HTMLFormElement>, template: CpTemplate) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setBusy(`use:${template.id}`);
    setError('');
    try {
      const draft = await useCpTemplate(token, template.id, {
        project_id: String(form.get('project_id') ?? '').trim(),
        name: String(form.get('name') ?? '').trim() || template.name,
      }, scope);
      router.push(`/crm/creative-os/video/${draft.id}?scope=${scope}`);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tạo được draft từ mẫu'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Video AI</p>
          <h1>Mẫu video</h1>
          <p className="cp-muted">Biến bắt buộc: {CP_TEMPLATE_REQUIRED_VARS.map((name) => `{{${name}}}`).join(' ')}</p>
        </div>
        <div className="cp-actions">
          <Link className="cp-btn" href={`/crm/creative-os/video?scope=${scope}`}>Video drafts</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/batch?scope=${scope}`}>Tạo hàng loạt</Link>
        </div>
      </header>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      <section className="cp-card">
        <div className="cp-card__head"><h2>Tạo mẫu</h2></div>
        <form className="cp-filters" onSubmit={create}>
          <label><span>Tên mẫu</span><input name="name" required /></label>
          <label><span>Brand kit ID</span><input name="brand_kit_id" /></label>
          <label><span>Biến thêm</span><input name="extra" placeholder="persona" /></label>
          <button className="cp-btn cp-btn--primary" type="submit" disabled={busy === 'create'}>
            {busy === 'create' ? 'Đang tạo…' : 'Tạo template'}
          </button>
        </form>
      </section>
      <section className="cp-card">
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Ver</th>
                <th>Biến</th>
                <th>Brand lock</th>
                <th>Status</th>
                <th>Dùng</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((item) => (
                <tr key={item.id}>
                  <td>{dash(item.name)}</td>
                  <td>{dash(item.version)}</td>
                  <td>{variableCount(item.variables_json)}</td>
                  <td>{dash(item.brand_kit_id)}</td>
                  <td>{dash(item.status)}</td>
                  <td>
                    {item.status === 'draft' ? (
                      <button
                        className="cp-btn"
                        type="button"
                        disabled={busy === `publish:${item.id}`}
                        onClick={() => void publish(item.id)}
                      >
                        Xuất bản
                      </button>
                    ) : (
                      <form className="cp-inline-form" onSubmit={(event) => void useTemplate(event, item)}>
                        <input name="project_id" placeholder="Project ID" required />
                        <input name="name" placeholder="Tên draft" />
                        <button className="cp-btn cp-btn--primary" type="submit" disabled={busy === `use:${item.id}`}>
                          Dùng
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={6}>{loading ? 'Đang tải…' : dash(null)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
