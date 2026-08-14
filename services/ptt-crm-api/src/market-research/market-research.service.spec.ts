import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
      insightRow({ confidence_rationale: 'Method OK', status: 'draft' }),
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

  it('approveInsight by creator is 403 cannot_self_approve', async () => {
    stubScopedProject();
    repo.getInsight.mockResolvedValue(
      insightRow({
        created_by: 'analyst@ptt',
        status: 'analyst_verified',
        confidence_rationale: 'Method OK',
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
});

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
