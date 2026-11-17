import { donutArcs, type DonutSlice } from '@/lib/portal/donut-arcs';

const DEFAULT_COLORS = ['#17692f', '#2d8a44', '#5c6f63', '#8aa390'];

type PortalDonutChartProps = {
  slices: Array<Omit<DonutSlice, 'color'> & { color?: string }>;
  /** Text in the hole, e.g. "40%" or "—" */
  center: string;
  sublabel?: string;
  caption?: string;
  size?: number;
  thickness?: number;
  trackColor?: string;
  testId?: string;
  ariaLabel: string;
  /** Fraction of the circumference left as a gap between segments. */
  gapRatio?: number;
  showLegend?: boolean;
};

export function PortalDonutChart({
  slices,
  center,
  sublabel,
  caption,
  size = 168,
  thickness = 20,
  trackColor = '#e6ebe7',
  testId,
  ariaLabel,
  gapRatio = 0,
  showLegend = true,
}: PortalDonutChartProps) {
  const cx = size / 2;
  const radius = (size - thickness) / 2;
  const colored: DonutSlice[] = slices.map((slice, index) => ({
    ...slice,
    color: slice.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));
  const arcs = donutArcs(colored, radius, gapRatio);
  const legend = showLegend ? colored.filter((slice) => slice.value > 0) : [];
  const centerClass =
    center.length > 7 ? 'portal-donut__center portal-donut__center--long' : 'portal-donut__center';

  return (
    <figure className="portal-donut" data-testid={testId}>
      <svg
        className="portal-donut__svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
      >
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={thickness}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx={cx}
              cy={cx}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={arc.dasharray}
              strokeDashoffset={arc.dashoffset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text
          className={centerClass}
          x={cx}
          y={sublabel ? cx - 6 : cx}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {center}
        </text>
        {sublabel ? (
          <text
            className="portal-donut__sub"
            x={cx}
            y={cx + 12}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {sublabel}
          </text>
        ) : null}
      </svg>
      {caption ? <figcaption className="portal-donut__caption">{caption}</figcaption> : null}
      {legend.length > 1 ? (
        <ul className="portal-donut__legend">
          {legend.map((slice) => (
            <li key={slice.id ?? slice.label}>
              <span className="portal-donut__swatch" style={{ background: slice.color }} />
              {slice.label}
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
