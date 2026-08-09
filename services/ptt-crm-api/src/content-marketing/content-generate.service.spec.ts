import { BadRequestException } from '@nestjs/common';
import { ContentGenerateService } from './content-generate.service';

describe('ContentGenerateService', () => {
  const config = { contentMarketingAiEnabled: true };
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }) };
  const repo = {
    getItemById: jest.fn(),
    createContentJob: jest.fn(),
  };
  const worker = { processJob: jest.fn() };

  let service: ContentGenerateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentGenerateService(config as never, core as never, repo as never, worker as never);
  });

  it('rejects when AI disabled', async () => {
    const off = new ContentGenerateService(
      { contentMarketingAiEnabled: false } as never,
      core as never,
      repo as never,
      worker as never,
    );
    await expect(off.startDraftJob(1, 2, {}, 'w@test.vn')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('startDraftJob creates and processes job', async () => {
    repo.getItemById.mockResolvedValue({
      id: 2,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      funnel_goal: 'engagement',
      title: 'T',
      brief_json: {},
      body_json: { markdown: '', variants: [] },
    });
    repo.createContentJob.mockResolvedValue({ id: 99, status: 'queued' });
    worker.processJob.mockResolvedValue({ id: 99, status: 'succeeded', output_json: { version_no: 2 } });

    const out = await service.startDraftJob(1, 2, { tone: 'bold' }, 'w@test.vn');
    expect(out.status).toBe('succeeded');
    expect(worker.processJob).toHaveBeenCalledWith(99);
  });
});
