export type DonutSlice = {
  id?: string;
  label: string;
  value: number;
  color: string;
};

export type DonutArc = {
  id: string;
  label: string;
  color: string;
  value: number;
  /** SVG stroke-dasharray: "drawn remaining" */
  dasharray: string;
  dashoffset: number;
};

/**
 * Build stroke-dash arcs for a circle of the given radius, starting at 12 o'clock after a -90° rotate.
 * `gapRatio` is a fraction of the circumference left empty between segments (ignored for a single slice).
 */
export function donutArcs(slices: DonutSlice[], radius: number, gapRatio = 0): DonutArc[] {
  const circ = 2 * Math.PI * radius;
  const usable = slices
    .map((slice, index) => ({
      id: slice.id ?? String(index),
      label: slice.label,
      color: slice.color,
      value: Math.max(0, Number(slice.value) || 0),
    }))
    .filter((slice) => slice.value > 0);
  const total = usable.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0 || !(radius > 0)) return [];
  const gap = usable.length > 1 ? Math.min(circ * Math.max(0, gapRatio), (circ / usable.length) * 0.3) : 0;
  let offset = gap / 2;
  return usable.map((slice) => {
    const raw = (slice.value / total) * circ;
    const len = Math.max(0, raw - gap);
    const arc: DonutArc = {
      id: slice.id,
      label: slice.label,
      color: slice.color,
      value: slice.value,
      dasharray: `${len} ${Math.max(0, circ - len)}`,
      dashoffset: offset === 0 ? 0 : -offset,
    };
    offset += raw;
    return arc;
  });
}
