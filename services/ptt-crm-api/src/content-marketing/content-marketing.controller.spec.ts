import { ContentMarketingController } from './content-marketing.controller';

describe('ContentMarketingController', () => {
  const contentMarketing = { getContext: jest.fn() };
  const ideas = { listIdeas: jest.fn(), createIdea: jest.fn(), patchIdea: jest.fn(), convertIdea: jest.fn() };
  const items = { listItems: jest.fn(), getItem: jest.fn(), createItem: jest.fn(), patchItem: jest.fn() };

  let controller: ContentMarketingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentMarketingController(
      contentMarketing as never,
      ideas as never,
      items as never,
    );
  });

  it('GET context delegates to service', async () => {
    contentMarketing.getContext.mockResolvedValue({ lifecycle_id: 123, ok: true });
    await expect(controller.context(123)).resolves.toEqual({ lifecycle_id: 123, ok: true });
    expect(contentMarketing.getContext).toHaveBeenCalledWith(123);
  });

  it('GET ideas delegates to idea service', async () => {
    ideas.listIdeas.mockResolvedValue({ ideas: [] });
    await expect(controller.listIdeas(123, 'backlog', undefined)).resolves.toEqual({ ideas: [] });
    expect(ideas.listIdeas).toHaveBeenCalledWith(123, { status: 'backlog', pillar_id: undefined });
  });
});
