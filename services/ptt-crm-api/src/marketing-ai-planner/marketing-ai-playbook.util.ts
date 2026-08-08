import * as fs from 'fs';
import * as path from 'path';
import type { MktAiBrief } from './marketing-ai-planner.types';

export interface MktAiIndustryPlaybook {
  slug: string;
  label_vi: string;
  service_slugs: string[];
  brief_defaults: Partial<MktAiBrief>;
  strategy_prompt_hints: string[];
  campaign_kpi_templates: string[];
  channel_mix_pct?: Record<string, number>;
  quality_gate: {
    min_score_launch_qa: number;
    require_campaign_count: number;
  };
  governance_notes_vi?: string[];
  stub_swot_json?: Record<string, unknown>;
}

export const MKT_AI_PLAYBOOK_SLUGS = ['meta-lead-gen', 'bds-lead-gen', 'seo-retainer'] as const;

const PLAYBOOKS_DIR = path.join(__dirname, 'playbooks');

function isBriefFieldEmpty(key: string, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value) || value <= 0;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0 || value.every((x) => !String(x).trim());
  return false;
}

function assignBriefField(brief: MktAiBrief, key: string, value: unknown): void {
  if (value === undefined) return;
  if (key === 'geo_markets' || key === 'competitors') {
    brief[key] = Array.isArray(value)
      ? value.map((x) => String(x).trim()).filter(Boolean)
      : String(value ?? '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
    return;
  }
  if (key === 'budget_monthly_vnd') {
    const n = Number(value);
    brief.budget_monthly_vnd = Number.isFinite(n) ? n : undefined;
    return;
  }
  (brief as Record<string, unknown>)[key] = value;
}

export function readPlaybookFile(slug: string, dir = PLAYBOOKS_DIR): MktAiIndustryPlaybook {
  const filePath = path.join(dir, `${slug}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as MktAiIndustryPlaybook;
  if (!parsed.slug) parsed.slug = slug;
  if (!parsed.quality_gate) {
    parsed.quality_gate = { min_score_launch_qa: 70, require_campaign_count: 2 };
  }
  if (parsed.quality_gate.min_score_launch_qa == null) {
    parsed.quality_gate.min_score_launch_qa = 70;
  }
  if (parsed.quality_gate.require_campaign_count == null) {
    parsed.quality_gate.require_campaign_count = 2;
  }
  return parsed;
}

export function listPlaybookCatalog(dir = PLAYBOOKS_DIR): MktAiIndustryPlaybook[] {
  return MKT_AI_PLAYBOOK_SLUGS.map((slug) => readPlaybookFile(slug, dir));
}

export function matchPlaybookForServiceSlug(
  serviceSlug: string,
  catalog: MktAiIndustryPlaybook[],
): MktAiIndustryPlaybook | null {
  const normalized = serviceSlug.trim();
  if (!normalized) return null;
  return (
    catalog.find((p) => p.slug === normalized) ??
    catalog.find((p) => p.service_slugs.includes(normalized)) ??
    null
  );
}

export function resolveActivePlaybookSlug(
  brief: MktAiBrief | null | undefined,
  serviceSlug: string,
  catalog: MktAiIndustryPlaybook[],
): string | null {
  const fromBrief = String((brief as Record<string, unknown> | null | undefined)?._playbook_slug ?? '').trim();
  if (fromBrief && catalog.some((p) => p.slug === fromBrief)) return fromBrief;
  return matchPlaybookForServiceSlug(serviceSlug, catalog)?.slug ?? null;
}

export function mergeBriefWithPlaybook(
  existing: MktAiBrief | null | undefined,
  playbook: MktAiIndustryPlaybook,
  opts: { confirmOverwrite?: boolean; serviceSlug?: string } = {},
): { brief: MktAiBrief; messages: string[] } {
  const messages: string[] = [];
  const brief: MktAiBrief = { ...(existing ?? {}) };
  const defaults: Partial<MktAiBrief> = { ...playbook.brief_defaults };
  if (opts.serviceSlug && !defaults.service_slug) {
    defaults.service_slug = opts.serviceSlug;
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (value === undefined) continue;
    const current = brief[key as keyof MktAiBrief];
    const shouldApply = opts.confirmOverwrite || isBriefFieldEmpty(key, current);
    if (!shouldApply) continue;
    assignBriefField(brief, key, value);
    if (!opts.confirmOverwrite) {
      messages.push(`Đã điền ${key} từ playbook ${playbook.label_vi}.`);
    }
  }

  (brief as Record<string, unknown>)._playbook_slug = playbook.slug;
  if (opts.confirmOverwrite) {
    messages.push(`Đã ghi đè brief theo playbook ${playbook.label_vi}.`);
  } else {
    messages.push(`Đã áp dụng playbook ${playbook.label_vi}.`);
  }
  return { brief, messages };
}

export function buildStrategyPlaybookBlock(hints: string[] | undefined): string | undefined {
  const rows = (hints ?? []).map((h) => h.trim()).filter(Boolean);
  if (!rows.length) return undefined;
  return ['Industry playbook hints:', ...rows.map((h) => `- ${h}`)].join('\n');
}

export function buildCampaignPlaybookBlock(templates: string[] | undefined): string | undefined {
  const rows = (templates ?? []).map((h) => h.trim()).filter(Boolean);
  if (!rows.length) return undefined;
  return [
    'KPI templates từ industry playbook:',
    ...rows.map((h) => `- ${h}`),
  ].join('\n');
}

export function buildLaunchQaGateMessage(
  minScore: number,
  currentScore: number | null,
): string {
  const current = currentScore == null ? 'chưa có' : String(currentScore);
  return `Campaign Quality Score cần ≥${minScore} trước Launch QA (hiện tại: ${current}). Chạy job Quality hoặc hoàn thiện draft trên tab AI Planner.`;
}

export interface MktAiLaunchQaQualityGate {
  required: boolean;
  min_score: number;
  current_score: number | null;
  ok: boolean;
  message_vi: string;
}

export function evaluateLaunchQaQualityGate(args: {
  enabled: boolean;
  minScore: number;
  currentScore: number | null;
}): MktAiLaunchQaQualityGate {
  const required = args.enabled;
  const currentScore = args.currentScore;
  const ok = !required || (currentScore != null && currentScore >= args.minScore);
  return {
    required,
    min_score: args.minScore,
    current_score: currentScore,
    ok,
    message_vi: buildLaunchQaGateMessage(args.minScore, currentScore),
  };
}

export function buildGovernanceContext(args: {
  enabled: boolean;
  playbookLabel: string | null;
  governanceNotes: string[];
  launchQaGate: MktAiLaunchQaQualityGate;
}): {
  enabled: boolean;
  playbook_label: string | null;
  notes: string[];
  launch_qa_gate: MktAiLaunchQaQualityGate;
} | null {
  if (!args.enabled) return null;
  return {
    enabled: true,
    playbook_label: args.playbookLabel,
    notes: args.governanceNotes,
    launch_qa_gate: args.launchQaGate,
  };
}
