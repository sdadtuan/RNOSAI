import Link from 'next/link';
import type { LeadRow } from '@/lib/api';

interface Props {
  rows: LeadRow[];
  loading: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
}

export function CrmLeadsList({ rows, loading, selectedIds, onToggleSelect, onToggleAll }: Props) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = rows.some((row) => selectedIds.has(row.id));

  return (
    <>
      <div className="crm-leads-table-wrap" style={{ overflowX: 'auto' }}>
        <table className="perf-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả trang"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th>ID</th>
              <th>Tên</th>
              <th>SĐT</th>
              <th>Trạng thái</th>
              <th>Nguồn</th>
              <th>Kênh</th>
              <th>Ngày</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead.id} className={selectedIds.has(lead.id) ? 'crm-leads-row--selected' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Chọn lead ${lead.id}`}
                    checked={selectedIds.has(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                  />
                </td>
                <td>
                  <Link href={`/crm/leads/${lead.id}`} className="nav-link">
                    {lead.id}
                  </Link>
                </td>
                <td>{lead.full_name || '—'}</td>
                <td>{lead.phone || '—'}</td>
                <td>{lead.status}</td>
                <td>{lead.source}</td>
                <td>{lead.channel || '—'}</td>
                <td>{lead.created_at?.slice(0, 10) ?? '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Không có lead
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ul className="crm-leads-cards" aria-label="Danh sách lead (mobile)">
        {rows.map((lead) => (
          <li key={lead.id} className="crm-leads-card">
            <div className="crm-leads-card__select">
              <input
                type="checkbox"
                aria-label={`Chọn lead ${lead.id}`}
                checked={selectedIds.has(lead.id)}
                onChange={() => onToggleSelect(lead.id)}
              />
            </div>
            <Link href={`/crm/leads/${lead.id}`} className="crm-leads-card__link">
              <div className="crm-leads-card__head">
                <strong>{lead.full_name || `Lead #${lead.id}`}</strong>
                <span className="meta-badge">{lead.status}</span>
              </div>
              <div className="crm-leads-card__meta muted">
                <span>#{lead.id}</span>
                {lead.phone ? <span>{lead.phone}</span> : null}
              </div>
              <div className="crm-leads-card__meta muted">
                <span>{lead.source || '—'}</span>
                <span>{lead.channel || '—'}</span>
                <span>{lead.created_at?.slice(0, 10) ?? '—'}</span>
              </div>
            </Link>
          </li>
        ))}
        {!loading && rows.length === 0 ? (
          <li className="crm-leads-card crm-leads-card--empty muted">Không có lead</li>
        ) : null}
      </ul>
    </>
  );
}
