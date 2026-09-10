'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PortfolioCommandCenter, PortfolioRiskQueueItem } from '@/lib/crm/cmkte-api';
import { cmktePath } from '@/lib/crm/cmkte-routes';
import { CmktERequestModal } from './CmktERequestModal';

const EMPTY_COPY = 'Chưa có throughput tuần này và hàng đợi rủi ro trống.';

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function pctLabel(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

function slaLabel(hours: number | null): string {
  return hours == null ? '—' : `${hours}h`;
}

function riskTitle(row: PortfolioRiskQueueItem): string {
  return `${dash(row.content_code)} · ${dash(row.title)}`;
}

export function CmktECommandCenter({ data }: { data: PortfolioCommandCenter }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const empty = data.throughput_week === 0 && data.risk_queue.length === 0;
  const approvedInsight = data.insight?.status === 'Approved' ? data.insight : null;

  return (
    <div className="cmkte-cmd">
      <div className="cmkte-head">
        <div>
          <h1>Content Operations Command Center</h1>
          <p>Kiểm soát throughput, SLA, rủi ro và năng lực sản xuất trên toàn bộ client portfolio.</p>
        </div>
        <div className="cmkte-actions">
          <Link href={cmktePath('calendar')} className="cmkte-btn">
            Mở Publication Control
          </Link>
          <button type="button" className="cmkte-btn cmkte-btn--blue" onClick={() => setRequestOpen(true)}>
            ＋ Tạo Content Item
          </button>
        </div>
      </div>

      {empty ? <p className="cmkte-empty">{EMPTY_COPY}</p> : null}

      <div className="cmkte-grid3">
        <div className="cmkte-card">
          <div className="cmkte-metricrow">
            <span>Content throughput · Tuần này</span>
          </div>
          <b className="cmkte-metric">{data.throughput_week}</b>
          <p className="cmkte-desc">
            {data.completed_week} hoàn tất · {data.wip} đang trong production.
          </p>
        </div>
        <div className="cmkte-card">
          <div className="cmkte-metricrow">
            <span>Approval SLA at risk</span>
            {data.sla_at_risk > 0 || data.sla_breached > 0 ? (
              <b className="cmkte-metricrow__warn">Cần xử lý</b>
            ) : null}
          </div>
          <b className="cmkte-metric">{data.sla_at_risk}</b>
          <p className="cmkte-desc">
            {data.sla_breached} đã vượt SLA · {data.blocked} bị chặn.
          </p>
        </div>
        <div className="cmkte-card">
          <div className="cmkte-metricrow">
            <span>Team capacity</span>
            <b>{pctLabel(data.capacity_pct)}</b>
          </div>
          {data.capacity_pct == null ? (
            <p className="cmkte-desc">Chưa có time tracking</p>
          ) : (
            <div className="cmkte-bar" aria-hidden>
              <i style={{ width: `${Math.max(0, Math.min(100, data.capacity_pct))}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="cmkte-layout">
        <div className="cmkte-card">
          <div className="cmkte-queuehead">
            <div>
              <h3>Operational risk queue</h3>
              <p className="cmkte-desc">Ưu tiên theo SLA, risk level và critical path dependency.</p>
            </div>
            <Link href={cmktePath('approvals')} className="cmkte-btn cmkte-btn--small">
              Mở Approval Center
            </Link>
          </div>
          <div className="cmkte-table-scroll">
            <table className="cmkte-table">
              <thead>
                <tr>
                  <th>Content / Client</th>
                  <th>Risk signal</th>
                  <th>Current owner</th>
                  <th>SLA</th>
                  <th>Recommended action</th>
                </tr>
              </thead>
              <tbody>
                {data.risk_queue.map((row) => {
                  const href = cmktePath('workspace', row.item_id);
                  return (
                    <tr key={row.item_id}>
                      <td>
                        <Link href={href} className="cmkte-taskname">
                          {riskTitle(row)}
                        </Link>
                        <span className="cmkte-dep">{dash(row.client_label)}</span>
                      </td>
                      <td>{dash(row.risk_signal)}</td>
                      <td>{dash(row.owner_label)}</td>
                      <td>{slaLabel(row.sla_remaining_h)}</td>
                      <td>
                        <Link href={href} className="cmkte-btn cmkte-btn--small">
                          {dash(row.recommended_action)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="cmkte-right">
          <div className="cmkte-card">
            <h3>Approval health</h3>
            <div className="cmkte-metricrow">
              <span>First-pass approval rate</span>
              <b>{pctLabel(data.first_pass_pct)}</b>
            </div>
            {data.first_pass_pct == null ? (
              <p className="cmkte-desc">Chưa có time tracking</p>
            ) : (
              <div className="cmkte-bar" aria-hidden>
                <i
                  style={{
                    width: `${Math.max(0, Math.min(100, data.first_pass_pct))}%`,
                    background: 'var(--green)',
                  }}
                />
              </div>
            )}
          </div>
          {approvedInsight ? (
            <div className="cmkte-card">
              <h3>AI insight of the week</h3>
              <div className="cmkte-notice">
                {approvedInsight.title ? <b>{approvedInsight.title}</b> : null}
                {approvedInsight.body ? <span>{approvedInsight.body}</span> : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <CmktERequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
