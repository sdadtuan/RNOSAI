import { IwrLeaveAdapter } from './iwr-leave.adapter';

describe('IwrLeaveAdapter', () => {
  it('isOnLeave queries approved leave by email join', async () => {
    const adapter = new IwrLeaveAdapter({ databaseUrl: 'postgres://x' } as never);
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    Object.defineProperty(adapter, 'db', { get: () => ({ query }) });
    await expect(adapter.isOnLeave(3, '2026-09-03')).resolves.toBe(true);
    expect(String(query.mock.calls[0][0])).toContain('staff_leave_requests');
  });
});
