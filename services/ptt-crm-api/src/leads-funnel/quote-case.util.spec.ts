import {
  buildQuoteCaseView,
  isCeoPosition,
  preferredMarketingLeaderId,
  type QuoteCaseSource,
} from './quote-case.util';

function row(partial: Partial<QuoteCaseSource> = {}): QuoteCaseSource {
  return {
    handoff_status: 'released',
    solution_approved_at: '',
    quote_offered_at: '',
    quote_accept_due_at: '',
    quote_accepted_at: '',
    quote_due_at: '',
    quote_sent_back_at: '',
    quote_change_note: '',
    quote_approved_at: '',
    quote_assignee_staff_id: null,
    quote_assignee_name: '',
    quote_reassign_note: '',
    implementation_status: '',
    ...partial,
  };
}

describe('buildQuoteCaseView', () => {
  const now = new Date('2026-11-05T06:00:00.000Z');

  it('hides the quote handoff until Solution is submitted', () => {
    expect(buildQuoteCaseView(row({ handoff_status: 'with_solution' }), now)).toBeNull();
  });

  it('shows Sale review after nộp báo giá even when Solution is still with the team', () => {
    const view = buildQuoteCaseView(
      row({
        handoff_status: 'with_solution',
        quote_accepted_at: '2026-11-05T05:00:00.000Z',
        quote_sent_back_at: '2026-11-05T05:10:00.000Z',
        quote_due_at: '2026-11-05T06:00:00.000Z',
      }),
      now,
    );
    expect(view?.phase).toBe('sale_review');
    expect(view?.expected_role).toBe('Sale');
    expect(view?.timer_stopped).toBe(true);
    expect(view?.timer_due_at).toBe('');
  });

  it('returns Sale’s note to Marketing Leader on a lead still in the Báo giá column', () => {
    const view = buildQuoteCaseView(
      row({
        handoff_status: 'with_solution',
        quote_accepted_at: '2026-11-05T05:00:00.000Z',
        quote_change_note: 'Giảm giờ thiết kế',
        quote_due_at: '2026-11-05T06:30:00.000Z',
      }),
      now,
    );
    expect(view?.phase).toBe('bao_gia');
    expect(view?.expected_role).toBe('Marketing Leader');
    expect(view?.change_note).toBe('Giảm giờ thiết kế');
    expect(view?.timer_label).toBe('Hạn nộp báo giá');
  });

  it('waits for Sale Approve, then names Chuyển Báo Giá', () => {
    expect(buildQuoteCaseView(row(), now)?.phase).toBe('sale_approve_solution');
    const offered = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T05:50:00.000Z',
        quote_offered_at: '2026-11-05T05:50:00.000Z',
        quote_accept_due_at: '2026-11-05T06:05:00.000Z',
        quote_assignee_staff_id: 8,
        quote_assignee_name: 'Lan',
      }),
      now,
    );
    expect(offered?.step_label).toBe('Chuyển Báo Giá');
    expect(offered?.expected_role).toBe('Marketing Leader');
    expect(offered?.assignee_name).toBe('Lan');
    expect(offered?.timer_overdue).toBe(false);
    expect(offered?.timer_warning).toBe(false);
    expect(offered?.sla_note).toBe('');
    expect(offered?.timer_due_at).toBe('2026-11-05T06:05:00.000Z');
  });

  it('warns just before the 15-minute accept', () => {
    const view = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T05:50:00.000Z',
        quote_accept_due_at: '2026-11-05T06:02:00.000Z',
      }),
      now,
    );
    expect(view?.timer_warning).toBe(true);
    expect(view?.warning_note).toContain('15 phút');
    expect(view?.sla_note).toBe('');
  });

  it('keeps a missed 15-minute accept with the same Marketing Leader and reports the CEO', () => {
    const view = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T05:40:00.000Z',
        quote_accept_due_at: '2026-11-05T05:55:00.000Z',
        quote_assignee_staff_id: 8,
        quote_assignee_name: 'Lan',
        quote_ceo_escalated_at: '2026-11-05T05:55:01.000Z',
        quote_late_events: [
          {
            staff_id: 8,
            staff_name: 'Lan',
            timer: 'accept',
            timer_label: 'Nhận case 15 phút',
            due_at: '2026-11-05T05:55:00.000Z',
            logged_at: '2026-11-05T05:55:01.000Z',
          },
        ],
      }),
      now,
    );
    expect(view?.timer_overdue).toBe(true);
    expect(view?.assignee_staff_id).toBe(8);
    expect(view?.assignee_name).toBe('Lan');
    expect(view?.sla_note).toContain('15 phút');
    expect(view?.sla_note).toContain('CEO');
    expect(view?.sla_note).not.toMatch(/chuyển cho/i);
    expect(view?.timer_label).toBe('Hạn nhận case');
    expect(view?.ceo_escalation?.timer).toBe('accept');
    expect(view?.ceo_escalation?.staff_name).toBe('Lan');
    expect(view?.ceo_escalation?.since).toBe('2026-11-05T05:55:00.000Z');
    expect(view?.late_events).toHaveLength(1);
  });

  it('marks the 2-hour quote deadline only after accept and keeps the same assignee', () => {
    const view = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T03:00:00.000Z',
        quote_accepted_at: '2026-11-05T03:30:00.000Z',
        quote_due_at: '2026-11-05T05:30:00.000Z',
        quote_assignee_staff_id: 8,
        quote_assignee_name: 'Lan',
      }),
      now,
    );
    expect(view?.phase).toBe('bao_gia');
    expect(view?.assignee_staff_id).toBe(8);
    expect(view?.timer_overdue).toBe(true);
    expect(view?.sla_note).toContain('2 giờ');
    expect(view?.sla_note).toContain('CEO');
    expect(view?.ceo_escalation?.timer).toBe('finish');
    expect(view?.ceo_escalation?.timer_label).toContain('2 giờ');
  });

  it('shows the change note to Marketing Leader and Triển Khai only after Approve', () => {
    const editing = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T03:00:00.000Z',
        quote_accepted_at: '2026-11-05T03:30:00.000Z',
        quote_change_note: 'Giảm giờ thiết kế',
        quote_due_at: '2026-11-05T06:30:00.000Z',
      }),
      now,
    );
    expect(editing?.phase).toBe('bao_gia');
    expect(editing?.change_note).toBe('Giảm giờ thiết kế');
    expect(editing?.expected_role).toBe('Marketing Leader');

    const done = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T03:00:00.000Z',
        quote_accepted_at: '2026-11-05T03:30:00.000Z',
        quote_sent_back_at: '2026-11-05T04:00:00.000Z',
        quote_approved_at: '2026-11-05T04:10:00.000Z',
        quote_due_at: '2026-11-05T05:00:00.000Z',
      }),
      now,
    );
    expect(done?.step_label).toBe('Triển Khai');
    expect(done?.implementation_status).toBe('trien_khai');
    expect(done?.timer_stopped).toBe(true);
    expect(done?.quote_due_at).toBe('');
  });
});

describe('Marketing Leader quote assignment', () => {
  it('keeps the Solution owner when they are a Marketing Leader', () => {
    expect(preferredMarketingLeaderId([4, 9], 9)).toBe(9);
    expect(preferredMarketingLeaderId([4, 9], 3)).toBe(4);
    expect(preferredMarketingLeaderId([], 9)).toBeNull();
  });

  it('recognizes only the CEO position for a quote transfer', () => {
    expect(isCeoPosition('CEO')).toBe(true);
    expect(isCeoPosition(' ceo ')).toBe(true);
    expect(isCeoPosition('MKL')).toBe(false);
    expect(isCeoPosition('GDKD-01')).toBe(false);
    expect(isCeoPosition(null)).toBe(false);
  });
});
