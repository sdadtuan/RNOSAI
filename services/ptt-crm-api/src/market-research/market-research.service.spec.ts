import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { MarketResearchService } from './market-research.service';
import type { ResearchEvidenceRow, ResearchInsightRow, ResearchProjectRow } from './market-research.types';

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
    listSources: jest.fn(),
    listEvidence: jest.fn(),
    listInsights: jest.fn(),
    patchProject: jest.fn(),
    createSource: jest.fn(),
    getSource: jest.fn(),
    patchSourceKeep: jest.fn(),
    createEvidence: jest.fn(),
    getEvidence: jest.fn(),
    patchEvidence: jest.fn(),
    verifyEvidence: jest.fn(),
    supersedeEvidence: jest.fn(),
    getInsight: jest.fn(),
    countVerifiedEvidenceForInsight: jest.fn(),
    updateInsightStatus: jest.fn(),
    insertReview: jest.fn(),
    replaceInsightEvidence: jest.fn(),
    patchInsight: jest.fn(),
    getQuestion: jest.fn(),
    findInFlightDeskRun: jest.fn(),
    findInFlightDeepRun: jest.fn(),
    findInFlightTriangulateRun: jest.fn(),
    acceptSingleSource: jest.fn(),
    insertAiRun: jest.fn(),
    failAiRun: jest.fn(),
    succeedAiRun: jest.fn(),
    getAiRun: jest.fn(),
    listRecentAiRuns: jest.fn(),
    sumTavilyCredits: jest.fn(),
    createInsight: jest.fn(),
    createReportDraft: jest.fn(),
    insertReportVersion: jest.fn(),
    listReports: jest.fn(),
    getReport: jest.fn(),
    getReportVersion: jest.fn(),
    listCompetitors: jest.fn(),
    getCompetitor: jest.fn(),
    createCompetitor: jest.fn(),
    patchCompetitor: jest.fn(),
    createCompetitorSnapshot: jest.fn(),
    listApprovedInsightsByClient: jest.fn(),
  };
  const plans = {
    getPlanById: jest.fn(),
    patchPlan: jest.fn(),
  };
  const llm = {
    isConfigured: jest.fn(),
    completeJson: jest.fn(),
  };
  const clientScope = {
    allowedClientIdsForList: jest.fn(),
    assertListClientFilter: jest.fn(),
  };
  const jobQueue = {
    enqueueResearchDeskJob: jest.fn(),
    enqueueResearchDeepJob: jest.fn(),
    enqueueResearchTriangulateJob: jest.fn(),
  };
  const config = {
    researchDeepProvider: 'openai',
    maxTavilyCreditsPerResearch: 12,
  };

  let service: MarketResearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.researchDeepProvider = 'openai';
    config.maxTavilyCreditsPerResearch = 12;
    llm.isConfigured.mockReturnValue(true);
    service = new MarketResearchService(
      repo as never,
      clientScope as never,
      jobQueue as never,
      config as never,
      llm as never,
      plans as never,
    );
  });

  function stubScopedProject(): void {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
  }

  it('createProject throws validation_error without hitting the repository', async () => {
    await expect(
      service.createProject({ restricted: false, allowedClientIds: [] }, {} as never, 'am@ptt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it('getProject toDetail uses config maxTavilyCreditsPerResearch', async () => {
    stubScopedProject();
    repo.listQuestions.mockResolvedValue([]);
    repo.listSources.mockResolvedValue([]);
    repo.listEvidence.mockResolvedValue([]);
    repo.listInsights.mockResolvedValue([]);
    repo.listRecentAiRuns.mockResolvedValue([]);
    repo.sumTavilyCredits.mockResolvedValue(0);
    config.maxTavilyCreditsPerResearch = 6;

    const out = await service.getProject(9, { restricted: true, allowedClientIds: ['acme'] });
    expect(out.tavily_credits_limit).toBe(6);
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

  it('createSnapshot without source_id is 400 validation_error', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue({
      id: 4,
      project_id: 9,
      name: 'Vinamilk',
      aliases: [],
      created_by: 'am@ptt',
      created_at: '2026-08-14',
      updated_at: '2026-08-14',
      snapshots: [],
    });

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { observed_at: '2026-08-01', kind: 'fact', fact: { price: '12000' } },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'validation_error',
        messages: expect.arrayContaining(['source_id is required']),
      });
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('createSnapshot Similarweb unknown tier with limitation_note inserts', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());
    repo.getSource.mockResolvedValue(
      similarwebSource({ reliability_tier: 'unknown' }),
    );
    repo.createCompetitorSnapshot.mockResolvedValue({
      id: 1,
      competitor_id: 4,
      project_id: 9,
      source_id: 11,
      observed_at: '2026-08-01',
      kind: 'fact',
      fact: { price: '12000' },
      limitation_note: 'Paid panel estimate',
      created_by: 'am@ptt',
      created_at: '2026-08-14',
    });

    await service.createSnapshot(
      4,
      { restricted: true, allowedClientIds: ['acme'] },
      {
        source_id: 11,
        observed_at: '2026-08-01',
        kind: 'fact',
        fact: { price: '12000' },
        limitation_note: 'Paid panel estimate',
      },
      'am@ptt',
    );

    expect(repo.createCompetitorSnapshot).toHaveBeenCalled();
  });

  it('createSnapshot Similarweb unknown tier without note is 400 limitation_required', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());
    repo.getSource.mockResolvedValue(
      similarwebSource({ reliability_tier: 'unknown' }),
    );

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        { source_id: 11, observed_at: '2026-08-01', kind: 'fact', fact: { price: '12000' } },
        'am@ptt',
      );
      throw new Error('expected limitation_required');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'limitation_required' }),
      );
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('createSnapshot Similarweb high tier with note is 400 reliability_capped', async () => {
    stubScopedProject();
    repo.getCompetitor.mockResolvedValue(competitorRow());
    repo.getSource.mockResolvedValue(similarwebSource({ reliability_tier: 'high' }));

    try {
      await service.createSnapshot(
        4,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          source_id: 11,
          observed_at: '2026-08-01',
          kind: 'fact',
          fact: { price: '12000' },
          limitation_note: 'Paid panel estimate',
        },
        'am@ptt',
      );
      throw new Error('expected reliability_capped');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'reliability_capped' }),
      );
    }
    expect(repo.createCompetitorSnapshot).not.toHaveBeenCalled();
  });

  it('listCompetitors outside scope is 403 without competitor name in the body', async () => {
    repo.getProjectClientId.mockResolvedValue('other-client');
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listCompetitors.mockResolvedValue([
      { id: 4, project_id: 9, name: 'SecretRivalName', aliases: [], snapshots: [] },
    ]);

    try {
      await service.listCompetitors(9, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('SecretRivalName');
      expect(JSON.stringify(body)).not.toContain('name');
    }
    expect(repo.listCompetitors).not.toHaveBeenCalled();
  });

  it('createEvidence with value_num but missing unit/base/period/geo is validation_error (BR-RES-02)', async () => {
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.createEvidence(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          source_id: 1,
          locator: 'https://example.com#p3',
          value_num: 12.5,
        },
        'am@ptt',
      );
      throw new Error('expected validation_error');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'validation_error',
        messages: expect.arrayContaining(['unit is required', 'value_base is required', 'period_note is required', 'geography is required']),
      });
    }
    expect(repo.createEvidence).not.toHaveBeenCalled();
  });

  it('patchEvidence content when verified is 409 evidence_immutable', async () => {
    const verified: ResearchEvidenceRow = {
      id: 3,
      project_id: 9,
      source_id: 1,
      study_id: null,
      question_id: null,
      locator: 'https://example.com#p3',
      excerpt: 'locked excerpt',
      value_num: null,
      unit: null,
      value_base: null,
      period_note: null,
      geography: null,
      captured_at: '2026-08-14',
      pii_class: 'none',
      qc_status: 'verified',
      checksum: 'abc',
      created_by: 'am@ptt',
      superseded_by: null,
      created_at: '2026-08-14',
    };
    repo.getEvidence.mockResolvedValue(verified);
    repo.getProjectClientId.mockResolvedValue('acme');
    repo.getProject.mockResolvedValue(project);
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);

    try {
      await service.patchEvidence(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { excerpt: 'changed' },
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.patchEvidence).not.toHaveBeenCalled();
  });

  it('patchEvidence locator-only keeps existing pii_class', async () => {
    const existing = evidenceRow({
      pii_class: 'pii_restricted',
      excerpt: 'public market size excerpt',
      qc_status: 'pending',
    });
    repo.getEvidence.mockResolvedValue(existing);
    stubScopedProject();
    repo.patchEvidence.mockImplementation(async (_id, input) => ({
      ...existing,
      locator: input.locator ?? existing.locator,
      pii_class: input.pii_class ?? existing.pii_class,
    }));

    const out = await service.patchEvidence(
      3,
      { restricted: true, allowedClientIds: ['acme'] },
      { locator: 'new' },
    );

    expect(out.pii_class).toBe('pii_restricted');
    expect(repo.patchEvidence).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ locator: 'new', pii_class: 'pii_restricted' }),
    );
  });

  it('patchEvidence when superseded is 409 evidence_immutable', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'superseded', checksum: 'abc', superseded_by: 4 }));
    stubScopedProject();

    try {
      await service.patchEvidence(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { excerpt: 'changed' },
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.patchEvidence).not.toHaveBeenCalled();
  });

  it('verifyEvidence when rejected is 409 evidence_immutable', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'rejected' }));
    stubScopedProject();

    try {
      await service.verifyEvidence(3, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_immutable' });
    }
    expect(repo.verifyEvidence).not.toHaveBeenCalled();
  });

  it('supersede identical 6-tuple then verify successor does not throw', async () => {
    const verified = evidenceRow({ qc_status: 'verified', checksum: 'abc' });
    const successor = evidenceRow({
      id: 4,
      qc_status: 'pending',
      checksum: null,
      superseded_by: null,
    });
    const verifiedSuccessor = evidenceRow({
      id: 4,
      qc_status: 'verified',
      checksum: 'abc',
    });
    stubScopedProject();
    repo.getSource.mockResolvedValue({ id: 1, project_id: 9 });
    repo.getEvidence.mockResolvedValueOnce(verified).mockResolvedValueOnce(successor);
    repo.supersedeEvidence.mockResolvedValue({
      old: evidenceRow({ qc_status: 'superseded', checksum: 'abc', superseded_by: 4 }),
      evidence: successor,
    });
    repo.verifyEvidence.mockResolvedValue(verifiedSuccessor);

    const body = {
      source_id: 1,
      locator: verified.locator,
      excerpt: verified.excerpt,
      value_num: verified.value_num,
      unit: verified.unit,
      value_base: verified.value_base,
      period_note: verified.period_note,
      geography: verified.geography,
    };
    await expect(
      service.supersedeEvidence(3, { restricted: true, allowedClientIds: ['acme'] }, body, 'am@ptt'),
    ).resolves.toMatchObject({ evidence: { id: 4, qc_status: 'pending' } });
    await expect(
      service.verifyEvidence(4, { restricted: true, allowedClientIds: ['acme'] }),
    ).resolves.toMatchObject({ id: 4, qc_status: 'verified' });
  });

  it('verifyEvidence maps PG unique violation 23505 to 409 evidence_duplicate_checksum', async () => {
    repo.getEvidence.mockResolvedValue(evidenceRow({ qc_status: 'pending' }));
    stubScopedProject();
    const pgErr = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    repo.verifyEvidence.mockRejectedValue(pgErr);

    try {
      await service.verifyEvidence(3, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'evidence_duplicate_checksum' });
    }
  });

  it('submitReview with 0 verified evidence is 400 insight_gate', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        confidence_rationale: 'Method OK',
        status: 'draft',
        confidence_json: validRubric,
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(0);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected insight_gate');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'insight_gate',
        messages: ['missing_verified_evidence'],
      });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('submitReview missing rubric is 400 missing_confidence_rubric', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ confidence_rationale: 'Method OK', status: 'draft', confidence_json: null }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected insight_gate');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({
        error: 'insight_gate',
        messages: ['missing_confidence_rubric'],
      });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('submitReview persists computed confidence_json and sets analyst_verified', async () => {
    stubScopedProject();
    const current = insightRow({
      confidence_rationale: 'Nguồn verified, sample 2025',
      status: 'draft',
      confidence_json: validRubric,
    });
    const verified = insightRow({ ...current, status: 'analyst_verified' });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.patchInsight.mockResolvedValue(current);
    repo.updateInsightStatus.mockResolvedValue(verified);

    const out = await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });

    expect(out.status).toBe('analyst_verified');
    expect(repo.patchInsight).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        confidence_json: expect.objectContaining({
          score: 3,
          band: 'high',
          rubric: expect.objectContaining(validRubric),
        }),
      }),
    );
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(7, 'analyst_verified');
  });

  it('submitReview from approved_internal is 409 invalid_transition', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        status: 'approved_internal',
        confidence_rationale: 'Method OK',
        confidence_json: validRubric,
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'invalid_transition' });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('attachEvidence [] on approved_internal is 409 invalid_transition', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));

    try {
      await service.attachEvidence(7, { restricted: true, allowedClientIds: ['acme'] }, []);
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'invalid_transition' });
    }
    expect(repo.replaceInsightEvidence).not.toHaveBeenCalled();
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
  });

  it('approveInsight by creator is 403 cannot_self_approve', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        created_by: 'analyst@ptt',
        status: 'analyst_verified',
        confidence_rationale: 'Method OK',
        confidence_json: validRubric,
      }),
    );
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);

    try {
      await service.approveInsight(
        7,
        { restricted: true, allowedClientIds: ['acme'] },
        { target_status: 'approved_internal', comments: 'ok' },
        'analyst@ptt',
      );
      throw new Error('expected cannot_self_approve');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({ error: 'cannot_self_approve' });
    }
    expect(repo.updateInsightStatus).not.toHaveBeenCalled();
    expect(repo.insertReview).not.toHaveBeenCalled();
  });

  it('approveInsight happy path writes approved_internal and a review', async () => {
    stubScopedProject();
    const current = insightRow({
      created_by: 'analyst@ptt',
      status: 'analyst_verified',
      confidence_rationale: 'Nguồn verified, sample 2025',
      confidence_json: validRubric,
    });
    const approved = insightRow({
      ...current,
      status: 'approved_internal',
    });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.updateInsightStatus.mockResolvedValue(approved);
    repo.insertReview.mockResolvedValue({ id: 1 });

    const out = await service.approveInsight(
      7,
      { restricted: true, allowedClientIds: ['acme'] },
      { target_status: 'approved_internal', comments: 'Method OK' },
      'lead@ptt',
    );

    expect(out.status).toBe('approved_internal');
    expect(repo.updateInsightStatus).toHaveBeenCalledWith(7, 'approved_internal');
    expect(repo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 9,
        object_type: 'insight',
        object_id: 7,
        reviewer: 'lead@ptt',
        decision: 'approve',
        comments: 'Method OK',
      }),
    );
  });

  it('runDesk throws job_in_flight when a pending run exists for the question', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeskRun.mockResolvedValue({ id: 55, status: 'pending' });

    try {
      await service.runDesk(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeskJob).not.toHaveBeenCalled();
  });

  it('runDesk marks the run failed jobs_disabled when enqueue returns null', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeskRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'desk_tavily',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    repo.failAiRun.mockResolvedValue({
      id: 77,
      project_id: 9,
      question_id: 10,
      job_type: 'desk_tavily',
      provider: 'tavily',
      status: 'failed',
      credits_used: 0,
      error_message: 'jobs_disabled',
      created_at: '2026-08-14',
      finished_at: '2026-08-14',
    });
    jobQueue.enqueueResearchDeskJob.mockResolvedValue(null);

    const out = await service.runDesk(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({
      ok: true,
      run_id: 77,
      status: 'failed',
      note: 'jobs_disabled',
    });
    expect(repo.failAiRun).toHaveBeenCalledWith(77, 'jobs_disabled');
  });

  it('runDeep throws deep_research_disabled when provider is off', async () => {
    config.researchDeepProvider = 'off';
    stubScopedProject();

    try {
      await service.runDeep(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'deep_research_disabled' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
  });

  it('runDeep enqueues deep job and does not insert insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeepRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 88,
      project_id: 9,
      question_id: 10,
      job_type: 'deep_research',
      provider: 'openai_fallback_tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchDeepJob.mockResolvedValue({ id: 'job-deep' });

    const out = await service.runDeep(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { question_id: 10 },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 88, status: 'pending' });
    expect(jobQueue.enqueueResearchDeepJob).toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('runTriangulate enqueues research_triangulate and does not insert insight', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightTriangulateRun.mockResolvedValue(null);
    repo.insertAiRun.mockResolvedValue({
      id: 99,
      project_id: 9,
      question_id: 10,
      job_type: 'research_triangulate',
      provider: 'tavily',
      status: 'pending',
      credits_used: 0,
      error_message: null,
      created_at: '2026-08-14',
      finished_at: null,
    });
    jobQueue.enqueueResearchTriangulateJob.mockResolvedValue({ id: 'job-tri' });

    const out = await service.runTriangulate(
      9,
      10,
      { restricted: true, allowedClientIds: ['acme'] },
      'am@ptt',
    );

    expect(out).toEqual({ ok: true, run_id: 99, status: 'pending' });
    expect(repo.insertAiRun).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'research_triangulate' }),
    );
    expect(jobQueue.enqueueResearchTriangulateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 9,
        questionId: 10,
        runId: 99,
        idempotencyKey: 'research_triangulate:9:10:run:99',
      }),
    );
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('runTriangulate throws job_in_flight when a pending triangulate run exists', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightTriangulateRun.mockResolvedValue({ id: 44, status: 'pending' });

    try {
      await service.runTriangulate(9, 10, { restricted: true, allowedClientIds: ['acme'] }, 'am@ptt');
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchTriangulateJob).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
  });

  it('acceptSingleSource sets single_source_accepted', async () => {
    stubScopedProject();
    repo.getSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      title: 'One source',
      single_source_accepted: false,
      triangulated: false,
    });
    repo.acceptSingleSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      title: 'One source',
      single_source_accepted: true,
      triangulated: false,
    });

    const out = await service.acceptSingleSource(5, { restricted: true, allowedClientIds: ['acme'] });

    expect(out.single_source_accepted).toBe(true);
    expect(repo.acceptSingleSource).toHaveBeenCalledWith(5);
  });

  it('submitReview caps high band to medium when attached source is single_source_accepted', async () => {
    stubScopedProject();
    const current = insightRow({
      confidence_rationale: 'Nguồn verified, sample 2025',
      status: 'draft',
      confidence_json: validRubric,
      evidence_ids: [3],
    });
    const verified = insightRow({ ...current, status: 'analyst_verified' });
    repo.getInsight.mockResolvedValue(current);
    repo.countVerifiedEvidenceForInsight.mockResolvedValue(1);
    repo.getEvidence.mockResolvedValue(evidenceRow({ id: 3, source_id: 5, qc_status: 'verified' }));
    repo.getSource.mockResolvedValue({
      id: 5,
      project_id: 9,
      triangulated: false,
      single_source_accepted: true,
    });
    repo.patchInsight.mockResolvedValue(current);
    repo.updateInsightStatus.mockResolvedValue(verified);

    await service.submitReview(7, { restricted: true, allowedClientIds: ['acme'] });

    expect(repo.patchInsight).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        confidence_json: expect.objectContaining({
          score: 3,
          band: 'medium',
        }),
      }),
    );
  });

  it('runDeep throws job_in_flight when a pending deep run exists for the question', async () => {
    stubScopedProject();
    repo.getQuestion.mockResolvedValue({
      id: 10,
      project_id: 9,
      sort_order: 1,
      question_vi: 'Quy mô?',
      question_en: null,
      analysis_frame: null,
      created_at: '2026-08-14',
    });
    repo.findInFlightDeepRun.mockResolvedValue({ id: 88, status: 'running' });

    try {
      await service.runDeep(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { question_id: 10 },
        'am@ptt',
      );
      throw new Error('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual({ error: 'job_in_flight' });
    }
    expect(repo.insertAiRun).not.toHaveBeenCalled();
    expect(jobQueue.enqueueResearchDeepJob).not.toHaveBeenCalled();
  });

  it('health exposes deep_provider for FE hide/show', () => {
    expect(service.health()).toEqual({
      ok: true,
      enabled: true,
      deep_provider: 'openai',
    });
    config.researchDeepProvider = 'off';
    expect(service.health().deep_provider).toBe('off');
  });

  it('insightCopilot with 0 evidence is 400 and does not call the LLM', async () => {
    stubScopedProject();

    try {
      await service.insightCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { evidence_ids: [] },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.insertAiRun).not.toHaveBeenCalled();
  });

  it('insightCopilot is llm_unconfigured when Anthropic is missing', async () => {
    stubScopedProject();
    llm.isConfigured.mockReturnValue(false);
    repo.getEvidence.mockResolvedValue(evidenceRow({ id: 3, qc_status: 'verified' }));
    repo.insertAiRun.mockResolvedValue({ id: 91, status: 'pending' });

    try {
      await service.insightCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { evidence_ids: [3] },
        'am@ptt',
      );
      throw new Error('expected unconfigured');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as ServiceUnavailableException).getResponse()).toEqual({
        error: 'llm_unconfigured',
      });
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createInsight).not.toHaveBeenCalled();
    expect(repo.failAiRun).toHaveBeenCalledWith(91, 'llm_unconfigured');
  });

  it('createReport snapshot has evidence_index when insight has EV', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', evidence_ids: [3] }),
    );
    repo.listQuestions.mockResolvedValue([
      { id: 21, project_id: 9, sort_order: 1, question_vi: 'Quy mô?', question_en: null, analysis_frame: null, created_at: '2026-08-14' },
    ]);
    repo.listEvidence.mockResolvedValue([
      evidenceRow({ id: 3, locator: 'https://example.com#p3', question_id: 21 }),
    ]);
    repo.listReports.mockResolvedValue([]);
    repo.insertReportVersion.mockImplementation(async (input: { contentSnapshot: Record<string, unknown> }) => ({
      report_id: 1,
      version_id: 10,
      version: 1,
      content_snapshot: input.contentSnapshot,
      content_hash: 'abc',
    }));

    const out = await service.createReport(
      9,
      { restricted: true, allowedClientIds: ['acme'] },
      { insight_ids: [7] },
      'am@ptt',
    );

    const index = out.content_snapshot.evidence_index as unknown[];
    expect(index.length).toBeGreaterThanOrEqual(1);
    expect(out.version).toBe(1);
    expect(repo.insertReportVersion).toHaveBeenCalled();
  });

  it('createReport TC + methodology stub is 400 methodology_incomplete', async () => {
    stubScopedProject();
    repo.getProject.mockResolvedValue({ ...project, dv12_tier: 'TC' });
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal', evidence_ids: [3] }));

    try {
      await service.createReport(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        {
          insight_ids: [7],
          methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'methodology_incomplete' });
    }
    expect(repo.insertReportVersion).not.toHaveBeenCalled();
  });

  it('exportReportVersion CB + stub still exports (P0 no regress)', async () => {
    stubScopedProject();
    repo.getReport.mockResolvedValue({
      id: 1,
      project_id: 9,
      template: 'std',
      status: 'draft',
      created_at: '2026-08-14',
      versions: [],
    });
    repo.getReportVersion.mockResolvedValue({
      id: 10,
      report_id: 1,
      version: 1,
      content_snapshot: {
        cover: { client: 'Acme', title: 'T', confidential: true, version: 1, as_of: '2026-08-14' },
        exec: 'exec',
        findings: [],
        recs: [],
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        evidence_index: [],
        status: 'draft',
        insight_ids: [7],
      },
      generated_by: 'am@ptt',
      content_hash: 'abc',
      created_at: '2026-08-14',
    });

    const out = await service.exportReportVersion(1, 10, {
      restricted: true,
      allowedClientIds: ['acme'],
    });
    expect(out).toBeInstanceOf(StreamableFile);
  });

  it('createReport rejects insights below approved_internal', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft', evidence_ids: [3] }));

    await expect(
      service.createReport(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_ids: [7] },
        'am@ptt',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insertReportVersion).not.toHaveBeenCalled();
  });

  it('reportCopilot with 0 insights is 400', async () => {
    stubScopedProject();

    try {
      await service.reportCopilot(
        9,
        { restricted: true, allowedClientIds: ['acme'] },
        { insight_ids: [] },
        'am@ptt',
      );
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(repo.createReportDraft).not.toHaveBeenCalled();
  });

  it('listApprovedInsightsForClient outside scope is 403 without title', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    repo.listApprovedInsightsByClient.mockResolvedValue([
      insightRow({ statement: 'Secret title must not leak' }),
    ]);

    try {
      await service.listApprovedInsightsForClient(
        { restricted: true, allowedClientIds: ['acme'] },
        'other-client',
      );
      throw new Error('expected forbidden');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const body = (err as ForbiddenException).getResponse();
      expect(body).toEqual({ error: 'forbidden' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret title');
    }
    expect(repo.listApprovedInsightsByClient).not.toHaveBeenCalled();
  });

  it('listApprovedInsightsForClient returns approved_internal+ for that client', async () => {
    clientScope.allowedClientIdsForList.mockReturnValue(['acme']);
    const approved = insightRow({
      status: 'approved_internal',
      statement: 'Premium SKU tăng share ở MT HCM',
    });
    repo.listApprovedInsightsByClient.mockResolvedValue([approved]);

    const out = await service.listApprovedInsightsForClient(
      { restricted: true, allowedClientIds: ['acme'] },
      'acme',
    );

    expect(out.insights).toEqual([approved]);
    expect(repo.listApprovedInsightsByClient).toHaveBeenCalledWith('acme');
  });

  it('insertPlanInsights persists ids only and rejects statement in persist payload', async () => {
    stubScopedProject();
    plans.getPlanById.mockReturnValue({
      id: 3,
      name: 'Secret plan title',
      khtn_market_research_json: '{}',
    });
    repo.getInsight.mockResolvedValue(
      insightRow({ status: 'approved_internal', statement: 'Premium SKU tăng share ở MT HCM' }),
    );
    plans.patchPlan.mockImplementation((_id: number, body: { khtn_market_research_json?: string }) => {
      const stored = JSON.parse(String(body.khtn_market_research_json ?? '{}'));
      expect(stored).not.toHaveProperty('statement');
      expect(JSON.stringify(stored)).not.toContain('Premium SKU');
      expect(JSON.stringify(stored)).not.toContain('statement');
      return { id: 3, khtn_market_research_json: JSON.stringify(stored) };
    });

    const { assertNoInsightTextLeak } = await import('./plan-insight-snapshot.util');
    expect(() =>
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        statement: 'Premium SKU tăng share ở MT HCM',
      }),
    ).toThrow('plan_must_not_copy_insight_text');

    const out = await service.insertPlanInsights(
      3,
      { restricted: true, allowedClientIds: ['acme'] },
      { client_id: 'acme', insight_ids: [7] },
      'am@ptt',
    );

    expect(plans.patchPlan).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(
      String((plans.patchPlan.mock.calls[0][1] as { khtn_market_research_json: string }).khtn_market_research_json),
    );
    expect(Object.keys(persisted).sort()).toEqual(
      ['client_id', 'inserted_at', 'inserted_by', 'insight_ids'].sort(),
    );
    expect(persisted.insight_ids).toEqual([7]);
    expect(persisted.client_id).toBe('acme');
    expect(JSON.stringify(persisted)).not.toContain('statement');
    expect(out.snapshot.insight_ids).toEqual([7]);
  });

  it('insertPlanInsights client mismatch is 400 client_mismatch', async () => {
    stubScopedProject();
    plans.getPlanById.mockReturnValue({ id: 3, name: 'Secret plan title', khtn_market_research_json: '{}' });
    repo.getInsight.mockResolvedValue(insightRow({ status: 'approved_internal' }));
    repo.getProjectClientId.mockResolvedValue('acme');

    try {
      await service.insertPlanInsights(
        3,
        { restricted: false, allowedClientIds: [] },
        { client_id: 'other-client', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected client_mismatch');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'client_mismatch' });
    }
    expect(plans.patchPlan).not.toHaveBeenCalled();
  });

  it('insertPlanInsights unapproved insight is 400 insight_not_approved', async () => {
    stubScopedProject();
    plans.getPlanById.mockReturnValue({ id: 3, name: 'Secret plan title', khtn_market_research_json: '{}' });
    repo.getInsight.mockResolvedValue(insightRow({ status: 'draft' }));

    try {
      await service.insertPlanInsights(
        3,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected insight_not_approved');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'insight_not_approved' });
    }
    expect(plans.patchPlan).not.toHaveBeenCalled();
  });

  it('insertPlanInsights missing plan is 404 not_found without title', async () => {
    plans.getPlanById.mockReturnValue(null);

    try {
      await service.insertPlanInsights(
        99,
        { restricted: true, allowedClientIds: ['acme'] },
        { client_id: 'acme', insight_ids: [7] },
        'am@ptt',
      );
      throw new Error('expected not_found');
    } catch (err) {
      expect((err as { getStatus?: () => number }).getStatus?.()).toBe(404);
      const body = (err as { getResponse: () => unknown }).getResponse();
      expect(body).toEqual({ error: 'not_found' });
      expect(JSON.stringify(body)).not.toContain('title');
      expect(JSON.stringify(body)).not.toContain('Secret');
    }
    expect(plans.patchPlan).not.toHaveBeenCalled();
    expect(repo.getInsight).not.toHaveBeenCalled();
  });
});

function competitorRow() {
  return {
    id: 4,
    project_id: 9,
    name: 'Vinamilk',
    aliases: [],
    created_by: 'am@ptt',
    created_at: '2026-08-14',
    updated_at: '2026-08-14',
    snapshots: [],
  };
}

function similarwebSource(overrides: { reliability_tier: string }) {
  return {
    id: 11,
    project_id: 9,
    publisher: 'Similarweb',
    url: 'https://www.similarweb.com/website/example',
    reliability_tier: overrides.reliability_tier,
  };
}

function evidenceRow(overrides: Partial<ResearchEvidenceRow> = {}): ResearchEvidenceRow {
  return {
    id: 3,
    project_id: 9,
    source_id: 1,
    study_id: null,
    question_id: null,
    locator: 'https://example.com#p3',
    excerpt: 'locked excerpt',
    value_num: null,
    unit: null,
    value_base: null,
    period_note: null,
    geography: null,
    captured_at: '2026-08-14',
    pii_class: 'none',
    qc_status: 'pending',
    checksum: null,
    created_by: 'am@ptt',
    superseded_by: null,
    created_at: '2026-08-14',
    ...overrides,
  };
}

const validRubric = { S: 3, F: 3, T: 3, A: 3, R: 3 };

function insightRow(overrides: Partial<ResearchInsightRow> = {}): ResearchInsightRow {
  return {
    id: 7,
    project_id: 9,
    statement: 'Premium SKU tăng share ở MT HCM',
    observation: null,
    interpretation: null,
    implication: null,
    recommendation: null,
    audience: null,
    status: 'draft',
    confidence_rationale: null,
    confidence_json: null,
    ai_generated: false,
    created_by: 'analyst@ptt',
    valid_from: null,
    valid_to: null,
    created_at: '2026-08-14',
    updated_at: '2026-08-14',
    evidence_ids: [],
    ...overrides,
  };
}
