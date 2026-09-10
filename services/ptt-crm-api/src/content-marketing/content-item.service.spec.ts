import { ConflictException } from '@nestjs/common';
import { ContentItemService } from './content-item.service';

describe('ContentItemService brief lock', () => {
  const config = {};
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({}) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentItemService(config as never, core as never, repo as never);
  });

  it('persists brief_score when patching brief_json', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_json: {},
      body_json: { markdown: '' },
    });
    repo.patchItem.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_score: 15,
      brief_json: { objective: 'Lead gen' },
    });

    await service.patchItem(1, 7, { brief_json: { objective: 'Lead gen' } }, 'sp@test.vn');

    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({
        brief_json: { objective: 'Lead gen' },
        brief_score: 15,
      }),
    );
  });

  it('rejects brief_json patch when locked without force_version', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_locked_at: '2026-09-10T00:00:00.000Z',
      brief_json: { objective: 'Old' },
      body_json: { markdown: '' },
    });

    await expect(
      service.patchItem(1, 7, { brief_json: { objective: 'New' } }, 'sp@test.vn'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.patchItem(1, 7, { brief_json: { objective: 'New' } }, 'sp@test.vn'),
    ).rejects.toMatchObject({ response: { error: 'brief_locked' } });
    expect(repo.patchItem).not.toHaveBeenCalled();
  });

  it('allows locked brief patch when force_version is true and audits', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_locked_at: '2026-09-10T00:00:00.000Z',
      brief_json: { objective: 'Old' },
      body_json: { markdown: 'body' },
    });
    repo.patchItem.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_json: { objective: 'New' },
      body_json: { markdown: 'body' },
    });

    await service.patchItem(
      1,
      7,
      { brief_json: { objective: 'New' }, force_version: true },
      'sp@test.vn',
    );

    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({ brief_json: { objective: 'New' }, brief_score: 15 }),
    );
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      7,
      { markdown: 'body' },
      'sp@test.vn',
      'brief_force_version',
    );
  });

  it('lockBrief sets brief_locked_at', async () => {
    repo.getItemById.mockResolvedValue({
      id: 7,
      status: 'draft',
      brief_json: {},
      body_json: { markdown: '' },
    });
    repo.patchItem.mockResolvedValue({
      id: 7,
      brief_locked_at: '2026-09-10T12:00:00.000Z',
    });

    const out = await service.lockBrief(1, 7);
    expect(out.brief_locked_at).toBeTruthy();
    expect(repo.patchItem).toHaveBeenCalledWith(
      1,
      7,
      expect.objectContaining({ brief_locked_at: expect.any(String) }),
    );
  });
});
