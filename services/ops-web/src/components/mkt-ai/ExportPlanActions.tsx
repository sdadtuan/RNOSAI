'use client';

import { canExportFormat, getQualityTier } from '@/lib/mkt-ai-quality-labels';
import type { QualityScoreView } from '@/components/mkt-ai/AiQualityScoreCard';

interface Props {
  quality: QualityScoreView | null | undefined;
  canExport: boolean;
  busy?: boolean;
  onExport: (format: 'pdf' | 'docx' | 'xlsx') => void;
}

export function ExportPlanActions({ quality, canExport, busy = false, onExport }: Props) {
  const score = quality?.score;
  const tier = getQualityTier(score);

  if (!canExport) {
    return (
      <section style={{ display: 'grid', gap: '0.35rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Export kế hoạch</h4>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Cần quyền <code>crm_mkt_ai.export</code> để tải file.
        </p>
      </section>
    );
  }

  const formats: Array<{ id: 'pdf' | 'docx' | 'xlsx'; label: string; hint?: string }> = [
    { id: 'pdf', label: 'PDF Kế hoạch' },
    { id: 'docx', label: 'DOCX' },
    { id: 'xlsx', label: 'Excel KPI tree', hint: 'CSV stub P0' },
  ];

  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Export kế hoạch</h4>
      {tier === 'blocked' ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Export bị khóa khi quality &lt;60. Hoàn thiện brief, ICP và campaign trước.
        </p>
      ) : tier === 'conditional' ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Điểm 60–69: chỉ export DOCX (BR-MKTP-05).
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {formats.map((f) => {
          const enabled = canExportFormat(f.id, score);
          return (
            <button
              key={f.id}
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy || !enabled}
              title={
                !enabled && tier === 'conditional'
                  ? 'Chỉ DOCX khi điểm 60–69'
                  : !enabled
                    ? 'Cần quality ≥60'
                    : f.hint
              }
              onClick={() => onExport(f.id)}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
