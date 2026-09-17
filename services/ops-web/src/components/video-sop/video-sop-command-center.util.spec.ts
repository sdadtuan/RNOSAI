import { describe, expect, it } from 'vitest';
import { summarizeVdCommandCenter } from './video-sop-command-center.util';

describe('summarizeVdCommandCenter', () => {
  it('counts active projects and stage buckets', () => {
    const out = summarizeVdCommandCenter(
      [
        { id: 1, stage: 'brief_ready', status: 'active' },
        { id: 2, stage: 'scripting', status: 'active' },
        { id: 3, stage: 'archived', status: 'cancelled' },
      ] as never,
      { lifecycle_id: 4, project_count: 3, metrics: [] },
    );
    expect(out.activeCount).toBe(2);
    expect(out.stageBuckets.brief_ready).toBe(1);
    expect(out.stageBuckets.scripting).toBe(1);
  });

  it('maps production metrics to tiles with fallback dash', () => {
    const out = summarizeVdCommandCenter([], {
      lifecycle_id: 4,
      project_count: 0,
      metrics: [
        {
          metric: 'keyframe_pass_rate',
          value: 0,
          target: { label: '≥60%', direction: 'min', threshold: 60 },
          on_track: false,
        },
      ],
    });
    expect(out.metricTiles[0]?.label).toMatch(/keyframe/i);
    expect(out.metricTiles[0]?.valueLabel).toBe('0%');
  });
});
