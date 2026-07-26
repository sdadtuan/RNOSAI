import { Test, TestingModule } from '@nestjs/testing';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { DealScoreContextRepository } from './deal-score-context.repository';

describe('PipelineRiskService', () => {
  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-1'),
    wrap: jest.fn(async (_meta, fn) => {
      const data = await fn();
      return { ...data, runId: 'run-1' };
    }),
  };
  const dealContext = {
    listOpenDealIds: jest.fn().mockReturnValue([101]),
    loadDealScoreContext: jest.fn(),
  };
  const recommendations = {
    tableReady: jest.fn().mockResolvedValue(true),
    findRecentPendingByType: jest.fn().mockResolvedValue(null),
    dismissPendingByTypeForEntity: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    listPendingByType: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    latestScanTimestamp: jest.fn().mockResolvedValue(null),
  };

  let service: PipelineRiskService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineRiskService,
        { provide: AiAuditService, useValue: audit },
        { provide: DealScoreContextRepository, useValue: dealContext },
        { provide: AiRecommendationsRepository, useValue: recommendations },
      ],
    }).compile();
    service = module.get(PipelineRiskService);
  });

  it('creates pipeline_risk alert for stalled deal', async () => {
    const stale = new Date(Date.now() - 10 * 86_400_000);
    dealContext.loadDealScoreContext.mockReturnValue({
      dealId: 101,
      title: 'Deal A',
      pipelineStage: 'sql',
      isTerminal: false,
      dealValueVnd: 10_000_000,
      stageEnteredAt: stale,
      updatedAt: stale,
      lastActivityAt: stale,
      activityCount7d: 0,
      status: 'open',
      clientId: null,
    });

    const out = await service.scanDaily({ correlationId: 'scan-1' });
    expect(out.data.at_risk_found).toBe(1);
    expect(out.data.alerts_created).toBe(1);
    expect(recommendations.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'deal',
        entityId: '101',
        recommendationType: 'pipeline_risk',
      }),
    );
  });

  it('clears pending alert when deal no longer stalled', async () => {
    const recent = new Date();
    dealContext.loadDealScoreContext.mockReturnValue({
      dealId: 101,
      title: 'Deal B',
      pipelineStage: 'sql',
      isTerminal: false,
      dealValueVnd: 10_000_000,
      stageEnteredAt: recent,
      updatedAt: recent,
      lastActivityAt: recent,
      activityCount7d: 3,
      status: 'open',
      clientId: null,
    });
    recommendations.dismissPendingByTypeForEntity.mockResolvedValue(1);

    const out = await service.scanDaily();
    expect(out.data.alerts_cleared).toBe(1);
    expect(recommendations.insert).not.toHaveBeenCalled();
  });
});
