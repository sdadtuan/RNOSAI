import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { readToolFlag } from '../ai-intelligence/ai-tools/tools/strategy-packs.tools';
import { buildGrowthDocx } from './growth-export-docx.util';
import { buildGrowthExportModel, GrowthExportInput, sanitizeExportText } from './growth-export.util';
import { StrategyPacksService } from './strategy-packs.service';

function fixture(patch: Partial<GrowthExportInput> = {}): GrowthExportInput {
  return {
    planId: 15,
    brandName: '360 AUTO DETAILING — Plan review từ presales',
    serviceType: 'auto detailing',
    periodLabel: '2026',
    planStatus: 'draft',
    ownerName: null,
    geo: null,
    industryPackKey: 'auto_detailing',
    servicePackKey: 'growth_full',
    packJourney: 'Thấy xe cần bảo vệ hoặc làm đẹp',
    packPriorities: 'Before-after có đồng ý, booking lịch',
    growthSections: {
      north_star: { label: 'Số booking detailing hoàn tất', target: null, baseline: null, quality: 'assumed', source: 'pack:auto_detailing' },
      executive_summary: { context: 'Studio detailing', problems: ['Khách không phân biệt rửa xe'], quality: 'known', source: 'insight:1' },
      research: { customer_insight: 'Khách chọn studio vì mặt sơn thật', quality: 'known', source: 'insight:1' },
      positioning: { statement: 'Khách chọn studio vì thấy mặt sơn thật', proofs: ['Before-after có phép'], quality: 'known', source: 'insight:1', cta: null },
      icp_segments: [{ name: 'Chủ xe muốn giữ lớp sơn', quality: 'assumed', source: 'pack:auto_detailing' }],
      offer_ladder: [{ tier: 'core', goal: 'Gói chính', example: 'Gói detailing mô tả bằng chữ', quality: 'assumed' }],
      budget_90d: { lines: [{ cost_group: 'ads', m1: null, m2: null, m3: null, quality: 'tbd' }] },
      calendar_12w: [],
      risks: [{ risk: 'Hứa độ bền khi chưa khảo sát', quality: 'assumed' }],
    },
    includeEmptyTables: true,
    tmmt: {},
    insight: { id: 1, status: 'approved', statement: 'Khách chọn studio vì thấy mặt sơn thật', observation: 'Before-after có phép', interpretation: '' },
    roleKpi: null,
    campaignNames: [],
    measurementExists: false,
    ...patch,
  };
}

describe('marketing_plan.export_growth_docx', () => {
  it('covers known insight text and leaves budget and the north-star target as TBD', async () => {
    const model = buildGrowthExportModel(fixture());
    expect(model.sections).toHaveLength(18);
    expect(model.sections[0].id).toBe(0);
    expect(model.sections[17].id).toBe(17);
    expect(model.coverage.known.join(' ')).toContain('executive_summary');
    expect(model.coverage.tbd).toEqual(expect.arrayContaining(['north_star.target', 'budget_90d.lines[0]']));
    expect(model.warnings).toContain('north_star_target_missing');
    expect(model.warnings.join(' ')).not.toContain('winning_plan_gate_failed');
    const pack = model.sections.find((section) => section.id === 15);
    expect(pack?.lines.join('\n')).toContain('auto_detailing');
    expect(pack?.lines.join('\n')).toContain('Thấy xe cần bảo vệ');
    const checklist = model.checklist;
    expect(checklist.find((item) => item.item.startsWith('Mục tiêu'))?.checked).toBe(false);
    expect(checklist.find((item) => item.item.startsWith('Message'))?.checked).toBe(true);
    expect(checklist.every((item) => item.checked)).toBe(false);
    const prose = model.sections.flatMap((section) => section.lines).join('\n');
    expect(prose).toContain('360 AUTO DETAILING');
    expect(prose).toContain('[Assumed] ');
    expect(prose).toContain('[[CHỈ_SỐ_QUAN_TRỌNG_NHẤT]]');
    expect(prose).not.toMatch(/\b\d{5,}\b/);
    expect(model.missing_for_ops).toEqual(
      expect.arrayContaining([
        'north_star.baseline',
        'north_star.target',
        'budget_90d.lines[*].m1',
        'channel_mix[*].budget_pct',
        'campaign_table',
        'calendar_12w[*].focus',
        'retain_journeys',
      ]),
    );
    expect(model.deploy_ready).toBe(false);
    expect(sanitizeExportText('P11 verification gate=false TMMT 3/8')).toBe('');
    expect(
      sanitizeExportText(
        'Geography resolved in TMMT BANT 30/30 · Go Contract value 45000000₫ (media/fee split unknown) Owner/GM · Trưởng MKT',
      ),
    ).toBe('Trưởng MKT');
    expect(
      sanitizeExportText(
        'Presales insight draft for 360 AUTO DETAILING. Core message: Vấn đề không nằm ở năng lực. Sources: Intake/BANT 30/30, contract #1. Status: pending human.',
      ),
    ).toBe('Vấn đề không nằm ở năng lực.');

    const built = await buildGrowthDocx({
      ...model.template_fill,
      versionLabel: 'Xem trước',
      issuedOn: '2026-09-24',
    });
    expect(built.table_count).toBeGreaterThanOrEqual(20);
    expect(built.structure_ok).toBe(true);
    expect(built.template.key).toBe('strategy_growth_template_v1');
    expect(built.template.sha256).toMatch(/^[a-f0-9]{64}$/);
    const dir = mkdtempSync(join(tmpdir(), 'growth-docx-'));
    const file = join(dir, 'plan.docx');
    writeFileSync(file, built.buffer);
    const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    expect(xml).toContain('360 AUTO DETAILING');
    expect(xml).toContain('[Assumed] ');
    expect(xml).toContain('KẾ HOẠCH VÀ CHIẾN LƯỢC MARKETING TĂNG TRƯỞNG');
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBeGreaterThanOrEqual(20);
    const visible = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1] ?? '').join('\n');
    expect(visible).toContain('360 AUTO DETAILING');
    expect(visible).toContain('[Assumed] ');
    expect(visible).toContain('Dự thảo');
    expect(visible).toContain('auto_detailing');
    expect(visible).not.toContain('Plan review');
    expect(visible).not.toContain('Ví dụ doanh thu thuần');
    expect(visible).not.toContain('Spa/Beauty');
    expect(visible).not.toContain('P11 verification');
    expect(visible).not.toMatch(/gate\s*=/);
    expect(visible).not.toMatch(/\b\d{5,}\b/);
  });

  it('still exports a null growth_sections plan and a missing brand as tokens', () => {
    const model = buildGrowthExportModel(fixture({ growthSections: null, brandName: null, insight: null, packJourney: null, packPriorities: null, industryPackKey: null }));
    expect(model.warnings).toContain('growth_sections_empty');
    expect(model.warnings).toContain('insight_missing');
    expect(model.sections[0].lines.join('\n')).toContain('[[TÊN_THƯƠNG_HIỆU]]');
    expect(model.coverage.tbd.length).toBeGreaterThan(0);
  });
});

describe('StrategyPacksService.exportGrowthDocx', () => {
  function sources() {
    return {
      plan: {
        status: 'active',
        name: '360 AUTO DETAILING — Plan review từ presales',
        strategy_framework_json: {},
        target_market_prof_json: {},
        industry_pack_key: 'auto_detailing',
        service_pack_key: 'growth_full',
        growth_sections: {
          north_star: { label: 'Số booking', target: null, baseline: null, quality: 'assumed' },
        },
        period_label: '90 ngày',
        fiscal_year: null,
      },
      lifecycle: null,
      insight: null,
      roleKpis: [],
      campaignNames: [],
    };
  }

  it('rejects persist without human approval', async () => {
    const repo = { loadGenerateSources: jest.fn(), insertGrowthExport: jest.fn() };
    const svc = new StrategyPacksService(repo as never);
    await expect(
      svc.exportGrowthDocx({
        planId: 15,
        dryRun: false,
        persist: true,
        includeEmptyTables: true,
        humanApproved: false,
        actor: 'bot',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.insertGrowthExport).not.toHaveBeenCalled();
  });

  it('dry_run returns the template report and does not write an export row', async () => {
    const repo = {
      loadGenerateSources: jest.fn().mockResolvedValue(sources()),
      getPack: jest.fn().mockResolvedValue({
        name_vi: 'Auto detailing',
        journey_focus: 'Thấy xe cần bảo vệ',
        marketing_priorities: 'Booking',
      }),
      insertGrowthExport: jest.fn(),
      listGrowthExports: jest.fn(),
      renameGrowthExport: jest.fn(),
    };
    const svc = new StrategyPacksService(repo as never);
    const out = await svc.exportGrowthDocx({
      planId: 15,
      dryRun: true,
      persist: false,
      includeEmptyTables: true,
      humanApproved: false,
      actor: 'bot',
    });
    expect(out.ok).toBe(true);
    expect(out.dry_run).toBe(true);
    expect(out.plan_id).toBe(15);
    expect(out.export_id).toBeNull();
    expect(out.filename).toBeNull();
    expect(out.download_url).toBeNull();
    expect(out.template.key).toBe('strategy_growth_template_v1');
    expect(out.template.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(out.structure_ok).toBe(true);
    expect(out.table_count).toBeGreaterThanOrEqual(20);
    expect(out.missing_for_ops).toEqual(expect.arrayContaining(['north_star.baseline', 'north_star.target']));
    expect(out.deploy_ready).toBe(false);
    expect(repo.insertGrowthExport).not.toHaveBeenCalled();
    expect(repo.listGrowthExports).not.toHaveBeenCalled();
    expect(repo.renameGrowthExport).not.toHaveBeenCalled();
  });

  it('retries the plan read once when postgres is out of clients', async () => {
    const busy = Object.assign(new Error('sorry, too many clients already'), { code: '53300' });
    const repo = {
      loadGenerateSources: jest.fn().mockRejectedValueOnce(busy).mockResolvedValueOnce(sources()),
      getPack: jest.fn().mockResolvedValue(null),
      insertGrowthExport: jest.fn(),
      listGrowthExports: jest.fn(),
      renameGrowthExport: jest.fn(),
    };
    const svc = new StrategyPacksService(repo as never);
    const out = await svc.exportGrowthDocx({
      planId: 15,
      dryRun: true,
      persist: false,
      includeEmptyTables: true,
      humanApproved: false,
      actor: 'bot',
    });
    expect(out.ok).toBe(true);
    expect(out.dry_run).toBe(true);
    expect(repo.loadGenerateSources).toHaveBeenCalledTimes(2);
    expect(repo.insertGrowthExport).not.toHaveBeenCalled();
  });

  it('casts string dry_run flags from Admin Try', () => {
    expect(readToolFlag('true', false)).toBe(true);
    expect(readToolFlag('false', true)).toBe(false);
    expect(readToolFlag(undefined, true)).toBe(true);
    expect(readToolFlag(undefined, false)).toBe(false);
  });
});
