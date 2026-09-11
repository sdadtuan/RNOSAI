import {
  CMKT_SLA_TICK_MS,
  evaluateProductionSla,
  resolveAmStaffId,
  shouldStartSlaCron,
  slaFiredKey,
  type SlaEvalTask,
} from './production-sla.util';

function task(partial: Partial<SlaEvalTask> & Pick<SlaEvalTask, 'id'>): SlaEvalTask {
  return {
    sla_h: 10,
    status: 'doing',
    started_at: '2026-09-11T00:00:00.000Z',
    ...partial,
  };
}

const t0 = new Date('2026-09-11T00:00:00.000Z');

function hoursLater(h: number): Date {
  return new Date(t0.getTime() + h * 3600_000);
}

describe('evaluateProductionSla', () => {
  it('emits reminder at 75% elapsed', () => {
    const out = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })] } },
      hoursLater(7.5),
    );
    expect(out.events).toEqual([
      { task_id: 'copy', threshold: 75, action: 'reminder', pct: 75 },
    ]);
    expect(out.sla_fired).toEqual([slaFiredKey('copy', 75)]);
  });

  it('emits reminder and at_risk at 90% elapsed', () => {
    const out = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })] } },
      hoursLater(9),
    );
    expect(out.events.map((e) => e.action)).toEqual(['reminder', 'at_risk']);
    expect(out.events[1]).toMatchObject({ task_id: 'copy', threshold: 90, action: 'at_risk', pct: 90 });
  });

  it('emits breached only when elapsed is greater than 100%', () => {
    const at100 = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })] } },
      hoursLater(10),
    );
    expect(at100.events.map((e) => e.action)).toEqual(['reminder', 'at_risk']);

    const over = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })] } },
      hoursLater(10.1),
    );
    expect(over.events.map((e) => e.action)).toEqual(['reminder', 'at_risk', 'breached']);
    expect(over.events[2].threshold).toBe(100);
    expect(over.events[2].pct).toBeCloseTo(101);
  });

  it('skips a task with no started_at instead of inventing elapsed', () => {
    const out = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy', started_at: undefined })] } },
      hoursLater(20),
    );
    expect(out.events).toEqual([]);
    expect(out.sla_fired).toEqual([]);
  });

  it('skips invalid started_at, non-positive sla_h, and done tasks', () => {
    const out = evaluateProductionSla(
      {
        production_json: {
          tasks: [
            task({ id: 'bad-iso', started_at: 'not-a-date' }),
            task({ id: 'zero', sla_h: 0 }),
            task({ id: 'neg', sla_h: -4 }),
            task({ id: 'inf', sla_h: Number.POSITIVE_INFINITY }),
            task({ id: 'done', status: 'done' }),
          ],
        },
      },
      hoursLater(20),
    );
    expect(out.events).toEqual([]);
  });

  it('does not re-emit a threshold already in sla_fired', () => {
    const first = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })] } },
      hoursLater(9.5),
    );
    const second = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })], sla_fired: first.sla_fired } },
      hoursLater(9.6),
    );
    expect(second.events).toEqual([]);
    expect(second.sla_fired).toEqual(first.sla_fired);

    const later = evaluateProductionSla(
      { production_json: { tasks: [task({ id: 'copy' })], sla_fired: first.sla_fired } },
      hoursLater(12),
    );
    expect(later.events).toEqual([
      { task_id: 'copy', threshold: 100, action: 'breached', pct: 120 },
    ]);
  });
});

describe('resolveAmStaffId', () => {
  it('prefers lifecycle account-manager / owner, else assignee_sp', () => {
    expect(resolveAmStaffId({ assigned_am: 11, assignee_sp: 3 })).toBe(11);
    expect(resolveAmStaffId({ owner_id: 8, assignee_sp: 3 })).toBe(8);
    expect(resolveAmStaffId({ assignee_sp: 3 })).toBe(3);
    expect(resolveAmStaffId({})).toBeNull();
  });
});

describe('shouldStartSlaCron', () => {
  it('is 5 minutes and starts only outside test/jest', () => {
    expect(CMKT_SLA_TICK_MS).toBe(5 * 60 * 1000);
    expect(shouldStartSlaCron({ NODE_ENV: 'production' })).toBe(true);
    expect(shouldStartSlaCron({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldStartSlaCron({ NODE_ENV: 'test' })).toBe(false);
    expect(shouldStartSlaCron({ NODE_ENV: 'production', JEST_WORKER_ID: '1' })).toBe(false);
  });
});
