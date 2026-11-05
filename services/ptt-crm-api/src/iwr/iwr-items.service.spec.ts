import { ConflictException } from '@nestjs/common';
import { IwrItemsService } from './iwr-items.service';
import type { IwrActor } from './iwr.types';

function actor(id = 3): IwrActor {
  return {
    staffId: id,
    staffLabel: 'NV',
    departmentId: 10,
    caps: [{ section: 'iwr', action: 'write' }],
  };
}

describe('IwrItemsService', () => {
  function make() {
    const repo = {
      getReport: jest.fn(),
      isRecipient: jest.fn().mockResolvedValue(false),
      listItems: jest.fn().mockResolvedValue([]),
      insertItem: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
    };
    const org = { listActiveStaff: jest.fn().mockResolvedValue([]) };
    const svc = new IwrItemsService(repo as never, org as never);
    return { svc, repo };
  }

  it('add attaches csd_ticket and stores ref_id', async () => {
    const { svc, repo } = make();
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'draft',
      author_staff_id: 3,
    });
    repo.insertItem.mockResolvedValue({
      id: 'i1',
      report_id: 'r1',
      section_key: 'done',
      title: 'Xong banner',
      body: '',
      ref_kind: 'csd_ticket',
      ref_id: 't1',
      evidence_url: null,
      sort_order: 0,
    });

    const row = await svc.add(actor(), 'r1', {
      section_key: 'done',
      title: 'Xong banner',
      body: '',
      ref_kind: 'csd_ticket',
      ref_id: 't1',
      evidence_url: null,
      sort_order: 0,
    });
    expect(row.ref_kind).toBe('csd_ticket');
    expect(row.ref_id).toBe('t1');
    expect(repo.insertItem).toHaveBeenCalled();
  });

  it('patch on acknowledged → 409 iwr_immutable', async () => {
    const { svc, repo } = make();
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'acknowledged',
      author_staff_id: 3,
    });
    await expect(
      svc.patch(actor(), 'r1', 'i1', { title: 'nope' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.patch(actor(), 'r1', 'i1', { title: 'nope' })).rejects.toMatchObject({
      response: { error: 'iwr_immutable' },
    });
  });
});
