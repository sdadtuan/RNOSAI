import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCampaignPlaybookBlock,
  buildLaunchQaGateMessage,
  buildStrategyPlaybookBlock,
  evaluateLaunchQaQualityGate,
  listPlaybookCatalog,
  matchPlaybookForServiceSlug,
  mergeBriefWithPlaybook,
  readPlaybookFile,
  resolveActivePlaybookSlug,
} from './marketing-ai-playbook.util';

describe('marketing-ai-playbook.util', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-ai-playbook-'));
  const metaPath = path.join(fixtureDir, 'meta-lead-gen.json');
  fs.writeFileSync(
    metaPath,
    JSON.stringify({
      slug: 'meta-lead-gen',
      label_vi: 'Meta Lead-gen',
      service_slugs: ['meta-lead-gen'],
      brief_defaults: {
        objective: 'lead',
        geo_markets: ['Hà Nội'],
        challenges: 'CPL cao',
      },
      strategy_prompt_hints: ['Meta + landing'],
      campaign_kpi_templates: ['CPL ≤180k'],
      quality_gate: { min_score_launch_qa: 70, require_campaign_count: 2 },
    }),
  );

  it('readPlaybookFile loads JSON with defaults', () => {
    const pb = readPlaybookFile('meta-lead-gen', fixtureDir);
    expect(pb.slug).toBe('meta-lead-gen');
    expect(pb.quality_gate.min_score_launch_qa).toBe(70);
  });

  it('matchPlaybookForServiceSlug matches slug or service_slugs', () => {
    const pb = readPlaybookFile('meta-lead-gen', fixtureDir);
    const catalog = [pb];
    expect(matchPlaybookForServiceSlug('meta-lead-gen', catalog)?.slug).toBe('meta-lead-gen');
    expect(matchPlaybookForServiceSlug('unknown', catalog)).toBeNull();
  });

  it('mergeBriefWithPlaybook fills empty fields only by default', () => {
    const pb = readPlaybookFile('meta-lead-gen', fixtureDir);
    const out = mergeBriefWithPlaybook(
      { brand_name: 'ACME', challenges: 'Custom pain' },
      pb,
      { serviceSlug: 'meta-lead-gen' },
    );
    expect(out.brief.brand_name).toBe('ACME');
    expect(out.brief.challenges).toBe('Custom pain');
    expect(out.brief.objective).toBe('lead');
    expect((out.brief as Record<string, unknown>)._playbook_slug).toBe('meta-lead-gen');
  });

  it('mergeBriefWithPlaybook overwrites when confirmOverwrite', () => {
    const pb = readPlaybookFile('meta-lead-gen', fixtureDir);
    const out = mergeBriefWithPlaybook(
      { brand_name: 'ACME', challenges: 'Custom pain' },
      pb,
      { confirmOverwrite: true, serviceSlug: 'meta-lead-gen' },
    );
    expect(out.brief.challenges).toBe('CPL cao');
  });

  it('resolveActivePlaybookSlug prefers brief metadata', () => {
    const catalog = [readPlaybookFile('meta-lead-gen', fixtureDir)];
    expect(
      resolveActivePlaybookSlug({ _playbook_slug: 'meta-lead-gen' } as never, 'other', catalog),
    ).toBe('meta-lead-gen');
    expect(resolveActivePlaybookSlug(null, 'meta-lead-gen', catalog)).toBe('meta-lead-gen');
  });

  it('buildStrategyPlaybookBlock formats hints', () => {
    expect(buildStrategyPlaybookBlock(['A', 'B'])).toContain('- A');
  });

  it('buildCampaignPlaybookBlock formats KPI templates', () => {
    expect(buildCampaignPlaybookBlock(['CPL ≤180k'])).toContain('CPL ≤180k');
  });

  it('evaluateLaunchQaQualityGate blocks when score low', () => {
    const gate = evaluateLaunchQaQualityGate({
      enabled: true,
      minScore: 70,
      currentScore: 55,
    });
    expect(gate.ok).toBe(false);
    expect(gate.message_vi).toBe(buildLaunchQaGateMessage(70, 55));
  });

  it('evaluateLaunchQaQualityGate passes when disabled', () => {
    const gate = evaluateLaunchQaQualityGate({
      enabled: false,
      minScore: 70,
      currentScore: 10,
    });
    expect(gate.ok).toBe(true);
    expect(gate.required).toBe(false);
  });
});
