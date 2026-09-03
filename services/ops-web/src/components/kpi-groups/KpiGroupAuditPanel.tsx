'use client';

import type { KpiGroupAuditEntry } from '@/lib/kpi-groups-api';

type KpiGroupAuditPanelProps = {
  entries: KpiGroupAuditEntry[];
  loading?: boolean;
  error?: string;
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  ACTIVATE: 'Kích hoạt',
  INACTIVATE: 'Ngừng sử dụng',
  DELETE: 'Xóa',
  RESTORE: 'Khôi phục',
  REORDER: 'Sắp xếp thứ tự',
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

function summarizeJson(data: Record<string, unknown> | null | undefined): string {
  if (!data || !Object.keys(data).length) return '—';
  const keys = Object.keys(data).slice(0, 4);
  return keys.map((k) => `${k}: ${String(data[k])}`).join(', ');
}

export function KpiGroupAuditPanel({ entries, loading, error }: KpiGroupAuditPanelProps) {
  if (loading) return <p className="muted">Đang tải lịch sử…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!entries.length) return <p className="muted">Chưa có lịch sử thay đổi.</p>;

  return (
    <div className="kpi-group-audit-panel">
      <table className="data-table kpi-group-audit-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người thực hiện</th>
            <th>Hành động</th>
            <th>Trước</th>
            <th>Sau</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatWhen(entry.performed_at)}</td>
              <td>{entry.performed_by.name}</td>
              <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
              <td className="kpi-group-audit-table__json">{summarizeJson(entry.before_json)}</td>
              <td className="kpi-group-audit-table__json">{summarizeJson(entry.after_json)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
