import { buildQuoteCaseView, type QuoteCaseSource } from './quote-case.util';

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
      }),
      now,
    );
    expect(view?.phase).toBe('sale_review');
    expect(view?.expected_role).toBe('Sale');
  });

  it('returns Sale’s note to Marketing Leader on a lead still in the Báo giá column', () => {
    const view = buildQuoteCaseView(
      row({
        handoff_status: 'with_solution',
        quote_accepted_at: '2026-11-05T05:00:00.000Z',
        quote_change_note: 'Giảm giờ thiết kế',
      }),
      now,
    );
    expect(view?.phase).toBe('bao_gia');
    expect(view?.expected_role).toBe('Marketing Leader');
    expect(view?.change_note).toBe('Giảm giờ thiết kế');
  });

  it('waits for Sale Approve, then names Chuyển Báo Giá', () => {
    expect(buildQuoteCaseView(row(), now)?.phase).toBe('sale_approve_solution');
    const offered = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T05:50:00.000Z',
        quote_offered_at: '2026-11-05T05:50:00.000Z',
        quote_accept_due_at: '2026-11-05T06:05:00.000Z',
      }),
      now,
    );
    expect(offered?.step_label).toBe('Chuyển Báo Giá');
    expect(offered?.expected_role).toBe('Marketing Leader');
    expect(offered?.ceo_escalation).toBe('');
  });

  it('escalates the new 15-minute accept deadline to CEO', () => {
    const view = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T05:40:00.000Z',
        quote_accept_due_at: '2026-11-05T05:55:00.000Z',
      }),
      now,
    );
    expect(view?.ceo_escalation).toContain('15 phút');
    expect(view?.ceo_escalation).toContain('CEO');
  });

  it('escalates the 2-hour quote deadline only after accept', () => {
    const view = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T03:00:00.000Z',
        quote_accepted_at: '2026-11-05T03:30:00.000Z',
        quote_due_at: '2026-11-05T05:30:00.000Z',
      }),
      now,
    );
    expect(view?.phase).toBe('bao_gia');
    expect(view?.ceo_escalation).toContain('2 tiếng');
  });

  it('shows the change note to Marketing Leader and Triển Khai only after Approve', () => {
    const editing = buildQuoteCaseView(
      row({
        solution_approved_at: '2026-11-05T03:00:00.000Z',
        quote_accepted_at: '2026-11-05T03:30:00.000Z',
        quote_change_note: 'Giảm giờ thiết kế',
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
      }),
      now,
    );
    expect(done?.step_label).toBe('Triển Khai');
    expect(done?.implementation_status).toBe('trien_khai');
  });
});
