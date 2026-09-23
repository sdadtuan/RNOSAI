import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { INDUSTRY_PACK_SEEDS, SERVICE_PACK_SEEDS } from './strategy-pack.seed';
import { StrategyPacksService } from './strategy-packs.service';
import {
  emptyGrowthSections,
  growthSoftWarnings,
  mergeGrowthSections,
  nullableNumber,
  packDefaultsHaveFakeNumbers,
} from './growth-sections.util';

describe('growth sections', () => {
  it('shell is schema_version 1 and keeps null money', () => {
    const shell = emptyGrowthSections();
    expect(shell.schema_version).toBe(1);
    expect((shell.north_star as { baseline: unknown; target: unknown }).baseline).toBeNull();
    expect((shell.north_star as { target: unknown }).target).toBeNull();
    expect(nullableNumber(null)).toBeNull();
    expect(nullableNumber('')).toBeNull();
    expect(nullableNumber(0)).toBe(0);
  });

  it('rejects known without source and keeps assumed text', () => {
    const denied = mergeGrowthSections(null, {
      north_star: { label: 'Booking', quality: 'known' },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe('source_required_for_known');

    const ok = mergeGrowthSections(null, {
      north_star: { label: 'Số booking hoàn tất', quality: 'assumed' },
      ignored_extra: true,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect((ok.value.north_star as { label: string }).label).toBe('Số booking hoàn tất');
    expect((ok.value.north_star as { target: unknown }).target).toBeNull();
    expect(ok.warnings).toContain('unknown_field_stripped:ignored_extra');
  });

  it('replaces an array key wholesale', () => {
    const first = mergeGrowthSections(null, {
      offer_ladder: [
        { tier: 'core', goal: 'A', example: 'xe', customer_action: 'gọi', quality: 'assumed', source: null },
      ],
    });
    if (!first.ok) throw new Error(first.error);
    const second = mergeGrowthSections(first.value, {
      offer_ladder: [
        { tier: 'retain', goal: 'B', example: 'nhắc', customer_action: 'zalo', quality: 'tbd' },
      ],
    });
    if (!second.ok) throw new Error(second.error);
    expect(second.value.offer_ladder).toHaveLength(1);
    expect((second.value.offer_ladder as Array<{ tier: string }>)[0].tier).toBe('retain');
  });

  it('soft warnings never use winning_plan_gate_failed', () => {
    const warnings = growthSoftWarnings(emptyGrowthSections());
    expect(warnings).toEqual(
      expect.arrayContaining([
        'north_star_missing',
        'budget_90d_empty',
        'calendar_12w_empty',
        'raci_empty',
        'growth_sections_incomplete',
      ]),
    );
    expect(warnings.join(' ')).not.toContain('winning_plan_gate_failed');
  });

  it('seed packs have no fabricated numeric KPI or budget', () => {
    const keys = INDUSTRY_PACK_SEEDS.map((pack) => pack.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'spa_beauty',
        'retail_ecommerce',
        'real_estate',
        'education',
        'fnb',
        'b2b_services',
        'auto_detailing',
        'generic',
      ]),
    );
    expect(SERVICE_PACK_SEEDS.map((pack) => pack.key)).toEqual(
      expect.arrayContaining(['growth_full', 'ads_crm']),
    );
    for (const pack of [...INDUSTRY_PACK_SEEDS, ...SERVICE_PACK_SEEDS]) {
      expect(packDefaultsHaveFakeNumbers(pack.defaults_json)).toBeNull();
    }
  });
});

describe('StrategyPacksService sections', () => {
  function service(plan: Record<string, unknown> | null) {
    const saved: { sections?: Record<string, unknown> } = {};
    const repo = {
      getPlan: jest.fn(async () => plan),
      saveGrowth: jest.fn(async (_id: number, sections: Record<string, unknown>) => {
        saved.sections = sections;
      }),
      listPacks: jest.fn(),
      getPack: jest.fn(),
      setPackKeys: jest.fn(),
    };
    return { svc: new StrategyPacksService(repo as never), saved, repo };
  }

  it('sections_read returns a v1 shell when growth_sections is null', async () => {
    const { svc } = service({
      id: 15,
      status: 'draft',
      growth_sections: null,
      industry_pack_key: null,
      service_pack_key: null,
    });
    const out = await svc.sectionsRead(15);
    expect(out.growth_sections.schema_version).toBe(1);
    expect(out.warnings).toContain('budget_90d_empty');
    expect(JSON.stringify(out)).not.toContain('winning_plan_gate_failed');
  });

  it('upsert without approval is 403 and known without source is 400', async () => {
    const { svc, repo } = service({
      id: 15,
      status: 'draft',
      growth_sections: null,
      industry_pack_key: 'auto_detailing',
      service_pack_key: null,
    });
    await expect(
      svc.sectionsUpsert({
        planId: 15,
        patch: { north_star: { label: 'Booking', quality: 'assumed' } },
        dryRun: false,
        humanApproved: false,
        actor: 'bot',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.saveGrowth).not.toHaveBeenCalled();

    await expect(
      svc.sectionsUpsert({
        planId: 15,
        patch: { north_star: { label: 'Booking', quality: 'known' } },
        dryRun: false,
        humanApproved: true,
        actor: 'bot',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assumed text persists and empty budget does not archive-conflict', async () => {
    const { svc, saved } = service({
      id: 15,
      status: 'draft',
      growth_sections: null,
      industry_pack_key: null,
      service_pack_key: null,
    });
    const out = await svc.sectionsUpsert({
      planId: 15,
      patch: {
        north_star: { label: 'Số booking detailing hoàn tất', quality: 'assumed', target: null },
        industry_pack_key: 'auto_detailing',
      },
      dryRun: false,
      humanApproved: true,
      actor: 'am',
    });
    expect(saved.sections?.industry_pack_key).toBe('auto_detailing');
    expect((out.growth_sections.north_star as { target: unknown }).target).toBeNull();
    expect(out.warnings).toContain('budget_90d_empty');
    expect(out.warnings).not.toContain('winning_plan_gate_failed');
  });

  it('archived plan is 409', async () => {
    const { svc } = service({
      id: 15,
      status: 'archived',
      growth_sections: null,
      industry_pack_key: null,
      service_pack_key: null,
    });
    await expect(
      svc.sectionsUpsert({
        planId: 15,
        patch: { north_star: { label: 'X', quality: 'assumed' } },
        dryRun: false,
        humanApproved: true,
        actor: 'am',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
