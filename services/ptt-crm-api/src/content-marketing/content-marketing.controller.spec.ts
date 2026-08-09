import { ContentMarketingController } from './content-marketing.controller';

describe('ContentMarketingController', () => {
  const contentMarketing = {
    getContext: jest.fn(),
  };

  let controller: ContentMarketingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentMarketingController(contentMarketing as never);
  });

  it('GET context delegates to service', async () => {
    contentMarketing.getContext.mockResolvedValue({ lifecycle_id: 123, ok: true });
    await expect(controller.context(123)).resolves.toEqual({ lifecycle_id: 123, ok: true });
    expect(contentMarketing.getContext).toHaveBeenCalledWith(123);
  });
});
