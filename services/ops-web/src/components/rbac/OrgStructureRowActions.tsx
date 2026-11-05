'use client';

type Props = {
  active: boolean;
  busy?: boolean;
  entityLabel: string;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

export function OrgStructureRowActions({
  active,
  busy,
  entityLabel,
  onEdit,
  onToggleActive,
  onDelete,
}: Props) {
  function confirmDelete() {
    const verb = active ? 'xóa' : 'xóa vĩnh viễn';
    if (
      !window.confirm(
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${entityLabel}? Chỉ xóa được khi chưa có NV/dữ liệu liên kết.`,
      )
    ) {
      return;
    }
    onDelete();
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', justifyContent: 'flex-end' }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} disabled={busy}>
        Sửa
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleActive} disabled={busy}>
        {active ? 'Ngưng' : 'Bật lại'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={confirmDelete} disabled={busy}>
        Xóa
      </button>
    </div>
  );
}
