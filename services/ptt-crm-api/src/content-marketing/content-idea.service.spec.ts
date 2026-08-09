import { BadRequestException } from '@nestjs/common';
import { ContentIdeaService } from './content-idea.service';
import { ContentItemService } from './content-item.service';
import { ContentMarketingService } from './content-marketing.service';

describe('ContentIdeaService', () => {
  const core = {
    ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }),
  };
  const repo = {
    listIdeas: jest.fn(),
    createIdea: jest.fn(),
    getIdeaById: jest.fn(),
    patchIdea: jest.fn(),
  };
  const items = {
    createItemFromIdea: jest.fn(),
  };

  let service: ContentIdeaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentIdeaService(core as never, repo as never, items as never);
  });

  it('createIdea rejects empty title', async () => {
    await expect(service.createIdea(1, { title: '  ' }, 'a@test.vn')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('convertIdea creates item and marks idea converted', async () => {
    repo.getIdeaById.mockResolvedValue({
      id: 5,
      title: 'Idea A',
      target_goal: 'engagement',
      hook: 'h',
      meta_json: {},
      status: 'backlog',
    });
    items.createItemFromIdea.mockResolvedValue({ id: 99, status: 'draft' });
    repo.patchIdea.mockResolvedValue({ id: 5, status: 'converted' });

    const out = await service.convertIdea(
      1,
      5,
      { channel: 'facebook', format: 'social_post' },
      'writer@test.vn',
    );
    expect(out.item.id).toBe(99);
    expect(repo.patchIdea).toHaveBeenCalledWith(1, 5, { status: 'converted' });
  });
});

describe('ContentItemService', () => {
  const core = {
    ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }),
  };
  const repo = {
    listItems: jest.fn(),
    getItemById: jest.fn(),
    createItem: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
  };

  let service: ContentItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentItemService(core as never, repo as never);
  });

  it('createItem rejects invalid channel format', async () => {
    await expect(
      service.createItem(
        1,
        { title: 'T', channel: 'facebook', format: 'blog' },
        'a@test.vn',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patchItem writes version on body change', async () => {
    repo.getItemById.mockResolvedValue({
      id: 10,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      body_json: { markdown: '' },
    });
    repo.patchItem.mockResolvedValue({
      id: 10,
      body_json: { markdown: 'updated' },
    });

    await service.patchItem(1, 10, { body_json: { markdown: 'updated' } }, 'writer@test.vn');
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      10,
      { markdown: 'updated' },
      'writer@test.vn',
      'manual',
    );
  });
});
