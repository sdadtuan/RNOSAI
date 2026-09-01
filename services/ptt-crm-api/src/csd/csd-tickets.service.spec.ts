import { CsdTicketsService } from './csd-tickets.service';

describe('CsdTicketsService', () => {
  const repo = {
    findBySource: jest.fn(),
    findByIdempotencyKey: jest.fn(),
    getDefaultSlaPolicy: jest.fn(),
    nextTicketCode: jest.fn(),
    insert: jest.fn(),
    insertActivity: jest.fn(),
    insertNotification: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    assign: jest.fn(),
    updateStatus: jest.fn(),
    addComment: jest.fn(),
    listActivities: jest.fn(),
    getAttachmentVisibility: jest.fn(),
  };
  const audit = { insert: jest.fn() };

  let svc: CsdTicketsService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new CsdTicketsService(repo as never, audit as never);
    repo.getDefaultSlaPolicy.mockResolvedValue({
      id: 'pol-1',
      workday_start: '08:30',
      workday_end: '18:00',
      workdays: [1, 2, 3, 4, 5, 6],
      at_risk_pct: 70,
      near_breach_pct: 90,
      holidays: [],
      targets: [
        { priority: 'P1', response_minutes: 60, resolution_minutes: 240 },
        { priority: 'P2', response_minutes: 240, resolution_minutes: 480 },
        { priority: 'P3', response_minutes: 480, resolution_minutes: 1440 },
      ],
    });
    repo.nextTicketCode.mockResolvedValue('PTT-2026-000002');
    repo.insert.mockImplementation(async (input) => ({
      id: 't-new',
      code: input.code,
      title: input.title,
      status: input.status,
      priority: input.priority,
      scope_status: 'in_scope',
      assignee_staff_id: input.assignee_staff_id,
    }));
  });

  it('returns existing ticket when source_ref repeats', async () => {
    repo.findBySource.mockResolvedValue({ id: 't1', code: 'PTT-2026-000001' });
    const row = await svc.create(3, {
      title: 'x',
      ticket_type: 'incident',
      priority: 'P2',
      source_type: 'chat_message',
      source_id: 'm1',
    });
    expect(row.code).toBe('PTT-2026-000001');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('rejects resolve without note', async () => {
    repo.get.mockResolvedValue({ id: 't1', status: 'in_progress', scope_status: 'in_scope' });
    await expect(svc.resolve(3, 't1', { resolution_note: '' })).rejects.toMatchObject({ status: 422 });
  });

  it('rejects in_progress when out_of_scope', async () => {
    repo.get.mockResolvedValue({ id: 't1', status: 'assigned', scope_status: 'out_of_scope' });
    await expect(svc.changeStatus(3, 't1', 'in_progress')).rejects.toMatchObject({ status: 409 });
  });

  it('creates ticket with code and activity', async () => {
    const row = await svc.create(3, {
      title: 'New ticket',
      ticket_type: 'incident',
      priority: 'P2',
    });
    expect(row.code).toBe('PTT-2026-000002');
    expect(repo.insert).toHaveBeenCalled();
    expect(repo.insertActivity).toHaveBeenCalledWith(expect.objectContaining({ event_key: 'created' }));
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'ticket.create' }));
  });
});
