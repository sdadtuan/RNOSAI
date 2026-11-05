'use client';

import { clientPlanDraftModelLine } from '@/lib/crm/client-plan-brief.ui';

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
  disabled: boolean;
  canEdit: boolean;
  showAiDraftBadge?: boolean;
  aiModel?: string | null;
  onPlanNameChange: (value: string) => void;
  onNorthStarChange: (value: string) => void;
  onObjectivesChange: (value: string) => void;
  onStrategyChange: (key: string, value: string) => void;
  onSave: () => void;
  aiBusy?: boolean;
}

export function PresalesR5PlanForm({
  planName,
  planNorthStar,
  planObjectives,
  planStrategy,
  planValidation,
  disabled,
  canEdit,
  showAiDraftBadge = false,
  aiModel = null,
  onPlanNameChange,
  onNorthStarChange,
  onObjectivesChange,
  onStrategyChange,
  onSave,
  aiBusy = false,
}: Props) {
  const modelLine = clientPlanDraftModelLine(aiModel);
  return (
    <div className="stack-gap" id="funnel-presales-r5" style={{ marginTop: '1rem' }}>
      <h4 style={{ margin: 0 }}>KH Marketing sơ bộ (R5)</h4>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Bắt buộc trước <strong>Chuyển → Báo giá</strong> (gate G4). Solution sửa rồi lưu. AI không đè
        trường đã sửa.
      </p>
      {showAiDraftBadge ? (
        <div
          className="banner banner-warning"
          role="status"
          style={{ margin: 0, fontSize: '0.85rem' }}
          data-testid="presales-r5-ai-draft-badge"
        >
          <strong>Bản nháp — SP duyệt.</strong>{' '}
          <span>
            {modelLine ? `${modelLine} ` : ''}
            Solution sửa trước khi gửi khách. AI không đè chữ đã sửa.
          </span>
        </div>
      ) : null}
      {planValidation.length > 0 && (
        <ul className="muted" style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.1rem' }}>
          {planValidation.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <label>
        Tên kế hoạch
        <input
          type="text"
          value={planName}
          disabled={!canEdit || disabled}
          onChange={(e) => onPlanNameChange(e.target.value)}
          style={{ width: '100%', marginTop: '0.25rem' }}
        />
      </label>
      <label>
        North Star
        <input
          type="text"
          value={planNorthStar}
          disabled={!canEdit || disabled}
          onChange={(e) => onNorthStarChange(e.target.value)}
          style={{ width: '100%', marginTop: '0.25rem' }}
        />
      </label>
      <label>
        Mục tiêu chiến lược
        <textarea
          rows={2}
          value={planObjectives}
          disabled={!canEdit || disabled}
          onChange={(e) => onObjectivesChange(e.target.value)}
          style={{ width: '100%', marginTop: '0.25rem' }}
        />
      </label>
      {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            rows={2}
            value={planStrategy[key] ?? ''}
            disabled={!canEdit || disabled}
            onChange={(e) => onStrategyChange(key, e.target.value)}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
      ))}
      {canEdit && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm" disabled={disabled || aiBusy} onClick={onSave}>
            Lưu KH MKT sơ bộ
          </button>
        </div>
      )}
    </div>
  );
}
