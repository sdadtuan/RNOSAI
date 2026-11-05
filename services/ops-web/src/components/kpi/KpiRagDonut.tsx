export function KpiRagDonut({
  green,
  yellow,
  red,
}: {
  green: number;
  yellow: number;
  red: number;
}) {
  const total = green + yellow + red;
  const circumference = 2 * Math.PI * 42;
  let offset = 0;
  const slices =
    total === 0
      ? []
      : [
          { key: 'green', n: green, color: 'var(--success, #2e7d4f)', label: 'Xanh' },
          { key: 'yellow', n: yellow, color: '#c58a00', label: 'Vàng' },
          { key: 'red', n: red, color: 'var(--danger, #b42318)', label: 'Đỏ' },
        ].map((slice) => {
          const length = (slice.n / total) * circumference;
          const item = {
            ...slice,
            dasharray: `${length} ${circumference}`,
            dashoffset: -offset,
          };
          offset += length;
          return item;
        });

  return (
    <div className="kpi-donut" data-testid="kpi-rag-donut">
      <svg viewBox="0 0 120 120" width={120} height={120} role="img" aria-label="Phân bố RAG">
        <circle
          cx={60}
          cy={60}
          r={42}
          fill="none"
          stroke="color-mix(in srgb, var(--border) 70%, transparent)"
          strokeWidth={16}
        />
        {slices
          .filter((slice) => slice.n > 0)
          .map((slice) => (
            <circle
              key={slice.key}
              cx={60}
              cy={60}
              r={42}
              fill="none"
              stroke={slice.color}
              strokeWidth={16}
              strokeDasharray={slice.dasharray}
              strokeDashoffset={slice.dashoffset}
              transform="rotate(-90 60 60)"
            />
          ))}
        <text
          x={60}
          y={60}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={total === 0 ? 11 : 18}
          fontWeight={700}
        >
          {total === 0 ? 'Chưa có số' : total}
        </text>
      </svg>
      <ul>
        {(
          [
            { label: 'Xanh', n: green },
            { label: 'Vàng', n: yellow },
            { label: 'Đỏ', n: red },
          ] as const
        ).map((item) => {
          const pct = total === 0 ? 0 : Math.round((100 * item.n) / total);
          return (
            <li key={item.label}>
              {item.label} {item.n} ({pct}%)
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default KpiRagDonut;
