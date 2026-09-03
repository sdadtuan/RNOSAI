'use client';

type Props = {
  q: string;
  group: string;
  owner: string;
  status: string;
  onChange: (patch: Partial<{ q: string; group: string; owner: string; status: string }>) => void;
  onCreate?: () => void;
};

export function KpiHubDictFilterBar({ q, group, owner, status, onChange, onCreate }: Props) {
  return (
    <div className="kpi-hub-filter-bar">
      <input
        type="search"
        className="kpi-hub-input kpi-hub-filter-bar__search"
        placeholder="Tìm KPI, mã KPI, nguồn dữ liệu..."
        value={q}
        onChange={(e) => onChange({ q: e.target.value })}
      />
      <select className="kpi-hub-select" value={group} onChange={(e) => onChange({ group: e.target.value })}>
        <option value="">Nhóm KPI</option>
        <option value="ACQUISITION">Acquisition</option>
        <option value="MEDIA_EFFICIENCY">Media Efficiency</option>
        <option value="FUNNEL">Funnel</option>
        <option value="SALES_OUTCOME">Sales Outcome</option>
      </select>
      <select className="kpi-hub-select" value={owner} onChange={(e) => onChange({ owner: e.target.value })}>
        <option value="">Data Owner</option>
      </select>
      <select className="kpi-hub-select" value={status} onChange={(e) => onChange({ status: e.target.value })}>
        <option value="">Trạng thái</option>
        <option value="ACTIVE">Active</option>
        <option value="DRAFT">Draft</option>
        <option value="NEED_REVIEW">Need Review</option>
      </select>
      {onCreate ? (
        <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" onClick={onCreate}>
          + Tạo KPI
        </button>
      ) : null}
    </div>
  );
}
