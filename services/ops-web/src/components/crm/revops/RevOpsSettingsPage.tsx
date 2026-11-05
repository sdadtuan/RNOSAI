'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchRevopsSettings, type RevopsSettingsDto } from '@/lib/crm/revops-api';
import { RevOpsQuickCreateButton } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';

function integrationTagClass(status: string): string {
  if (status === 'healthy') return 'revops-tag revops-tag--green';
  if (status === 'warning') return 'revops-tag revops-tag--orange';
  if (status === 'critical') return 'revops-tag revops-tag--red';
  return 'revops-tag revops-tag--gray';
}

function severityTagClass(severity: 'critical' | 'warning'): string {
  return severity === 'critical' ? 'revops-tag revops-tag--red' : 'revops-tag revops-tag--orange';
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN');
}

export function RevOpsSettingsPage() {
  const { token } = useRevopsPage();
  const [data, setData] = useState<RevopsSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchRevopsSettings(token));
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>Cấu hình & Audit</h1>
          <p>Quản trị tổ chức, người dùng, role, data quality, integration và audit trail.</p>
        </div>
        <div className="revops-page-actions">
          {data ? (
            <Link href={data.adminLinks.auditExport} className="revops-btn">
              Audit export
            </Link>
          ) : (
            <span className="revops-btn" aria-disabled>
              Audit export
            </span>
          )}
          <button type="button" className="revops-btn revops-btn--primary" disabled title="Workflow builder — sau W4">
            ＋ Tạo workflow
          </button>
          <RevOpsQuickCreateButton />
        </div>
      </header>

      {loading ? <p className="revops-muted">Đang tải…</p> : null}
      {error ? <p className="revops-error">{error}</p> : null}

      {data ? (
        <>
          <div className="revops-grid-3">
            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Organization & users</h2>
                <span className="revops-tag revops-tag--blue">
                  {data.org.activeUsers ?? '—'} active
                </span>
              </div>
              <ul className="revops-list">
                <li className="revops-list-row">
                  <div>
                    <b>Business Units</b>
                    <p className="revops-muted">{data.org.businessUnits ?? '—'} active business units</p>
                  </div>
                  <Link href={data.adminLinks.departments} className="revops-btn revops-btn--sm">
                    Manage
                  </Link>
                </li>
                <li className="revops-list-row">
                  <div>
                    <b>Teams & hierarchy</b>
                    <p className="revops-muted">{data.org.teams ?? '—'} teams</p>
                  </div>
                  <Link href={data.adminLinks.teams} className="revops-btn revops-btn--sm">
                    Manage
                  </Link>
                </li>
                <li className="revops-list-row">
                  <div>
                    <b>User lifecycle</b>
                    <p className="revops-muted">
                      {data.org.pendingLifecycle ?? '—'} users pending deactivation reassignment
                    </p>
                  </div>
                  <Link href={data.adminLinks.users} className="revops-btn revops-btn--sm">
                    Review
                  </Link>
                </li>
              </ul>
            </section>

            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Data quality center</h2>
                <span className="revops-tag revops-tag--orange">{data.dataQuality.totalIssues} issues</span>
              </div>
              <ul className="revops-list">
                {data.dataQuality.issues.map((issue) => (
                  <li key={issue.key} className="revops-list-row">
                    <div>
                      <b>{issue.label}</b>
                      <p className="revops-muted">{issue.count} records</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={severityTagClass(issue.severity)}>{issue.severity}</span>
                      {issue.href ? (
                        <Link href={issue.href} className="revops-btn revops-btn--sm">
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Integration health</h2>
                <span className="revops-tag revops-tag--green">
                  {data.integrations.healthyCount} / {data.integrations.totalCount} healthy
                </span>
              </div>
              <ul className="revops-list">
                {data.integrations.items.map((item) => (
                  <li key={item.key} className="revops-list-row">
                    <div>
                      <b>{item.label}</b>
                      <p className="revops-muted">{item.detail}</p>
                    </div>
                    <span className={integrationTagClass(item.status)}>{item.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="revops-grid-2" style={{ marginTop: '1.5rem' }}>
            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Role permission matrix</h2>
                <Link href={data.adminLinks.permissions} className="revops-btn revops-btn--sm">
                  Edit role
                </Link>
              </div>
              <table className="revops-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Sales</th>
                    <th>AE/AM</th>
                    <th>Team Lead</th>
                    <th>Finance</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roleMatrix.map((row) => (
                    <tr key={row.module}>
                      <td>{row.module}</td>
                      <td>{row.sales}</td>
                      <td>{row.aeAm}</td>
                      <td>{row.teamLead}</td>
                      <td>{row.finance}</td>
                      <td>{row.admin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="revops-panel">
              <div className="revops-panel-head">
                <h2>Recent audit log</h2>
                <Link href={data.adminLinks.audit} className="revops-btn revops-btn--sm">
                  View all
                </Link>
              </div>
              {data.auditTimeline.length === 0 ? (
                <p className="revops-muted">Chưa có audit event crm_revops.</p>
              ) : (
                <ul className="revops-list">
                  {data.auditTimeline.map((event) => (
                    <li key={event.id} className="revops-list-row">
                      <div>
                        <b>{event.title}</b>
                        <p className="revops-muted">{formatAuditTime(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className="revops-muted" style={{ marginTop: '1rem' }}>
            RBAC admin:{' '}
            <Link href={data.adminLinks.permissions}>{data.adminLinks.permissions}</Link> · dữ liệu lúc{' '}
            {new Date(data.fetchedAt).toLocaleString('vi-VN')}
          </p>
        </>
      ) : null}
    </>
  );
}
