/** Role Template Pack v1 for plan.breakdown_to_roles (P5). */

export type PlanBreakdownRoleKey =
  | 'am'
  | 'graphic'
  | 'content'
  | 'video'
  | 'ads'
  | 'pm';

export type PlanBreakdownKpiTemplate = {
  name: string;
  unit: string;
  /** Optional aliases used when parsing plan notes / success_metrics (never invent targets). */
  parseKeys?: string[];
};

export type PlanBreakdownRoleTemplate = {
  role_key: PlanBreakdownRoleKey;
  role_label: string;
  kpis: PlanBreakdownKpiTemplate[];
  deliverables: string[];
  task_title_suffix: string;
  acceptance_criteria: string;
};

/** Default roles when input.roles omitted — pm is opt-in only. */
export const DEFAULT_BREAKDOWN_ROLES: PlanBreakdownRoleKey[] = [
  'am',
  'graphic',
  'content',
  'video',
  'ads',
];

export const PLAN_BREAKDOWN_ROLE_TEMPLATES: Record<
  PlanBreakdownRoleKey,
  PlanBreakdownRoleTemplate
> = {
  am: {
    role_key: 'am',
    role_label: 'Account / AM',
    kpis: [
      {
        name: 'lead_to_booking_pct',
        unit: 'percent',
        parseKeys: ['lead→booking', 'lead_to_booking', 'booking %', 'booking_pct'],
      },
      {
        name: 'follow_up_sla_hours',
        unit: 'hours',
        parseKeys: ['follow-up', 'follow_up', 'sla', '<48h', '48h'],
      },
    ],
    deliverables: ['Script tư vấn', 'nurture', 'retain'],
    task_title_suffix: 'AM consult & nurture scripts',
    acceptance_criteria:
      'Script tư vấn + nurture cadence sẵn sàng; follow-up SLA documented; retain checklist signed.',
  },
  graphic: {
    role_key: 'graphic',
    role_label: 'Graphic design',
    kpis: [
      {
        name: 'assets_on_brief',
        unit: 'count',
        parseKeys: ['assets_on_brief', 'assets', 'KV', 'banners'],
      },
      {
        name: 'turnaround_sla_hours',
        unit: 'hours',
        parseKeys: ['turnaround', 'graphic_sla', 'design sla'],
      },
    ],
    deliverables: ['KV', 'before_after_stills', 'banners'],
    task_title_suffix: 'Brief & ship graphic assets',
    acceptance_criteria:
      'KV + before/after stills + banners on-brief; brand QA pass; files linked on board.',
  },
  content: {
    role_key: 'content',
    role_label: 'Content create',
    kpis: [
      {
        name: 'posts_or_pillars',
        unit: 'count',
        parseKeys: ['posts', 'pillars', 'content_pillars', '# posts'],
      },
      {
        name: 'faq_shipped',
        unit: 'count',
        parseKeys: ['faq', 'FAQ'],
      },
    ],
    deliverables: ['Captions', 'FAQ', 'trust posts'],
    task_title_suffix: 'Ship content pillars & FAQ',
    acceptance_criteria:
      'Pillars/captions drafted; FAQ shipped; trust posts ready for schedule.',
  },
  video: {
    role_key: 'video',
    role_label: 'Video editor',
    kpis: [
      {
        name: 'videos_shipped',
        unit: 'count',
        parseKeys: ['videos', 'video', '# videos', 'clips'],
      },
      {
        name: 'cta_on_brief',
        unit: 'boolean',
        parseKeys: ['cta', 'CTA đúng brief'],
      },
    ],
    deliverables: ['Short before/after', 'FAQ clips'],
    task_title_suffix: 'Edit & ship video clips',
    acceptance_criteria:
      'Short before/after + FAQ clips shipped; CTA matches brief; review link attached.',
  },
  ads: {
    role_key: 'ads',
    role_label: 'Performance ads',
    kpis: [
      {
        name: 'cpl',
        unit: 'currency',
        parseKeys: ['cpl', 'CPL', 'cost_per_lead'],
      },
      {
        name: 'valid_leads',
        unit: 'count',
        parseKeys: ['valid lead', 'valid_leads', 'qualified leads'],
      },
    ],
    deliverables: ['Scale/optimize campaigns'],
    task_title_suffix: 'Launch & optimize ads',
    acceptance_criteria:
      'Campaigns live with tracking; CPL/valid-lead targets tracked (or marked unknown); daily hygiene.',
  },
  pm: {
    role_key: 'pm',
    role_label: 'Projects Manager',
    kpis: [
      {
        name: 'tasks_on_time_pct',
        unit: 'percent',
        parseKeys: ['on time', 'tasks_done', '% tasks'],
      },
      {
        name: 'open_blockers',
        unit: 'count',
        parseKeys: ['blockers', 'blocker'],
      },
    ],
    deliverables: ['Board hygiene', 'stage propose'],
    task_title_suffix: 'Board hygiene & stage gates',
    acceptance_criteria:
      'Board current; blockers logged; stage propose ready when DoD met.',
  },
};

export function isPlanBreakdownRoleKey(raw: string): raw is PlanBreakdownRoleKey {
  return Object.prototype.hasOwnProperty.call(PLAN_BREAKDOWN_ROLE_TEMPLATES, raw);
}
