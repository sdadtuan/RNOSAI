import { UnprocessableEntityException } from '@nestjs/common';
import { OpsInsightDraftService } from './ops-insight-draft.service';

describe('OpsInsightDraftService', () => {
  const repo = {
    findOrCreatePresalesResearchProject: jest.fn(),
    createPendingInsight: jest.fn(),
  };
  const pack = {
    client: { id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd', name: '360 AUTO' },
    known: [],
    assumed: [],
    unknown: [],
    links: ['/crm/service-delivery/5'],
    blockers_for_winning_plan: [{ code: 'tmmt_gate', detail: '0/12' }],
    presales: {
      lead: { name: '360' },
      bant: { session_id: 12, score: '30/30', decision: 'Go' },
      tmmt: {
        lifecycle_id: 5,
        progress: '0/12',
        gate_passed: false,
        missing_fields: ['pain'],
        audience_bullets: [],
        channels: ['Facebook'],
        core_message: '',
        geography_resolved: false,
      },
      contract: { id: 1, title: 'HD 360', value_vnd: 45_000_000, map_status: 'contract_unmapped' },
      hub_agency: { client_id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd', campaign_map_rows: 0 },
    },
  };
  const presales = { buildPack: jest.fn(async () => pack) };

  let svc: OpsInsightDraftService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findOrCreatePresalesResearchProject.mockResolvedValue(99);
    repo.createPendingInsight.mockResolvedValue({ id: 123, status: 'draft' });
    svc = new OpsInsightDraftService(repo as never, presales as never);
  });

  it('rejects approve attempts', async () => {
    await expect(svc.draftFromPresales({ approve: true, lifecycle_id: 5 }, 'bot')).rejects.toMatchObject(
      { response: { error: 'cannot_approve_via_tool' } },
    );
  });

  it('creates pending_review insight for lifecycle 5 fixture', async () => {
    const out = await svc.draftFromPresales({ lifecycle_id: 5, plan_id: 8 }, 'bot');
    expect(out.status).toBe('pending_review');
    expect(out.insight_id).toBe(123);
    expect(out.cannot_approve_via_tool).toBe(true);
    expect(repo.createPendingInsight).toHaveBeenCalled();
  });

  it('422 when client missing and pack thin', async () => {
    presales.buildPack.mockResolvedValueOnce({
      ...pack,
      client: { id: '', name: '' },
      presales: {
        ...pack.presales,
        hub_agency: { client_id: '', campaign_map_rows: 0 },
        bant: { session_id: 0, score: '0/30', decision: '—' },
        contract: { id: 0, title: '', value_vnd: 0, map_status: 'missing_client' },
        tmmt: { ...pack.presales.tmmt, core_message: '' },
      },
    });
    await expect(svc.draftFromPresales({ lifecycle_id: 5 }, 'bot')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
