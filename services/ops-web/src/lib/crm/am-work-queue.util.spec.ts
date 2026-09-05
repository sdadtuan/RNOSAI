import { describe, expect, it } from 'vitest';
import {
  AM_WORK_BOARD_COLUMNS,
  amTaskOverdue,
  parseAmWorkInbox,
  parseAmWorkView,
} from './am-work-queue.util';

const PAST_DUE = '2020-01-01T00:00:00.000Z';

describe('am-work-queue', () => {
  it('amTaskOverdue is false when waiting_client is sla_paused', () => {
    expect(
      amTaskOverdue({
        status: 'waiting_client',
        sla_paused: true,
        sla_resolve_due_at: PAST_DUE,
      }),
    ).toBe(false);
    expect(
      amTaskOverdue({
        status: 'in_progress',
        sla_paused: false,
        sla_resolve_due_at: PAST_DUE,
      }),
    ).toBe(true);
  });

  it('parses view and inbox from the URL or defaults', () => {
    expect(parseAmWorkView('board')).toBe('board');
    expect(parseAmWorkView('week')).toBe('week');
    expect(parseAmWorkView('unknown')).toBe('list');
    expect(parseAmWorkView(null)).toBe('list');
    expect(parseAmWorkInbox('team')).toBe('team');
    expect(parseAmWorkInbox('unassigned')).toBe('unassigned');
    expect(parseAmWorkInbox('unknown')).toBe('me');
    expect(parseAmWorkInbox(null)).toBe('me');
  });

  it('uses the four board column labels', () => {
    expect(AM_WORK_BOARD_COLUMNS.map((col) => col.label)).toEqual([
      'New',
      'In Progress',
      'Waiting Client',
      'Resolved',
    ]);
  });
});
