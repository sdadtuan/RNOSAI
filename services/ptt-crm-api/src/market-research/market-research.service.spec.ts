import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { MarketResearchService } from './market-research.service';
import type { ResearchProjectRow } from './market-research.types';

const project: ResearchProjectRow = {
  id: 9,
  client_id: 'acme',
  client_name: 'Acme',
  lifecycle_id: null,
  title: 'Secret title must not leak',
  product_type: 'CAT_REVIEW',
  dv12_tier: 'CB',
  decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
  geo: ['VN'],
  languages: ['vi'],
  risk_class: 'low',
  status: 'intake',
  owner_user_id: null,
  data_residency: null,
  related_sales_market_id: null,
  created_by: 'am@ptt',
  updated_by: 'am@ptt',
  created_at: '2026-08-14',
  updated_at: '2026-08-14',
  rq_count: 0,
  verified_insight_count: 0,
};

describe('MarketResearchService', () => {
  const repo = {
    getProjectClientId: jest.fn(),
    getProject: jest.fn(),
    listProjects: jest.fn(),
    createProject: jest.fn(),
    listQuestions: jest.fn(),
    patchProject: jest.fn(),
  };
  const clientScope = {
    allowedClientIdsForList: jest.fn(),
    assertListClientFilter: jest.fn(),
  };

  let service: MarketResearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketResearchService(repo as never, clientScope as never);
  });

  it('createProject throws validation_error without hitting the repository', async () => {
    await expect(
      service.createProject({ restricted: false, allowedClientIds: [] }, {} as never, 'am@ptt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it('getProject outside scope is 403 without title in the body', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.getProject).not.toHaveBeenCalled();
  });

  it('patchProject intake→designed with rqCount=0 is invalid_transition need_rq', async () => {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.patchProject(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { status: 'designed' },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({
        error: 'invalid_transition',
        reason: 'need_rq',
      });
    }
    expect(repo.patchProject).not.toHaveBeenCalled();
  });
});
