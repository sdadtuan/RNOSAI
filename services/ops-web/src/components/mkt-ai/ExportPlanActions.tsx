'use client';

import { canExportFormat, getQualityTier } from '@/lib/mkt-ai-quality-labels';
import type { QualityScoreView } from '@/components/mkt-ai/AiQualityScoreCard';

interface Props {
  quality: QualityScoreView | null | undefined;
  canExport: boolean;
  approvalRequired?: boolean;
  approvalCanExport?: boolean;
  busy?: boolean;
  onExport: (format: 'pdf' | 'docx' | 'xlsx') => void;
}

export function ExportPlanActions({
  quality,
  canExport,
  approvalRequired = false,
  approvalCanExport = true,
  busy = false,
  onExport,
}: Props) {
  const score = quality?.score;
  const tier = getQualityTier(score);
  const exportBlockedByApproval = approvalRequired && !approvalCanExport;

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
    { id: 'pdf', label: 'PDF Kế hoạch', hint: 'Tóm tắt chiến lược + campaigns + lịch' },
    { id: 'docx', label: 'DOCX', hint: 'Bản chỉnh sửa đầy đủ trong Word' },
    { id: 'xlsx', label: 'Excel KPI tree', hint: 'Sheets KPI + campaigns + TMMT' },
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
      ) : exportBlockedByApproval ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Export cần MKT Lead duyệt trước (BR-MKTP-09). Gửi duyệt trên thanh phía trên.
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {formats.map((f) => {
          const enabled = canExportFormat(f.id, score) && !exportBlockedByApproval;
          return (
            <button
              key={f.id}
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy || !enabled}
              title={
                exportBlockedByApproval
                  ? 'Cần MKT Lead duyệt trước khi export'
                  : !canExport
                    ? 'Cần quyền crm_mkt_ai.export'
                    : !enabled && tier === 'conditional'
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
