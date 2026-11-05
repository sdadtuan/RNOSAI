'use client';

import type { KpiGroupListItem } from '@/lib/kpi-groups-api';

export type KpiGroupConfirmKind = 'deactivate' | 'activate' | 'delete' | 'duplicate';

export type KpiGroupConfirmState =
  | { kind: KpiGroupConfirmKind; row: KpiGroupListItem; duplicateCode?: string; duplicateName?: string }
  | null;

type KpiGroupConfirmDialogsProps = {
  state: KpiGroupConfirmState;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (state: NonNullable<KpiGroupConfirmState>) => void;
};

function dialogCopy(state: NonNullable<KpiGroupConfirmState>): { title: string; body: string; confirm: string } {
  switch (state.kind) {
    case 'deactivate':
      return {
        title: 'Ngừng sử dụng Nhóm KPI',
        body: `Nhóm "${state.row.name}" sẽ không thể chọn khi tạo chỉ tiêu mới.${
          state.row.usage_count > 0
            ? ` Hiện có ${state.row.usage_count} chỉ tiêu đang tham chiếu — dữ liệu lịch sử vẫn giữ nguyên.`
            : ''
        }`,
        confirm: 'Ngừng sử dụng',
      };
    case 'activate':
      return {
        title: 'Kích hoạt Nhóm KPI',
        body: `Kích hoạt nhóm "${state.row.name}" để có thể gán vào chỉ tiêu và báo cáo mới.`,
        confirm: 'Kích hoạt',
      };
    case 'delete':
      return {
        title: 'Xóa Nhóm KPI',
        body:
          state.row.usage_count > 0
            ? `Nhóm KPI này đang được sử dụng bởi ${state.row.usage_count} dữ liệu. Hãy ngừng sử dụng thay vì xóa, hoặc chuyển các dữ liệu liên quan sang nhóm khác.`
            : `Xóa mềm nhóm "${state.row.name}" (${state.row.code})? Hành động này có thể được khôi phục bởi quản trị viên.`,
        confirm: state.row.usage_count > 0 ? 'Đã hiểu' : 'Xóa',
      };
    case 'duplicate':
      return {
        title: 'Nhân bản Nhóm KPI',
        body: `Tạo bản sao từ "${state.row.name}". Bản sao sẽ ở trạng thái Bản nháp với mã và tên mới.`,
        confirm: 'Nhân bản',
      };
  }
}

export function KpiGroupConfirmDialogs({ state, busy, onClose, onConfirm }: KpiGroupConfirmDialogsProps) {
  if (!state) return null;
  const copy = dialogCopy(state);
  const blockedDelete = state.kind === 'delete' && state.row.usage_count > 0;

  return (
    <div className="kpi-group-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="kpi-group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpi-group-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="kpi-group-confirm-title">{copy.title}</h2>
        <p>{copy.body}</p>

        {state.kind === 'duplicate' ? (
          <div className="kpi-group-modal__fields">
            <label>
              Mã nhóm mới
              <input
                className="kpi-input"
                value={state.duplicateCode ?? `${state.row.code}_COPY`}
                readOnly
              />
            </label>
            <label>
              Tên nhóm mới
              <input
                className="kpi-input"
                value={state.duplicateName ?? `${state.row.name} (bản sao)`}
                readOnly
              />
            </label>
            <p className="muted">Mã và tên sẽ được tự sinh khi xác nhận.</p>
          </div>
        ) : null}

        <div className="kpi-group-modal__actions">
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          {blockedDelete ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
              Đóng
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn-sm ${state.kind === 'delete' ? 'btn-danger' : 'btn-primary'}`}
              disabled={busy}
              onClick={() => onConfirm(state)}
            >
              {busy ? 'Đang xử lý…' : copy.confirm}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
