import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { INDUSTRY_PACK_SEEDS, SERVICE_PACK_SEEDS } from './strategy-pack.seed';
import { buildGenerateDraft, GenerateInput } from './strategy-generate.util';
import { StrategyPacksService } from './strategy-packs.service';

const MONEY = ['baseline', 'target', 'm1', 'm2', 'm3', 'budget_pct', 'amount', 'budget_vnd', 'cpl'];

function moneyHits(node: unknown, path = ''): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => moneyHits(item, `${path}[${index}]`));
  }
  if (node == null || typeof node !== 'object') return [];
  const hits: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (MONEY.includes(key) && typeof value === 'number') hits.push(`${next}=${value}`);
    else hits.push(...moneyHits(value, next));
  }
  return hits;
}

function packs(kind: 'industry' | 'service') {
  const rows = kind === 'industry' ? INDUSTRY_PACK_SEEDS : SERVICE_PACK_SEEDS;
  return rows.map((row) => ({
    key: row.key,
    is_active: true,
    defaults_json: row.defaults_json,
  }));
}

function input(patch: Partial<GenerateInput> = {}): GenerateInput {
  return {
    planId: 15,
    lifecycleId: 5,
    overwriteMode: 'fill_empty_only',
    requestedIndustryKey: 'auto_detailing',
    requestedServiceKey: null,
    planIndustryKey: null,
    planServiceKey: null,
    lifecycleIndustryKey: null,
    lifecycleServiceKey: null,
    inferText: '360 AUTO DETAILING',
    current: null,
    industryPacks: packs('industry'),
    servicePacks: packs('service'),
    tmmt: {
      market_context: { text: 'Studio detailing tại chỗ', status: 'assumed_confirmed' },
      segmentation_icp: { text: 'Chủ xe muốn giữ lớp sơn', status: 'assumed_confirmed' },
      personas_roles: { text: '', status: '' },
      pains_desired_outcomes: { text: 'Sợ rửa xe làm mờ sơn', status: 'validated' },
    },
    planObjective: 'Tăng booking detailing',
    insight: {
      id: 1,
      status: 'approved',
      statement: 'Khách chọn studio vì thấy mặt sơn thật',
      observation: 'Before-after có phép',
      interpretation: 'Bằng chứng giảm nghi ngờ',
      implication: 'Phải gọi lại lead trước khi lịch đầy',
    },
    roleKpis: [],
    campaignNames: [],
    ...patch,
  };
}

describe('strategy.generate_draft', () => {
  it('drafts auto_detailing with known TMMT, assumed pack offers, and null money', () => {
    const draft = buildGenerateDraft(input());
    expect(draft.ok).toBe(true);
    expect(draft.phase).toBe('P11');
    expect(draft.industry_pack_key).toBe('auto_detailing');
    expect(draft.service_pack_key).toBe('growth_full');
    const sections = draft.growth_sections;
    const star = sections.north_star as { target: unknown; baseline: unknown; quality: string };
    expect(star.target).toBeNull();
    expect(star.baseline).toBeNull();
    expect(star.quality).not.toBe('known');
    const icp = sections.icp_segments as Array<{ quality: string; source: string }>;
    expect(icp[0].quality).toBe('known');
    expect(icp[0].source).toBe('tmmt.segmentation_icp');
    const offers = sections.offer_ladder as Array<{ tier: string; quality: string }>;
    expect(offers.length).toBeGreaterThanOrEqual(1);
    expect(offers.every((row) => row.quality === 'assumed')).toBe(true);
    const lines = (sections.budget_90d as { lines: Array<{ m1: unknown; m2: unknown; m3: unknown }> }).lines;
    expect(lines.every((row) => row.m1 == null && row.m2 == null && row.m3 == null)).toBe(true);
    const channels = sections.channel_mix as Array<{ budget_pct: unknown }>;
    expect(channels.every((row) => row.budget_pct == null)).toBe(true);
    expect(sections.campaign_table).toEqual([]);
    expect(draft.coverage.known.join(' ')).toContain('icp_segments');
    expect(draft.coverage.assumed.join(' ')).toContain('offer_ladder');
    expect(draft.coverage.tbd.join(' ')).toContain('north_star.target');
    expect(draft.warnings).toContain('north_star_target_missing');
    expect(draft.warnings.join(' ')).not.toContain('winning_plan_gate_failed');
    expect(moneyHits(sections)).toEqual([]);
  });

  it('keeps known cells and does not duplicate ladder tiers on a second fill', () => {
    const first = buildGenerateDraft(input());
    const current = structuredClone(first.growth_sections);
    const star = current.north_star as Record<string, unknown>;
    star.label = 'Giữ nguyên';
    star.quality = 'known';
    star.source = 'human:1';
    const offers = current.offer_ladder as Array<Record<string, unknown>>;
    offers[0] = { ...offers[0], goal: 'HUMAN', quality: 'known', source: 'human:offer' };
    const budget = current.budget_90d as { lines: Array<Record<string, unknown>> };
    budget.lines[0] = { ...budget.lines[0], m1: 1200000, quality: 'known', source: 'human:budget' };

    const second = buildGenerateDraft(input({ current }));
    expect((second.growth_sections.north_star as { label: string }).label).toBe('Giữ nguyên');
    const again = second.growth_sections.offer_ladder as Array<{ tier: string; goal: string }>;
    expect(again).toHaveLength(offers.length);
    expect(new Set(again.map((row) => row.tier)).size).toBe(again.length);
    expect(again[0].goal).toBe('HUMAN');
    expect((second.growth_sections.budget_90d as { lines: Array<{ m1: unknown }> }).lines[0].m1).toBe(1200000);
    expect((second.growth_sections.raci as unknown[]).length).toBe(
      (first.growth_sections.raci as unknown[]).length,
    );
    expect((second.growth_sections.calendar_12w as unknown[]).length).toBe(12);
  });

  it('treats an unknown pack key as a resolve miss and still returns generic', () => {
    const draft = buildGenerateDraft(
      input({
        requestedIndustryKey: 'not_a_pack',
        planIndustryKey: null,
        lifecycleIndustryKey: null,
        inferText: 'zzzz',
        insight: null,
      }),
    );
    expect(draft.industry_pack_key).toBe('generic');
    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'pack_generic_fallback',
          pack_kind: 'industry',
          requested_key: 'not_a_pack',
          reason: 'not_found',
          resolved_key: 'generic',
        }),
        'insight_missing',
      ]),
    );
    expect(draft.service_pack_key).toBe('growth_full');
    expect(moneyHits(draft.growth_sections)).toEqual([]);
  });

  it('explicit bogus industry key does not fall through to the plan pack', () => {
    const draft = buildGenerateDraft(
      input({
        requestedIndustryKey: '__bogus_pack__',
        planIndustryKey: 'auto_detailing',
        lifecycleIndustryKey: 'education',
        inferText: '360 AUTO DETAILING',
      }),
    );
    expect(draft.industry_pack_key).toBe('generic');
    expect(draft.industry_pack_key).not.toBe('auto_detailing');
    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'pack_generic_fallback',
          requested_key: '__bogus_pack__',
          reason: 'not_found',
          resolved_key: 'generic',
          pack_kind: 'industry',
        }),
      ]),
    );
    const star = draft.growth_sections.north_star as { target: unknown; baseline: unknown };
    expect(star.target).toBeNull();
    expect(star.baseline).toBeNull();
    expect(moneyHits(draft.growth_sections)).toEqual([]);
  });

  it('omitted industry key still uses the active plan pack', () => {
    const draft = buildGenerateDraft(
      input({
        requestedIndustryKey: null,
        planIndustryKey: 'auto_detailing',
        inferText: 'zzzz',
      }),
    );
    expect(draft.industry_pack_key).toBe('auto_detailing');
    expect(draft.warnings.some((item) => typeof item === 'object' && item.code === 'pack_generic_fallback')).toBe(false);
  });

  it('explicit inactive industry key falls to generic with reason inactive', () => {
    const packs = input().industryPacks.map((pack) =>
      pack.key === 'spa_beauty' ? { ...pack, is_active: false } : pack,
    );
    const draft = buildGenerateDraft(
      input({
        requestedIndustryKey: 'spa_beauty',
        planIndustryKey: 'auto_detailing',
        industryPacks: packs,
      }),
    );
    expect(draft.industry_pack_key).toBe('generic');
    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requested_key: 'spa_beauty', reason: 'inactive', resolved_key: 'generic' }),
      ]),
    );
  });

  it('explicit bogus service key resolves to growth_full and warns', () => {
    const draft = buildGenerateDraft(
      input({
        requestedServiceKey: '__bogus_service__',
        planServiceKey: 'ads_crm',
      }),
    );
    expect(draft.service_pack_key).toBe('growth_full');
    expect(draft.service_pack_key).not.toBe('ads_crm');
    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'pack_generic_fallback',
          pack_kind: 'service',
          requested_key: '__bogus_service__',
          reason: 'not_found',
          resolved_key: 'growth_full',
        }),
      ]),
    );
  });

  it('warns when insight exists but is not approved and still drafts assumed text', () => {
    const draft = buildGenerateDraft(
      input({
        insight: {
          id: 1,
          status: 'draft',
          statement: 'Bản nháp định vị',
          observation: '',
          interpretation: '',
          implication: '',
        },
      }),
    );
    expect(draft.warnings).toContain('insight_not_approved');
    expect((draft.growth_sections.positioning as { quality: string; statement: string }).quality).toBe('assumed');
    expect((draft.growth_sections.positioning as { statement: string }).statement).toBe('Bản nháp định vị');
  });

  it('copies a Role KPI number as known and leaves every other money field null', () => {
    const draft = buildGenerateDraft(
      input({
        roleKpis: [
          {
            id: 9,
            kpi_key: 'completed_detail_bookings',
            kpi_label: 'Booking hoàn tất',
            target_value: 40,
            baseline: 12,
            unit: 'count',
          },
        ],
      }),
    );
    const star = draft.growth_sections.north_star as {
      target: number;
      baseline: number;
      quality: string;
      source: string;
    };
    expect(star).toMatchObject({ target: 40, baseline: 12, quality: 'known', source: 'role_kpi:9' });
    expect(draft.warnings).not.toContain('north_star_target_missing');
    const hits = moneyHits(draft.growth_sections);
    expect(hits.sort()).toEqual(['north_star.baseline=12', 'north_star.target=40']);
  });
});

describe('StrategyPacksService.generateDraft', () => {
  function harness(status = 'draft') {
    const repo = {
      loadGenerateSources: jest.fn(async () => ({
        plan: {
          id: 15,
          status,
          name: '360 AUTO DETAILING',
          growth_sections: null,
          industry_pack_key: 'auto_detailing',
          service_pack_key: null,
          objectives: '',
          north_star: null,
          strategy_framework_json: {},
          target_market_prof_json: {},
        },
        lifecycleId: 5,
        lifecycle: { service_slug: 'auto-detailing', industry_pack_key: null, service_pack_key: null },
        insight: null,
        roleKpis: [],
        campaignNames: [],
      })),
      listPacks: jest.fn(async (kind: string) =>
        (kind === 'industry' ? INDUSTRY_PACK_SEEDS : SERVICE_PACK_SEEDS).map((row) => ({
          ...row,
          is_active: true,
          version: 1,
        })),
      ),
      saveGrowth: jest.fn(async () => undefined),
      getPlan: jest.fn(),
      getPack: jest.fn(),
      setPackKeys: jest.fn(),
    };
    return { svc: new StrategyPacksService(repo as never), repo };
  }

  it('rejects an unknown overwrite mode', async () => {
    const { svc } = harness();
    await expect(
      svc.generateDraft({
        planId: 15,
        overwriteMode: 'replace_known',
        dryRun: true,
        persist: false,
        humanApproved: false,
        actor: 'bot',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires human approval only when persist is a real write', async () => {
    const { svc, repo } = harness();
    await expect(
      svc.generateDraft({
        planId: 15,
        overwriteMode: 'fill_empty_only',
        dryRun: false,
        persist: true,
        humanApproved: false,
        actor: 'bot',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.saveGrowth).not.toHaveBeenCalled();

    const dry = await svc.generateDraft({
      planId: 15,
      industryPackKey: 'auto_detailing',
      overwriteMode: 'fill_empty_only',
      dryRun: true,
      persist: true,
      humanApproved: false,
      actor: 'bot',
    });
    expect(dry.dry_run).toBe(true);
    expect(repo.saveGrowth).not.toHaveBeenCalled();
    expect((dry.growth_sections.north_star as { target: unknown }).target).toBeNull();
  });
});
