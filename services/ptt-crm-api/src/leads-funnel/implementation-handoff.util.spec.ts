import { buildImplementationHandoffView, IMPLEMENTATION_ACCEPT_MINUTES } from './implementation-handoff.util';

describe('implementation handoff', () => {
  it('exposes 15-minute claim SLA', () => {
    expect(IMPLEMENTATION_ACCEPT_MINUTES).toBe(15);
  });

  it('builds pending MKL claim view', () => {
    const due = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const view = buildImplementationHandoffView(
      {
        implementation_handoff_status: 'pending',
        implementation_owner_staff_id: null,
        implementation_owner_name: '',
        implementation_accept_due_at: due,
        implementation_claimed_at: '',
      },
      new Date(),
    );
    expect(view?.status).toBe('pending');
    expect(view?.expected_role).toBe('Marketing Leader');
    expect(view?.timer_overdue).toBe(false);
  });
});
