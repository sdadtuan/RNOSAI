import { AmTasksService } from './am-tasks.service';

describe('AmTasksService', () => {
  const audit = {
    calls: [] as Array<{ action: string }>,
    insert: jest.fn(async (row: { action: string }) => {
      audit.calls.push(row);
    }),
  };

  const repo = {
    findById: jest.fn(),
    accept: jest.fn(),
    findOpenBySourceRef: jest.fn(),
    insert: jest.fn(),
    dismiss: jest.fn(),
  };

  let service: AmTasksService;

  beforeEach(() => {
    audit.calls.length = 0;
    jest.clearAllMocks();
    repo.findById.mockResolvedValue({
      id: 'task-1',
      assignee_staff_id: null,
      status: 'new',
    });
    repo.accept.mockImplementation(async (id: string, staffId: number) => ({
      id,
      assignee_staff_id: staffId,
      status: 'in_progress',
    }));
    repo.findOpenBySourceRef.mockResolvedValue({ id: 'existing', source: 'csd', source_ref: 'T-1' });
    service = new AmTasksService(repo as never, audit as never);
  });

  it('accept assigns current staff and writes audit', async () => {
    const out = await service.accept('task-1', 42);
    expect(out.assignee_staff_id).toBe(42);
    expect(out.status).toBe('in_progress');
    expect(audit.calls[0].action).toBe('task.accept');
  });

  it('rejects duplicate open source_ref', async () => {
    await expect(
      service.create(
        {
          agency_client_id: 'c1',
          title: 'A',
          source: 'csd',
          source_ref: 'T-1',
        },
        1,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
