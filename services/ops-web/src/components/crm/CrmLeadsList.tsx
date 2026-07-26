import Link from 'next/link';
import type { LeadRow } from '@/lib/api';

interface Props {
  rows: LeadRow[];
  loading: boolean;
}

export function CrmLeadsList({ rows, loading }: Props) {
  return (
    <>
      <div className="crm-leads-table-wrap" style={{ overflowX: 'auto' }}>
        <table className="perf-table">
          <thead>
            <tr>
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
              <tr key={lead.id}>
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
                <td colSpan={7} className="muted">
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
