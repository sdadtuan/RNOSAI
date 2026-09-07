'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createKit,
  listKits,
  type CpBrandKit,
  type CpBrandScopeType,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function parseScope(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpBrandPortfolio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [kits, setKits] = useState<CpBrandKit[]>([]);
  const [scopeType, setScopeType] = useState<CpBrandScopeType>('tenant');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      const result = await listKits(token, scope);
      setKits(result.items);
    } catch (err) {
      setKits([]);
      setError(err instanceof Error ? err.message : 'Không tải được Brand Kit');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }

    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const agencyClientId = String(form.get('agency_client_id') ?? '').trim();
    const projectId = String(form.get('project_id') ?? '').trim();
    if (!name) {
      setError('Tên Brand Kit là bắt buộc');
      return;
    }
    if (scopeType === 'client' && !agencyClientId) {
      setError('Agency client ID là bắt buộc cho phạm vi khách hàng');
      return;
    }
    if (scopeType === 'project' && !projectId) {
      setError('Project ID là bắt buộc cho phạm vi project');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const kit = await createKit(token, {
        name,
        scope_type: scopeType,
        agency_client_id: scopeType === 'client' ? agencyClientId : null,
        project_id: scopeType === 'project' ? projectId : null,
      });
      router.push(`/crm/creative-os/brand-kits/${kit.id}?tab=editor`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được Brand Kit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Brand Kit</p>
          <h1>Brand Kit Portfolio</h1>
          <p className="cp-muted">Quản lý bộ nhận diện theo tenant, khách hàng hoặc project.</p>
        </div>
      </header>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}

      <section className="cp-card">
        <div className="cp-card__head">
          <div>
            <h2>Tạo Brand Kit</h2>
            <p className="cp-muted">Chọn đúng phạm vi áp dụng trước khi tạo.</p>
          </div>
        </div>
        <form className="cp-filters" onSubmit={submit}>
          <label>
            <span>Tên *</span>
            <input name="name" required />
          </label>
          <label>
            <span>Phạm vi</span>
            <select
              name="scope_type"
              value={scopeType}
              onChange={(event) => setScopeType(event.target.value as CpBrandScopeType)}
            >
              <option value="tenant">Tenant</option>
              <option value="client">Khách hàng</option>
              <option value="project">Project</option>
            </select>
          </label>
          {scopeType === 'client' ? (
            <label>
              <span>Agency client ID *</span>
              <input name="agency_client_id" required />
            </label>
          ) : null}
          {scopeType === 'project' ? (
            <label>
              <span>Project ID *</span>
              <input name="project_id" required />
            </label>
          ) : null}
          <button className="cp-btn cp-btn--primary" type="submit" disabled={submitting}>
            {submitting ? 'Đang tạo…' : 'Tạo Brand Kit'}
          </button>
        </form>
      </section>

      <section className="cp-card" aria-busy={loading}>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Kit</th>
                <th>Scope</th>
                <th>Đối tượng</th>
                <th>Phiên bản mới nhất</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {kits.length ? kits.map((kit) => (
                <tr key={kit.id}>
                  <td>
                    <Link
                      className="cp-link"
                      href={`/crm/creative-os/brand-kits/${kit.id}?tab=editor`}
                    >
                      {dash(kit.name)}
                    </Link>
                  </td>
                  <td>{dash(kit.scope_type)}</td>
                  <td>{dash(kit.agency_client_id ?? kit.project_id)}</td>
                  <td>{kit.latest_version == null ? dash(null) : `v${kit.latest_version}`}</td>
                  <td><span className="cp-pill">{dash(kit.status)}</span></td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={5}>{loading ? 'Đang tải…' : dash(null)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
