'use client';

import type { DeptRedDonutSegment } from '@/lib/crm/ceo-tower-ui.util';

export function BoardPackDeptDonutSection({
  segments,
}: {
  segments: DeptRedDonutSegment[] | undefined;
}) {
  if (!segments?.length) return null;

  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  let cursor = 0;
  const stops = segments.map((seg) => {
    const start = cursor;
    cursor += seg.pct;
    return `${seg.color} ${start}% ${cursor}%`;
  });
  const gradient = `conic-gradient(${stops.join(', ')})`;

  return (
    <section className="board-pack-section" data-testid="ceo-board-pack-dept-donut">
      <h2>Đỏ theo phòng</h2>
      <div className="board-pack-donut-row">
        <div className="board-pack-donut-ring" style={{ background: gradient }} aria-hidden="true">
          <div className="board-pack-donut-hole">
            <strong>{total}</strong>
          </div>
        </div>
        <table className="board-pack-table board-pack-donut-table">
          <thead>
            <tr>
              <th>Phòng</th>
              <th>Đỏ</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg) => (
              <tr key={seg.code}>
                <td>
                  <span className="board-pack-donut-swatch" style={{ background: seg.color }} />
                  {seg.label}
                </td>
                <td>{seg.value}</td>
                <td>{seg.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
