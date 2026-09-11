import {
  capacityBandFor,
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

  it('uses assignee only as an eligibility gate so 40h is 100 with one or three assignees', () => {
    const one = computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 40 } }]);
    const three = computeCapacity([
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
    expect(one).toEqual({ capacity_pct: 100, capacity_band: 'overloaded' });
    expect(three).toEqual({ capacity_pct: 100, capacity_band: 'overloaded' });
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

  it('bands the unrounded ratio so 79.5 is not warning and 89.5 is not at_risk', () => {
    expect(capacityBandFor(79.5)).toBe('ok');
    expect(capacityBandFor(89.5)).toBe('warning');
    expect(capacityBandFor(99.5)).toBe('at_risk');
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 31.8125 } }])).toEqual({
      capacity_pct: 80,
      capacity_band: 'ok',
    });
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 35.8125 } }])).toEqual({
      capacity_pct: 90,
      capacity_band: 'warning',
    });
    expect(computeCapacity([{ assignee_sp: 1, production_json: { effort_h: 39.8125 } }])).toEqual({
      capacity_pct: 100,
      capacity_band: 'at_risk',
    });
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

  it('returns one cyclic component in input order without looping', () => {
    expect(
      criticalPathTaskIds([
        task({ id: 'x', effort_h: 2, depends_on: ['y'] }),
        task({ id: 'y', effort_h: 2, depends_on: ['x'] }),
      ]),
    ).toEqual(['x', 'y']);
  });

  it('reconstructs one longest path when two remaining-effort totals tie', () => {
    const tasks = [
      task({ id: 'a', effort_h: 5 }),
      task({ id: 'b', effort_h: 5, depends_on: ['a'] }),
      task({ id: 'c', effort_h: 5, depends_on: ['a'] }),
    ];
    expect(criticalPathTaskIds(tasks)).toEqual(['a', 'b']);
  });

  it('scores a layered DAG in linear time and returns one heavy path', () => {
    const layers = 20;
    const tasks: CmktETask[] = [];
    for (let i = 0; i < layers; i += 1) {
      const depends_on = i === 0 ? [] : [`L${i - 1}a`, `L${i - 1}b`];
      tasks.push(task({ id: `L${i}a`, effort_h: i === layers - 1 ? 100 : 1, depends_on }));
      tasks.push(task({ id: `L${i}b`, effort_h: 1, depends_on }));
    }
    const started = Date.now();
    const path = criticalPathTaskIds(tasks);
    expect(Date.now() - started).toBeLessThan(250);
    expect(path).toEqual(Array.from({ length: layers }, (_, i) => `L${i}a`));
  }, 250);
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
