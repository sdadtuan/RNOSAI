'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRevopsApprovals,
  type RevopsApprovalItem,
  type RevopsApprovalKind,
  type RevopsApprovalsDto,
} from '@/lib/crm/revops-api';
import { RevOpsQuickCreateButton } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';
import { RevOpsApprovalModal } from './modals/RevOpsApprovalModal';

const TYPE_FILTERS: Array<{ value: 'all' | RevopsApprovalKind; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'discount', label: 'Discount' },
  { value: 'commission', label: 'Commission / KPI' },
  { value: 'clawback', label: 'Clawback' },
  { value: 'account_reassignment', label: 'Account reassignment' },
];

const KIND_TAG: Record<RevopsApprovalKind, string> = {
  discount: 'Discount',
  commission: 'Commission',
  clawback: 'Clawback',
  account_reassignment: 'Account reassignment',
};

export function RevOpsApprovalsPage() {
  const { token } = useRevopsPage();
  const [data, setData] = useState<RevopsApprovalsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | RevopsApprovalKind>('all');
  const [selected, setSelected] = useState<RevopsApprovalItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchRevopsApprovals(token);
      setData(out);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được Approval Center');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredQueue = useMemo(() => {
    const queue = data?.queue ?? [];
    if (typeFilter === 'all') return queue;
    return queue.filter((item) => item.kind === typeFilter);
  }, [data?.queue, typeFilter]);

  function openReview(item: RevopsApprovalItem) {
    setSelected(item);
    setModalOpen(true);
  }

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>Approval Center</h1>
          <p>Hàng đợi phê duyệt thống nhất — Discount, Commission, Clawback, Account reassignment.</p>
        </div>
        <div className="revops-page-actions">
          <RevOpsQuickCreateButton />
        </div>
      </header>

      {loading && !data ? <p className="revops-muted">Đang tải approvals…</p> : null}
      {error ? (
        <div className="revops-widget revops-widget--error">
          <p>{error}</p>
          <button type="button" className="revops-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="revops-kpi-grid revops-section">
            <article className="revops-metric-card">
              <p className="revops-metric-label">Waiting for me</p>
              <p className="revops-metric-value">{data.kpis.waitingForMe}</p>
            </article>
            <article className="revops-metric-card">
              <p className="revops-metric-label">Pending all</p>
              <p className="revops-metric-value">{data.kpis.pendingAll}</p>
            </article>
            <article className="revops-metric-card">
              <p className="revops-metric-label">Approved today</p>
              <p className="revops-metric-value">{data.kpis.approvedToday}</p>
            </article>
            <article className="revops-metric-card">
              <p className="revops-metric-label">Overdue</p>
              <p className="revops-metric-value">{data.kpis.overdue}</p>
            </article>
          </div>

          <div className="revops-tabs revops-section">
            {TYPE_FILTERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`revops-tab${typeFilter === opt.value ? ' is-active' : ''}`}
                onClick={() => setTypeFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <section className="revops-card revops-section" data-testid="revops-approvals-queue">
            <header className="revops-card__head">
              <h3>Approval Queue</h3>
              <span className="revops-tag revops-tag--blue">{filteredQueue.length} requests</span>
            </header>
            <div className="revops-table-wrap">
              <table className="revops-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th>Related record</th>
                    <th>Requested by</th>
                    <th>Amount/Impact</th>
                    <th>Current step</th>
                    <th>Due</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="revops-muted">
                        {typeFilter === 'discount' ||
                        typeFilter === 'clawback' ||
                        typeFilter === 'account_reassignment'
                          ? 'Chưa có nguồn (Wave 3+)'
                          : '—'}
                      </td>
                    </tr>
                  ) : (
                    filteredQueue.map((item) => (
                      <tr key={`${item.sourceKind}-${item.id}`}>
                        <td>
                          {item.href ? (
                            <Link className="revops-link" href={item.href}>
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </td>
                        <td>
                          <span className="revops-tag revops-tag--gray">{KIND_TAG[item.kind]}</span>
                          <div className="revops-sub">{item.typeLabel}</div>
                        </td>
                        <td>{item.relatedRecord}</td>
                        <td>{item.requestedBy}</td>
                        <td>{item.amountImpact ?? '—'}</td>
                        <td>{item.currentStep}</td>
                        <td>{item.dueAt?.slice(0, 10) ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="revops-btn revops-btn--sm"
                            onClick={() => openReview(item)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="revops-card revops-section" data-testid="revops-discount-matrix">
            <header className="revops-card__head">
              <h3>Discount approval matrix</h3>
              <span className="revops-tag revops-tag--gray">Read-only W2</span>
            </header>
            <div className="revops-table-wrap">
              <table className="revops-table revops-table--compact">
                <thead>
                  <tr>
                    <th>Mức chiết khấu</th>
                    <th>Luồng phê duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.discountMatrix.map((row) => (
                    <tr key={row.band}>
                      <td>
                        <b>{row.band}</b>
                      </td>
                      <td>{row.steps.join(' → ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="revops-muted revops-approval-hint">
              Delegation · Segregation of duties · Escalation — cấu hình đầy đủ ở Wave 4.
            </p>
          </section>

          <p className="revops-muted revops-freshness">
            Dữ liệu lúc {new Date(data.fetchedAt).toLocaleString('vi-VN')}
          </p>
        </>
      ) : null}

      <RevOpsApprovalModal
        open={modalOpen}
        token={token}
        item={selected}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        onDone={() => void load()}
      />
    </>
  );
}
