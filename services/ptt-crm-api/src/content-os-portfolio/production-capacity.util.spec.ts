import {
  computeCapacity,
  criticalPathTaskIds,
  hasDelayedCriticalTask,
  type CmktETask,
} from './production-capacity.util';

function task(partial: Partial<CmktETask> & Pick<CmktETask, 'id'>): CmktETask {
  return {
    title: partial.title ?? partial.id,
    assignee_id: null,
    raci: { r: 'sp', a: 'am' },
    depends_on: [],
    sla_h: 8,
    effort_h: 4,
    status: 'todo',
    ...partial,
  };
}

describe('computeCapacity', () => {
  it('returns null when no item has both effort_h and an assignee', () => {
    expect(computeCapacity([])).toEqual({ capacity_pct: null, capacity_band: null });
    expect(
      computeCapacity([
        { assignee_sp: 3, production_json: {} },
        { production_json: { effort_h: 20 } },
        { production_json: { effort_h: 0, assignee_designer_id: 4 } },
        { production_json: { effort_h: Number.NaN, assignee_video_id: 5 } },
      ]),
    ).toEqual({ capacity_pct: null, capacity_band: null });
  });

  it('is 50 when 20h sits on one assignee against a 40h week', () => {
    expect(
      computeCapacity([
        { assignee_sp: 7, production_json: { effort_h: 20 } },
        { production_json: { effort_h: 12 } },
      ]),
    ).toEqual({ capacity_pct: 50, capacity_band: 'ok' });
  });

  it('counts unique assignees from item, designer, video, and task ids', () => {
    const out = computeCapacity([
      {
        assignee_sp: 1,
        production_json: {
          effort_h: 40,
          assignee_designer_id: 2,
          assignee_video_id: 2,
          tasks: [task({ id: 't1', assignee_id: 3 })],
        },
      },
    ]);
    expect(out.capacity_pct).toBe(Math.round((40 / (3 * 40)) * 100));
    expect(out.capacity_band).toBe('ok');
  });

  it('labels BR-043 bands at 80 / 90 / 100 without inventing a seed percent', () => {
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 32 } }]).capacity_band).toBe(
      'warning',
    );
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 36 } }]).capacity_band).toBe(
      'at_risk',
    );
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 40 } }]).capacity_band).toBe(
      'overloaded',
    );
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 80 } }]).capacity_pct).toBe(200);
  });
});

describe('criticalPathTaskIds', () => {
  it('returns empty when there are no tasks', () => {
    expect(criticalPathTaskIds(undefined)).toEqual([]);
    expect(criticalPathTaskIds([])).toEqual([]);
  });

  it('keeps the longest remaining-effort FS path among unfinished tasks', () => {
    const tasks = [
      task({ id: 'a', effort_h: 5, depends_on: [] }),
      task({ id: 'b', effort_h: 10, depends_on: ['a'] }),
      task({ id: 'c', effort_h: 2, depends_on: ['a'] }),
      task({ id: 'd', effort_h: 1, status: 'done', depends_on: ['b'] }),
    ];
    expect(criticalPathTaskIds(tasks)).toEqual(['a', 'b']);
  });

  it('uses sla_h when effort_h is missing and skips done remaining hours', () => {
    const tasks = [
      task({ id: 'write', effort_h: 0, sla_h: 6, depends_on: [] }),
      task({ id: 'design', effort_h: 4, status: 'done', depends_on: ['write'] }),
      task({ id: 'qa', effort_h: 3, depends_on: ['design'] }),
    ];
    expect(criticalPathTaskIds(tasks)).toEqual(['write', 'qa']);
  });

  it('does not loop forever on a cycle', () => {
    expect(
      criticalPathTaskIds([
        task({ id: 'x', effort_h: 2, depends_on: ['y'] }),
        task({ id: 'y', effort_h: 2, depends_on: ['x'] }),
      ]),
    ).toEqual(expect.arrayContaining(['x', 'y']));
  });
});

describe('hasDelayedCriticalTask', () => {
  it('is true only when a critical-path task is blocked', () => {
    const tasks = [
      task({ id: 'a', effort_h: 5 }),
      task({ id: 'b', effort_h: 8, depends_on: ['a'], status: 'blocked' }),
      task({ id: 'side', effort_h: 1, status: 'blocked' }),
    ];
    expect(hasDelayedCriticalTask(tasks)).toBe(true);
    expect(hasDelayedCriticalTask(tasks.map((row) => (row.id === 'b' ? { ...row, status: 'doing' } : row)))).toBe(
      false,
    );
  });
});
