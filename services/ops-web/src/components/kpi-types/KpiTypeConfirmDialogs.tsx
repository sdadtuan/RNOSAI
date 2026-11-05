'use client';

import type { KpiTypeListItem } from '@/lib/kpi-types-api';

export type KpiTypeConfirmState =
  | { kind: 'duplicate'; row: KpiTypeListItem }
  | { kind: 'activate'; row: KpiTypeListItem }
  | { kind: 'deactivate'; row: KpiTypeListItem }
  | { kind: 'delete'; row: KpiTypeListItem }
  | { kind: 'apply-group' }
  | null;

export function KpiTypeConfirmDialogs({
  state,
  busy,
  onClose,
  onConfirm,
}: {
  state: KpiTypeConfirmState;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (state: NonNullable<KpiTypeConfirmState>) => void;
}) {
  if (!state) return null;
  const titles: Record<NonNullable<KpiTypeConfirmState>['kind'], string> = {
    duplicate: 'Nhân bản KPI Type?',
    activate: 'Kích hoạt KPI Type?',
    deactivate: 'Ngừng sử dụng KPI Type?',
    delete: 'Xóa mềm KPI Type?',
    'apply-group': 'Áp dụng gợi ý từ Nhóm KPI?',
  };
  const blockedDelete = state.kind === 'delete' && 'row' in state && state.row.usage_count > 0;
  return (
    <div className="kpi-type-dialog" role="dialog" aria-modal>
      <div className="kpi-type-dialog__card">
        <h3>{titles[state.kind]}</h3>
        {blockedDelete ? (
          <p>Không thể xóa KPI Type đang được sử dụng. Hãy ngừng sử dụng thay vì xóa.</p>
        ) : state.kind === 'apply-group' ? (
          <p>Đổi Nhóm KPI sẽ ghi đè hướng đo / đơn vị gợi ý nếu bạn xác nhận.</p>
        ) : (
          <p>Thao tác này được ghi audit. Bạn có chắc chắn?</p>
        )}
        <div className="kpi-type-dialog__actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          {!blockedDelete ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={() => onConfirm(state)}
            >
              Xác nhận
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
