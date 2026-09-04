'use client';

type Props = {
  q: string;
  group: string;
  owner: string;
  status: string;
  owners: string[];
  onChange: (patch: Partial<{ q: string; group: string; owner: string; status: string }>) => void;
  onReset?: () => void;
};

export function KpiHubDictFilterBar({ q, group, owner, status, owners, onChange, onReset }: Props) {
  const hasFilters = Boolean(q || group || owner || status);

  return (
    <div className="kpi-hub-dict-toolbar">
      <div className="kpi-hub-dict-toolbar__row">
        <label className="kpi-hub-dict-toolbar__search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Tìm KPI, mã KPI, nguồn dữ liệu..."
            value={q}
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </label>
        <select value={group} onChange={(e) => onChange({ group: e.target.value })} aria-label="Nhóm KPI">
          <option value="">Nhóm KPI</option>
          <option value="ACQUISITION">Acquisition</option>
          <option value="MEDIA_EFFICIENCY">Media Efficiency</option>
          <option value="FUNNEL">Funnel</option>
          <option value="SALES_OUTCOME">Sales Outcome</option>
          <option value="FINANCE">Finance</option>
          <option value="OPERATIONS">Operations</option>
        </select>
        <select value={owner} onChange={(e) => onChange({ owner: e.target.value })} aria-label="Data Owner">
          <option value="">Data Owner</option>
          {owners.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => onChange({ status: e.target.value })} aria-label="Trạng thái">
          <option value="">Trạng thái</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="NEED_REVIEW">Need Review</option>
          <option value="PENDING_APPROVAL">Chờ duyệt</option>
        </select>
        <button type="button" className="kpi-hub-dict-toolbar__icon" aria-label="Lọc theo ngày cập nhật">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
        {hasFilters && onReset ? (
          <button type="button" className="kpi-hub-dict-toolbar__icon" onClick={onReset} aria-label="Xóa bộ lọc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
