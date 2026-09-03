import type { DeptProgress } from '@/lib/kpi/cockpit-summary';
import { formatPct } from '@/lib/kpi/format';

const LEGEND = [
  { key: 'green', label: 'Xanh' },
  { key: 'yellow', label: 'Vàng' },
  { key: 'red', label: 'Đỏ' },
  { key: 'none', label: 'Chưa có số' },
] as const;

export function KpiDeptStackChart({ rows }: { rows: DeptProgress[] }) {
  return (
    <section className="kpi-dept-stack">
      <h3 className="kpi-section-title">Tiến độ KPI theo phòng ban</h3>
      <div>
        {LEGEND.map((item) => (
          <span key={item.key} style={{ marginRight: '0.75rem', fontSize: '0.78rem' }}>
            <span
              className={`kpi-dept-stack__seg is-${item.key}`}
              style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, verticalAlign: 'middle' }}
            />{' '}
            {item.label}
          </span>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">Chưa có bản ghi KPI trong kỳ này.</p>
      ) : (
        rows.map((row) => {
          const total = row.green + row.yellow + row.red + row.no_data;
          const segs = [
            { key: 'green' as const, n: row.green },
            { key: 'yellow' as const, n: row.yellow },
            { key: 'red' as const, n: row.red },
            { key: 'none' as const, n: row.no_data },
          ];
          return (
            <div key={row.name} className="kpi-dept-stack__row">
              <span>{row.name}</span>
              <div className="kpi-dept-stack__track">
                {total === 0
                  ? null
                  : segs
                      .filter((seg) => seg.n > 0)
                      .map((seg) => (
                        <span
                          key={seg.key}
                          className={`kpi-dept-stack__seg is-${seg.key}`}
                          style={{ width: `${(100 * seg.n) / total}%` }}
                        />
                      ))}
              </div>
              <span>{row.progress_pct == null ? '—' : formatPct(row.progress_pct)}</span>
            </div>
          );
        })
      )}
    </section>
  );
}

export default KpiDeptStackChart;
