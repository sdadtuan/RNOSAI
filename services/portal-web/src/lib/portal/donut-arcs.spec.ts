import { describe, it, expect } from 'vitest';
import { donutArcs } from './donut-arcs';

describe('donutArcs', () => {
  it('returns no arcs when every slice is empty', () => {
    expect(donutArcs([{ label: 'A', value: 0, color: '#000' }], 50)).toEqual([]);
  });

  it('splits the circumference in proportion and stacks offsets', () => {
    const radius = 50;
    const circ = 2 * Math.PI * radius;
    const arcs = donutArcs(
      [
        { id: 'a', label: 'A', value: 1, color: '#111' },
        { id: 'b', label: 'B', value: 3, color: '#222' },
        { id: 'zero', label: 'Z', value: 0, color: '#333' },
      ],
      radius,
    );
    expect(arcs).toHaveLength(2);
    expect(arcs[0].id).toBe('a');
    expect(arcs[0].dashoffset).toBe(0);
    const firstLen = circ / 4;
    expect(arcs[0].dasharray).toBe(`${firstLen} ${circ - firstLen}`);
    expect(arcs[1].dashoffset).toBeCloseTo(-firstLen, 8);
    const secondLen = (3 / 4) * circ;
    expect(arcs[1].dasharray).toBe(`${secondLen} ${circ - secondLen}`);
  });
});

  it('leaves a visible gap between segments when gapRatio is set', () => {
    const radius = 50;
    const circ = 2 * Math.PI * radius;
    const gapRatio = 0.04;
    const arcs = donutArcs(
      [
        { id: 'a', label: 'A', value: 1, color: '#111' },
        { id: 'b', label: 'B', value: 1, color: '#222' },
      ],
      radius,
      gapRatio,
    );
    const gap = Math.min(circ * gapRatio, (circ / 2) * 0.3);
    const raw = circ / 2;
    const len = raw - gap;
    expect(arcs).toHaveLength(2);
    expect(Number(arcs[0].dasharray.split(' ')[0])).toBeCloseTo(len, 8);
    // first segment starts after half a gap, so the two drawn lengths plus two gaps fill the circle
    expect(len * 2 + gap * 2).toBeCloseTo(circ, 8);
  });
