'use client';

import { useState } from 'react';
import { postLeadPresalesClientPlanExport } from '@/lib/api';
import {
  clientPlanPptxBlob,
  downloadNamedBlob,
  showClientPlanExportButton,
} from '@/lib/crm/client-plan-brief.ui';

const STRATEGY_LABELS: Record<string, string> = {
  target_market: 'Thị trường mục tiêu',
  market_message: 'Thông điệp thị trường',
  media_reach: 'Kênh tiếp cận / Media',
  conversion_strategy: 'Chiến lược chuyển đổi',
  retention_system: 'Hệ thống giữ chân',
  nurture_system: 'Nuôi dưỡng lead',
  world_class_experience: 'Trải nghiệm đẳng cấp',
  lifecycle_extension: 'Gia hạn lifecycle',
  referral_engine: 'Giới thiệu / Referral',
};

interface Props {
  planName: string;
  planNorthStar: string;
  planObjectives: string;
  planStrategy: Record<string, string>;
  planValidation: string[];
  stage: 'consult' | 'proposal';
  onEditR5?: () => void;
  token?: string;
  leadId?: number;
  onNotice?: (message: string) => void;
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="presales-r5-preview__field">
      <span className="presales-r5-preview__label">{label}</span>
      <p className="presales-r5-preview__value">{value.trim() || '—'}</p>
    </div>
  );
}

export function PresalesR5PreviewPanel({
  planName,
  planNorthStar,
  planObjectives,
  planStrategy,
  planValidation,
  stage,
  onEditR5,
  token,
  leadId,
  onNotice,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const g4Clear = showClientPlanExportButton(planValidation);
  const canExport = g4Clear && Boolean(token) && Number(leadId) > 0;

  async function onExport() {
    if (!token || !leadId) return;
    setExporting(true);
    try {
      const out = await postLeadPresalesClientPlanExport(token, leadId);
      if (!out.pptx_base64) {
        onNotice?.('Không có file PPTX.');
        return;
      }
      downloadNamedBlob(clientPlanPptxBlob(out.pptx_base64), out.filename);
      if (out.note) onNotice?.(out.note);
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : 'Xuất file thất bại');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="presales-r5-preview stack-gap" id="funnel-presales-r5-preview" aria-label="R5 preview">
      <div className="presales-r5-preview__head">
        <h4 style={{ margin: 0 }}>KH Marketing sơ bộ (R5)</h4>
        {stage === 'proposal' && onEditR5 ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onEditR5}>
            Sửa R5 →
          </button>
        ) : null}
        {stage === 'consult' && onEditR5 ? (
          <button type="button" className="btn btn-sm btn-link" onClick={onEditR5}>
            Chỉnh sửa trên Tổng quan →
          </button>
        ) : null}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Xem nhanh · gate G4 cần R5 đủ trước <strong>Chuyển → Báo giá</strong>.
      </p>
      {planValidation.length > 0 ? (
        <ul
          className="client-plan-brief__missing"
          data-testid="client-plan-g4"
          style={{ margin: 0 }}
        >
          {planValidation.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      <ReadField label="Tên kế hoạch" value={planName} />
      <ReadField label="North Star" value={planNorthStar} />
      <ReadField label="Mục tiêu chiến lược" value={planObjectives} />
      {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
        <ReadField key={key} label={label} value={planStrategy[key] ?? ''} />
      ))}
      {canExport ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="client-plan-export"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            {exporting ? 'Đang tạo file…' : 'Tạo file gửi khách'}
          </button>
        </div>
      ) : g4Clear ? null : (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Đủ gate G4 rồi mới xuất file gửi khách.
        </p>
      )}
    </section>
  );
}
