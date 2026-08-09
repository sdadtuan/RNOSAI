import { ContentJobWorkerService } from './content-job-worker.service';

describe('ContentJobWorkerService', () => {
  const config = { mktAiModel: 'gpt-4o-mini' };
  const aiConfig = { llmApiKey: '', llmModel: 'gpt-4o-mini' };
  const llm = {
    completeJson: jest.fn().mockResolvedValue({
      parsed: { markdown: '# Draft\n\nBody text.' },
      tokenUsage: {},
      modelName: 'gpt-4o-mini',
      stubMode: true,
    }),
  };
  const agentRuns = { tableReady: jest.fn().mockResolvedValue(false), insertRun: jest.fn() };
  const repo = {
    claimContentJob: jest.fn(),
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn().mockResolvedValue(2),
    finishContentJob: jest.fn(),
  };
  const brandContext = {
    resolveForLifecycle: jest.fn().mockResolvedValue({ brand_name: 'Acme' }),
  };

  const mediaImages = {
    providerName: 'stub',
    generateImages: jest.fn().mockResolvedValue([
      {
        id: 'asset-1',
        type: 'image',
        url: 'https://picsum.photos/seed/test/1080/1080',
        ai_generated: true,
        provider: 'stub',
        selected: true,
        draft_watermark: false,
        prompt_hash: 'abc',
        visual_qa_score: 84,
      },
    ]),
  };

  let worker: ContentJobWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ContentJobWorkerService(
      config as never,
      aiConfig as never,
      llm as never,
      agentRuns as never,
      repo as never,
      brandContext as never,
      mediaImages as never,
    );
  });

  it('processJob draft_generate updates item body', async () => {
    repo.claimContentJob.mockResolvedValue({
      id: 10,
      lifecycle_id: 1,
      item_id: 5,
      job_type: 'draft_generate',
      input_json: { tone: 'professional_friendly' },
      created_by: 'w@test.vn',
    });
    repo.getItemById.mockResolvedValue({
      id: 5,
      channel: 'facebook',
      format: 'social_post',
      title: 'Post',
      funnel_goal: 'engagement',
      brief_json: {},
      body_json: { markdown: '', variants: [] },
    });
    repo.finishContentJob.mockImplementation((_id, patch) => ({ id: 10, status: patch.status, output_json: patch.output_json }));

    const out = await worker.processJob(10);
    expect(repo.patchItem).toHaveBeenCalled();
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ markdown: expect.stringContaining('Draft') }),
      'w@test.vn',
      'ai_generate',
      null,
    );
    expect(out?.status).toBe('succeeded');
  });
});
