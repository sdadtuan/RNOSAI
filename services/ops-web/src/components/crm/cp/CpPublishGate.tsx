'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  getCpPublishGate,
  listCpPublishVersions,
  type CpPublishGate,
  type CpPublishVersion,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function scopeFrom(value?: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpPublishGate({
  scope: scopeValue,
  versionId: initialVersionId,
}: {
  scope?: string | null;
  versionId?: string | null;
}) {
  const scope = scopeFrom(scopeValue);
  const [versions, setVersions] = useState<CpPublishVersion[]>([]);
  const [versionId, setVersionId] = useState(initialVersionId ?? '');
  const [gate, setGate] = useState<CpPublishGate | null>(null);
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
      const listed = await listCpPublishVersions(token, scope);
      setVersions(listed.items);
      const selected = versionId || listed.items[0]?.id || '';
      if (!versionId && selected) setVersionId(selected);
      if (selected) {
        setGate(await getCpPublishGate(token, selected, scope));
      } else {
        setGate(null);
      }
    } catch (caught) {
      setGate(null);
      setError(formatCpApiError(caught, 'Không tải được gate'));
    } finally {
      setLoading(false);
    }
  }, [scope, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="cp-card">
      <div className="cp-card__head">
        <h2>Approval Gate</h2>
        <p className="cp-muted">QC · Brand · Client · Legal · scheduled · lock reason</p>
      </div>
      <label className="cp-field">
        <span>Video version</span>
        <select
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
          aria-label="Video version"
        >
          <option value="">{dash(null)}</option>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.draft_name || version.id} · {version.approval_status}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="cp-card--error">{error}</p> : null}
      {loading ? <p className="cp-muted">Đang tải…</p> : null}
      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Hạng mục</th>
              <th>Kết quả</th>
              <th>Lock</th>
            </tr>
          </thead>
          <tbody>
            {(gate?.items ?? []).length ? gate!.items.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{dash(row.result)}</td>
                <td>
                  {row.lock ? (
                    <span className="cp-pill cp-pill--danger">{row.lock}</span>
                  ) : dash(null)}
                </td>
              </tr>
            )) : (
              <tr>
                <td className="cp-empty" colSpan={3}>{dash(null)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
