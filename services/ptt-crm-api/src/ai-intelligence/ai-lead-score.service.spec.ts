import { AiLeadScoreService } from './ai-lead-score.service';

describe('AiLeadScoreService', () => {
  const scores = {
    tableReady: jest.fn().mockResolvedValue(true),
    findRecentAutoScore: jest.fn().mockResolvedValue(null),
    insertScore: jest.fn().mockResolvedValue({
      id: 'score-1',
      score_value: 72,
      confidence: 0.8,
      explainability_json: { factors: [], flags: [], score_band: 'hot' },
      model_name: 'rules-v1',
      model_version: 'lead-v1',
      calculated_at: '2026-07-26T09:00:00Z',
      agent_run_id: 'run-1',
    }),
    listScores: jest.fn(),
    listLatestForEntities: jest.fn().mockResolvedValue([]),
  };

  const contextRepo = {
    loadLeadScoreContext: jest.fn().mockResolvedValue({
      leadId: 99,
      clientId: 'client-1',
      channel: 'meta',
      source: 'facebook',
      campaignId: 'c1',
      externalLeadId: 'ext',
      status: 'new',
      isDuplicate: false,
      receivedAt: new Date('2026-07-26T08:00:00Z'),
      createdAt: new Date('2026-07-26T08:00:00Z'),
      firstContactAt: null,
      timelineEventCount: 1,
      meta: {},
      estimatedDealValueVnd: null,
    }),
  };

  const audit = {
    newRequestId: jest.fn().mockReturnValue('req-1'),
    wrap: jest.fn().mockResolvedValue({
      data: {
        score: 72,
        confidence: 0.8,
        explainability: { factors: [], flags: [], score_band: 'hot' },
        features: {},
      },
      runId: 'run-1',
      requestId: 'req-1',
      latencyMs: 5,
    }),
  };

  const events = {
    emit: jest.fn().mockResolvedValue('ev-1'),
  };

  const leads = {
    getLeadById: jest.fn(),
  };

  const staffAuth = {
    me: jest.fn(),
    hasCap: jest.fn().mockReturnValue(true),
  };

  let service: AiLeadScoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiLeadScoreService(
      scores as never,
      contextRepo as never,
      audit as never,
      events as never,
      leads as never,
      staffAuth as never,
    );
  });

  it('persists score and emits LeadScored', async () => {
    const res = await service.scoreLead({ leadId: 99, actorId: 'staff-1' });

    expect(res.data.score).toBe(72);
    expect(res.data.idempotent_replay).toBe(false);
    expect(scores.insertScore).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(
      'LeadScored',
      'lead',
      '99',
      expect.objectContaining({ score: 72 }),
      'req-1',
      expect.any(String),
    );
  });

  it('returns idempotent replay within window', async () => {
    scores.findRecentAutoScore.mockResolvedValueOnce({
      id: 'score-old',
      score_value: 60,
      confidence: 0.7,
      explainability_json: { factors: [], flags: [], score_band: 'warm' },
      model_name: 'rules-v1',
      model_version: 'lead-v1',
      calculated_at: '2026-07-26T08:55:00Z',
      agent_run_id: 'run-old',
    });

    const res = await service.scoreLead({ leadId: 99 });
    expect(res.data.idempotent_replay).toBe(true);
    expect(audit.wrap).not.toHaveBeenCalled();
  });
});
