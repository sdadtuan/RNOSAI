'use client';

type Props = {
  q: string;
  group: string;
  owner: string;
  status: string;
  owners: string[];
  onChange: (patch: Partial<{ q: string; group: string; owner: string; status: string }>) => void;
};

export function KpiHubDictFilterBar({ q, group, owner, status, owners, onChange }: Props) {
  return (
    <div className="kpi-hub-filter-bar kpi-hub-dict-filter-bar">
      <span className="kpi-hub-dict-filter-bar__search-wrap">
        <svg className="kpi-hub-dict-filter-bar__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          className="kpi-hub-input kpi-hub-filter-bar__search"
          placeholder="Tìm KPI, mã KPI, nguồn dữ liệu..."
          value={q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </span>
      <select className="kpi-hub-select" value={group} onChange={(e) => onChange({ group: e.target.value })}>
        <option value="">Nhóm KPI</option>
        <option value="ACQUISITION">Acquisition</option>
        <option value="MEDIA_EFFICIENCY">Media Efficiency</option>
        <option value="FUNNEL">Funnel</option>
        <option value="SALES_OUTCOME">Sales Outcome</option>
        <option value="FINANCE">Unit Economics</option>
        <option value="OPERATIONS">Operations</option>
      </select>
      <select className="kpi-hub-select" value={owner} onChange={(e) => onChange({ owner: e.target.value })}>
        <option value="">Data Owner</option>
        {owners.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select className="kpi-hub-select" value={status} onChange={(e) => onChange({ status: e.target.value })}>
        <option value="">Trạng thái</option>
        <option value="ACTIVE">Active</option>
        <option value="DRAFT">Draft</option>
        <option value="NEED_REVIEW">Need Review</option>
        <option value="PENDING_APPROVAL">Chờ duyệt</option>
      </select>
      <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--icon kpi-hub-date-chip" aria-label="Lọc theo ngày cập nhật">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </div>
  );
}
