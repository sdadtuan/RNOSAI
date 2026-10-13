import {
  computeKanbanFirstContactSla,
  computeKanbanPriority,
  defaultKanbanCardSettings,
  isKanbanStale,
  isQuoteStale,
  kanbanCallMayRevealPhone,
  kanbanCallOutcome,
  kanbanCardSettingsFromPayload,
} from './kanban-card.util';

const HOURS = defaultKanbanCardSettings();

describe('kanban card clock', () => {
  it('counts 20 working minutes inside 08:00–21:00', () => {
    const sla = computeKanbanFirstContactSla({
      status: 'moi',
      receivedAt: new Date('2026-10-12T01:00:00.000Z'),
      columnSince: new Date('2026-10-12T01:00:00.000Z'),
      hasCall: false,
      now: new Date('2026-10-12T01:20:00.000Z'),
      settings: HOURS,
    });
    expect(sla.state).toBe('breach');
    expect(sla.lateMinutes).toBe(5);
    expect(sla.columnMinutes).toBe(20);
  });

  it('pauses overnight and resumes the next morning', () => {
    const sla = computeKanbanFirstContactSla({
      status: 'moi',
      receivedAt: new Date('2026-10-12T13:50:00.000Z'),
      columnSince: new Date('2026-10-12T13:50:00.000Z'),
      hasCall: false,
      now: new Date('2026-10-13T01:10:00.000Z'),
      settings: HOURS,
    });
    expect(sla.columnMinutes).toBe(20);
    expect(sla.state).toBe('breach');
    expect(sla.lateMinutes).toBe(5);
  });

  it('marks Sắp trễ when fewer than 5 minutes remain', () => {
    const sla = computeKanbanFirstContactSla({
      status: 'first_contact',
      receivedAt: new Date('2026-10-12T01:00:00.000Z'),
      columnSince: new Date('2026-10-12T01:00:00.000Z'),
      hasCall: false,
      now: new Date('2026-10-12T01:12:00.000Z'),
      settings: HOURS,
    });
    expect(sla.state).toBe('warning');
    expect(sla.lateMinutes).toBeNull();
  });

  it('stops the SLA clock after a call', () => {
    const sla = computeKanbanFirstContactSla({
      status: 'moi',
      receivedAt: new Date('2026-10-12T01:00:00.000Z'),
      columnSince: new Date('2026-10-12T01:00:00.000Z'),
      hasCall: true,
      now: new Date('2026-10-12T03:00:00.000Z'),
      settings: HOURS,
    });
    expect(sla.state).toBe('ok');
    expect(sla.lateMinutes).toBeNull();
  });

  it('reads a published threshold instead of the seed', () => {
    const settings = kanbanCardSettingsFromPayload({
      kanban: { sla_first_contact_minutes: 30, sla_warning_remaining_minutes: 5 },
    });
    const sla = computeKanbanFirstContactSla({
      status: 'moi',
      receivedAt: new Date('2026-10-12T01:00:00.000Z'),
      columnSince: new Date('2026-10-12T01:00:00.000Z'),
      hasCall: false,
      now: new Date('2026-10-12T01:20:00.000Z'),
      settings,
    });
    expect(sla.state).toBe('ok');
  });
});

describe('kanban priority', () => {
  it('marks a fresh paid-media lead with a need as hot', () => {
    expect(
      computeKanbanPriority({
        source: 'facebook',
        channel: 'meta',
        need: 'Chạy ads',
        receivedAt: new Date('2026-10-12T01:00:00.000Z'),
        now: new Date('2026-10-12T01:30:00.000Z'),
        settings: HOURS,
      }),
    ).toBe('hot');
  });

  it('marks an old paid-media lead without a need as warm', () => {
    expect(
      computeKanbanPriority({
        source: 'facebook',
        channel: 'meta',
        need: '',
        receivedAt: new Date('2026-10-01T01:00:00.000Z'),
        now: new Date('2026-10-12T01:30:00.000Z'),
        settings: HOURS,
      }),
    ).toBe('warm');
  });

  it('marks an unknown old lead as cold', () => {
    expect(
      computeKanbanPriority({
        source: 'walk-in',
        channel: '',
        need: '',
        receivedAt: new Date('2026-10-01T01:00:00.000Z'),
        now: new Date('2026-10-12T01:30:00.000Z'),
        settings: HOURS,
      }),
    ).toBe('cold');
  });
});

describe('kanban call outcome', () => {
  it('moves answered and callback to contacted', () => {
    expect(kanbanCallOutcome('answered').nextStatus).toBe('da_lien_he');
    expect(kanbanCallOutcome('callback').nextStatus).toBe('da_lien_he');
  });

  it('suggests lost for a wrong number and leaves no-answer in place', () => {
    expect(kanbanCallOutcome('wrong_number')).toEqual({ nextStatus: null, suggestLost: true });
    expect(kanbanCallOutcome('no_answer')).toEqual({ nextStatus: null, suggestLost: false });
  });

  it('hides the phone of a lead the account manager does not own', () => {
    expect(
      kanbanCallMayRevealPhone({ memberProjectPool: true, ownerId: 7, staffId: 25 }),
    ).toBe(false);
    expect(
      kanbanCallMayRevealPhone({ memberProjectPool: true, ownerId: 25, staffId: 25 }),
    ).toBe(true);
  });
});

describe('kanban standing and quote age', () => {
  const now = new Date('2026-10-13T04:00:00.000Z');

  it('marks đứng yên from the published day count', () => {
    const settings = kanbanCardSettingsFromPayload({
      kanban: { stale_days: { dang_tu_van: 3 }, quote_stale_days: 5 },
    });
    expect(settings.dedupe_days).toBe(30);
    expect(
      isKanbanStale({
        status: 'dang_tu_van',
        columnSince: new Date('2026-10-10T04:00:00.000Z'),
        now,
        settings,
      }),
    ).toBe(true);
    expect(
      isKanbanStale({
        status: 'dang_tu_van',
        columnSince: new Date('2026-10-12T04:00:00.000Z'),
        now,
        settings,
      }),
    ).toBe(false);
  });

  it('marks a quote stale only after quote_stale_days', () => {
    const settings = kanbanCardSettingsFromPayload({ kanban: { quote_stale_days: 7 } });
    expect(
      isQuoteStale({
        status: 'bao_gia',
        receivedAt: new Date('2026-10-01T04:00:00.000Z'),
        now,
        settings,
      }),
    ).toBe(true);
    expect(
      isQuoteStale({
        status: 'dang_tu_van',
        receivedAt: new Date('2026-10-01T04:00:00.000Z'),
        now,
        settings,
      }),
    ).toBe(false);
  });
});
