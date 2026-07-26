'use client';

import Link from 'next/link';
import type { PipelineRiskDealRow } from '@/lib/ai-api';

const SCORE_BAND_LABELS: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
};

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export function PipelineRiskPanel({
  rows,
  total,
  lastScanAt,
}: {
  rows: PipelineRiskDealRow[];
  total: number;
  lastScanAt: string | null;
}) {
  return (
    <section className="ai-insights-page__section pipeline-risk-panel" data-testid="pipeline-risk-panel">
      <div className="pipeline-risk-panel__head">
        <h3 className="kpi-section-title">At-risk deals ({total})</h3>
        {lastScanAt ? (
          <p className="muted pipeline-risk-panel__meta">Lần quét gần nhất: {formatWhen(lastScanAt)}</p>
        ) : (
          <p className="muted pipeline-risk-panel__meta">Chưa có lần quét — cron RNOS-23 chạy hàng ngày.</p>
        )}
      </div>

      {!rows.length ? (
        <p className="muted">Không có deal at-risk (≥7 ngày không activity).</p>
      ) : (
        <div className="ai-insights-table-wrap">
          <table className="ai-insights-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Stage</th>
                <th>Đứng im</th>
                <th>Điểm</th>
                <th>Band</th>
                <th>Quét lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.recommendation_id}>
                  <td>
                    <Link href={`/crm/sales?deal_id=${row.deal_id}`} className="pipeline-risk-panel__deal-link">
                      {row.title}
                    </Link>
                  </td>
                  <td>{row.pipeline_stage || '—'}</td>
                  <td>{row.stalled_days} ngày</td>
                  <td>{row.deal_score}</td>
                  <td>{SCORE_BAND_LABELS[row.score_band] ?? row.score_band}</td>
                  <td>{formatWhen(row.scanned_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
