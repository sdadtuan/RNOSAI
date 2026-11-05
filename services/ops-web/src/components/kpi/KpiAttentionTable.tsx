import type { AttentionRow } from '@/lib/kpi/cockpit-summary';
import { formatNumber } from '@/lib/kpi/format';
import type { KpiRag } from '@/lib/kpi/rag';

const RAG_PILL: Record<KpiRag, string> = {
  green: 'Xanh',
  yellow: 'Vàng',
  red: 'Đỏ',
  no_data: 'Chưa có số',
};

const RAG_BG: Record<KpiRag, string> = {
  green: 'var(--success, #2e7d4f)',
  yellow: '#c58a00',
  red: 'var(--danger, #b42318)',
  no_data: 'var(--border)',
};

function ragClass(rag: KpiRag): string {
  return rag === 'no_data' ? 'kpi-rag' : `kpi-rag is-${rag}`;
}

export function KpiAttentionTable({ rows }: { rows: AttentionRow[] }) {
  return (
    <section>
      <h3 className="kpi-section-title">KPI cần chú ý</h3>
      {rows.length === 0 ? (
        <p className="muted">Chưa có bản ghi KPI trong kỳ này.</p>
      ) : (
        <table className="kpi-cockpit-table">
          <thead>
            <tr>
              <th>KPI</th>
              <th>Owner</th>
              <th>Phạm vi</th>
              <th>Thực tế/Mục tiêu</th>
              <th>Tiến độ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = row.achievement_pct;
              return (
                <tr key={row.id}>
                  <td>{row.metric_name}</td>
                  <td>{row.staff_name}</td>
                  <td>{row.department}</td>
                  <td>
                    {row.actual_value == null ? '—' : formatNumber(row.actual_value)} / {row.target_value == null ? '—' : formatNumber(row.target_value)}
                    {row.unit ? ` ${row.unit}` : ''}
                  </td>
                  <td>
                    <div className="kpi-progress-mini">
                      <span
                        style={{
                          width: pct == null ? '0%' : `${Math.min(100, Math.max(0, pct))}%`,
                          background: RAG_BG[row.rag],
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className={ragClass(row.rag)}>{RAG_PILL[row.rag]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default KpiAttentionTable;
