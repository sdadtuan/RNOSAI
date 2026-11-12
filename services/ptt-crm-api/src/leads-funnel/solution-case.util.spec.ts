import { buildSolutionCaseView, solutionWorkDueAt, type SolutionCaseSource } from './solution-case.util';

function source(partial: Partial<SolutionCaseSource> = {}): SolutionCaseSource {
  return {
    handoff_status: '',
    solution_approved_at: '',
    solution_owner_staff_id: null,
    solution_owner_name: '',
    solution_accept_due_at: '',
    solution_claimed_at: '',
    solution_due_at: '',
    solution_released_at: '',
    solution_customer_due_at: '',
    solution_revision_note: '',
    solution_revision_due_at: '',
    ...partial,
  };
}

describe('solution work due', () => {
  it('adds 4 business hours on Monday 15:00 ICT into Tuesday 11:30 ICT', () => {
    const due = solutionWorkDueAt(new Date('2026-11-02T08:00:00.000Z'));
    expect(due.toISOString()).toBe('2026-11-03T04:30:00.000Z');
  });

  it('adds 4 hours inside Monday morning after work start', () => {
    const due = solutionWorkDueAt(new Date('2026-11-02T02:00:00.000Z'));
    expect(due.toISOString()).toBe('2026-11-02T06:00:00.000Z');
  });

  it('starts the 4 hours at 08:30 when the case arrives earlier', () => {
    const due = solutionWorkDueAt(new Date('2026-11-02T00:00:00.000Z'));
    expect(due.toISOString()).toBe('2026-11-02T05:30:00.000Z');
  });

  it('carries Tuesday 15:45 ICT into Wednesday 12:15 ICT', () => {
    const due = solutionWorkDueAt(new Date('2026-11-03T08:45:00.000Z'));
    expect(due.toISOString()).toBe('2026-11-04T05:15:00.000Z');
  });

  it('carries Friday 15:45 ICT into Monday 12:15 ICT', () => {
    const due = solutionWorkDueAt(new Date('2026-11-06T08:45:00.000Z'));
    expect(due.toISOString()).toBe('2026-11-09T05:15:00.000Z');
  });

  it('starts Saturday and Sunday at Monday 08:30 then adds 4 business hours', () => {
    expect(solutionWorkDueAt(new Date('2026-11-07T03:00:00.000Z')).toISOString()).toBe(
      '2026-11-09T05:30:00.000Z',
    );
    expect(solutionWorkDueAt(new Date('2026-11-08T03:00:00.000Z')).toISOString()).toBe(
      '2026-11-09T05:30:00.000Z',
    );
  });

  it('uses beforeCutoffHours from team settings and ignores the old cutoff clock', () => {
    const due = solutionWorkDueAt(new Date('2026-11-03T08:45:00.000Z'), {
      cutoffTime: '16:00',
      beforeCutoffHours: 4,
      afterCutoffTime: '10:00',
    });
    expect(due.toISOString()).toBe('2026-11-04T05:15:00.000Z');
  });
});

describe('buildSolutionCaseView', () => {
  const now = new Date('2026-11-05T06:00:00.000Z');

  it('hides the Solutions clock after Sale approves', () => {
    expect(
      buildSolutionCaseView(source({ handoff_status: 'released', solution_approved_at: '2026-11-05T05:00:00.000Z' }), now),
    ).toBeNull();
  });

  it('warns before the 15-minute receive and marks a miss without the CEO', () => {
    const soon = buildSolutionCaseView(
      source({
        handoff_status: 'pending',
        solution_owner_name: 'Lan',
        solution_accept_due_at: '2026-11-05T06:02:00.000Z',
      }),
      now,
    );
    expect(soon?.phase).toBe('cho_nhan');
    expect(soon?.timer_warning).toBe(true);
    expect(soon?.warning_note).toContain('15 phút');
    expect(soon?.sla_note).not.toContain('CEO');

    const late = buildSolutionCaseView(
      source({ handoff_status: 'pending', solution_accept_due_at: '2026-11-05T05:40:00.000Z' }),
      now,
    );
    expect(late?.timer_overdue).toBe(true);
    expect(late?.sla_note).toContain('15 phút');
    expect(late?.sla_note).not.toContain('CEO');
  });

  it('shows the 2-hour edit and the 8-hour customer reply', () => {
    const edit = buildSolutionCaseView(
      source({
        handoff_status: 'with_solution',
        solution_revision_note: 'Đổi kênh',
        solution_revision_due_at: '2026-11-05T07:00:00.000Z',
      }),
      now,
    );
    expect(edit?.phase).toBe('chinh_sua');
    expect(edit?.revision_note).toBe('Đổi kênh');
    expect(edit?.expected_role).toBe('AM');

    const waiting = buildSolutionCaseView(
      source({ handoff_status: 'released', solution_customer_due_at: '2026-11-05T04:00:00.000Z' }),
      now,
    );
    expect(waiting?.phase).toBe('cho_phan_hoi');
    expect(waiting?.expected_role).toBe('Sale');
    expect(waiting?.sla_note).toContain('8 giờ');
  });
});
