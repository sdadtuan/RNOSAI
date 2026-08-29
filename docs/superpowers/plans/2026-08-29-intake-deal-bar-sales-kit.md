# Intake Deal Bar + Sales Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Isolated worktree: use superpowers:using-git-worktrees at execution time.

**Goal:** `/crm/intake` becomes a qualify workspace: Deal Bar + 4 tabs + 3 pilot service forms + Sales Kit (rules, then LLM) + knowledge library (Excel/PDF/image → Playbooks RAG with citations).

**Architecture:** Pure utils first (`resolveIntakeServiceSlug`, `gapToGo`, playbook definitions, kit rules, xlsx parse). Nest exposes `GET context`, `POST sessions/:id/sales-kit`, file ingest; RAG reuses `PlaybooksService.ragQuery` with `category=sales_kit`. ops-web replaces the stacked cards with Deal Bar + tabs + kit dock. S0–S2 ship without LLM; S3 is flag-gated; S4 keyword Q&A works with LLM off.

**Tech Stack:** NestJS `ptt-crm-api` (Jest), PostgreSQL, `exceljs` (already in api), `sharp` (already in api); Next.js ops-web (Vitest, Playwright); Playbooks RAG (`ai_playbooks` / `ai_playbook_chunks`).

**Spec:** [`docs/superpowers/specs/2026-08-29-intake-deal-bar-sales-kit-design.md`](../specs/2026-08-29-intake-deal-bar-sales-kit-design.md) v1.1 (INT-SK-20260829).

## Global Constraints

- Do not change `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }` or the 6 BANT keys.
- Kit never Complete / Reopen / advance funnel / PATCH session except when AM confirms apply (or confirm “Ghi tóm tắt”).
- Do not hardcode `service_slug: '_common'` in `buildCreateIntakeSessionBody` after Task 5 — pass resolved slug.
- Do not embed `LeadCopilotPanel` on Intake.
- Do not enqueue SCI M2 before Intake Go.
- Do not add puppeteer / pdfkit / Chromium / Tesseract / `xlsx` npm (use `exceljs`).
- File MIME whitelist only: xlsx, pdf, png, jpeg, webp.
- Price / case / Q&A answers require citations; empty library → empty-state, never invent numbers.
- Session bag files never appear in another lead’s retrieve.
- Hooks on Intake pages stay above early returns (no React #310).
- Do not `next build` ad-hoc on VPS in this plan.
- Branch: `feat/intake-deal-bar-sales-kit` from `main`.
- Copy VI from spec; do not add English UI chrome beyond existing bilingual quotes.
- Slice ship order: **S0 → S1 → S2 → S3 → S4**. Stop after S2 if PO wants prod without LLM/kho.

## File map

| File | Role | Slice |
|------|------|-------|
| Create `services/ops-web/src/lib/crm/intake-service-resolve.ts` | `SERVICE_SLUGS`, labels, `resolveIntakeServiceSlug`, `gapToGo` | S0 |
| Create `services/ops-web/src/lib/crm/intake-service-resolve.spec.ts` | Vitest | S0 |
| Modify `services/ptt-crm-api/src/intake/intake-definitions.util.ts` | 3 pilot forms + `qualify_items` + `schema_version: 3` | S0 |
| Create `services/ptt-crm-api/src/intake/intake-definitions.util.spec.ts` | Jest definitions | S0 |
| Modify `services/ops-web/src/lib/crm/intake-questions.ts` | `qualify_items`, `win_intel_prompts`, `is_pilot_form` on `IntakeDefinitionUi` | S0 |
| Create `services/ptt-crm-api/src/intake/intake-context.util.ts` | Parse `meta_json` → company/industry | S0 |
| Create `services/ptt-crm-api/src/intake/intake-context.util.spec.ts` | Jest | S0 |
| Modify `services/ptt-crm-api/src/intake/intake.service.ts` | `getContext`, later kit + summary | S0+ |
| Modify `services/ptt-crm-api/src/intake/intake.controller.ts` | `GET context` | S0 |
| Modify `services/ops-web/src/lib/api.ts` | `fetchIntakeContext`, kit + files types | S0+ |
| Create `services/ops-web/src/components/crm/intake/IntakeDealBar.tsx` | Sticky bar | S0 |
| Create `services/ops-web/src/components/crm/intake/IntakeWorkspaceTabs.tsx` | 4 tabs | S0 |
| Modify `services/ops-web/src/app/crm/intake/IntakeContent.tsx` | Layout; resolve slug; no hook-after-return | S0 |
| Modify `services/ops-web/src/app/globals.css` | `.intake-deal-bar`, `.intake-kit` | S0 |
| Modify `services/ops-web/src/lib/crm/intake-session-form.ts` | `service_slug` on create | S1 |
| Create `services/ops-web/src/lib/crm/intake-win-intel.ts` | Parse/merge `answers_json.win_intel` | S1 |
| Create `services/ops-web/src/lib/crm/intake-win-intel.spec.ts` | Vitest | S1 |
| Modify `services/ops-web/src/lib/crm/intake-answers.ts` | Merge `win_intel` | S1 |
| Create `services/ops-web/src/components/crm/intake/IntakeQualifyTab.tsx` | BANT + qualify_items + red flags | S1 |
| Create `services/ops-web/src/components/crm/intake/IntakeWinIntelSection.tsx` | 4 fields | S1 |
| Create `services/ops-web/src/components/crm/intake/IntakeHandoffTab.tsx` | stakeholder + L2 + summary + stepper | S1 |
| Create `services/ops-web/src/lib/crm/intake-sales-kit-rules.ts` | Rules-first intents | S2 |
| Create `services/ops-web/src/lib/crm/intake-sales-kit-rules.spec.ts` | Vitest (mirror BE) | S2 |
| Create `services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.ts` | Same rules on server | S2 |
| Create `services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.spec.ts` | Jest | S2 |
| Modify `services/ptt-crm-api/src/intake/intake.service.ts` | `salesKitTurn`, `generateAiSummary` rules/LLM | S2–S3 |
| Create `services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.tsx` | Chips + apply | S2 |
| Create `docs/specs/2026-08-29-sales-kit-files-ddl.sql` | `sales_kit_files` | S4 |
| Create `services/ptt-crm-api/src/intake/sales-kit-ingest.util.ts` | Parse xlsx/pdf/image | S4 |
| Create `services/ptt-crm-api/src/intake/sales-kit-ingest.util.spec.ts` | Jest + fixture buffer | S4 |
| Create `docs/crm/sales-kit/mau-qa-seo.xlsx` | Seed Q&A (or generate in test) | S4 |
| Create `services/ops-web/src/app/crm/intake/sales-kit/page.tsx` | Admin library | S4 |
| Create `services/ops-web/e2e/intake-deal-bar-sales-kit.spec.ts` | Playwright S0–S2 + S4 Excel | S2/S4 |
| Modify `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` | Intake section after S2 | S2 |

## Out of scope (reject if a task adds them)

- 9 remaining service forms, `.docx`/ZIP/Tesseract, M2-before-Go, Lead Copilot on Intake, auto BANT without confirm, auto-send outbound, VPS `next build`.

---

### Task 0: Resolve slug + gap-to-Go (pure)

**Files:**
- Create: `services/ops-web/src/lib/crm/intake-service-resolve.ts`
- Create: `services/ops-web/src/lib/crm/intake-service-resolve.spec.ts`

**Interfaces:**
- Consumes: spec §5.2–5.3; `GO_THRESHOLDS.go === 24` from `@/lib/crm/intake-bant`
- Produces: `PILOT_SERVICE_SLUGS`, `resolveIntakeServiceSlug()`, `intakeServiceLabel()`, `gapToGo()`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  gapToGo,
  intakeServiceLabel,
  resolveIntakeServiceSlug,
} from './intake-service-resolve';

describe('resolveIntakeServiceSlug', () => {
  it('prefers URL slug when in catalog', () => {
    expect(
      resolveIntakeServiceSlug({
        urlSlug: 'quang-cao-google',
        sessionSlug: 'dich-vu-seo-tong-the',
        funnelSlug: 'thiet-ke-website',
      }),
    ).toBe('quang-cao-google');
  });

  it('skips session _common and uses funnel', () => {
    expect(
      resolveIntakeServiceSlug({
        urlSlug: '',
        sessionSlug: '_common',
        funnelSlug: 'dich-vu-seo-tong-the',
      }),
    ).toBe('dich-vu-seo-tong-the');
  });

  it('falls back to _common', () => {
    expect(resolveIntakeServiceSlug({})).toBe('_common');
  });

  it('rejects unknown url slug', () => {
    expect(
      resolveIntakeServiceSlug({ urlSlug: 'not-a-service', funnelSlug: 'dich-vu-aeo' }),
    ).toBe('dich-vu-aeo');
  });
});

describe('gapToGo', () => {
  it('returns remaining points under 24', () => {
    expect(gapToGo(8)).toBe(16);
    expect(gapToGo(24)).toBe(0);
    expect(gapToGo(30)).toBe(0);
  });
});

describe('intakeServiceLabel', () => {
  it('labels three pilots and common', () => {
    expect(intakeServiceLabel('dich-vu-seo-tong-the')).toBe('SEO tổng thể');
    expect(intakeServiceLabel('quang-cao-google')).toBe('Quảng cáo Google');
    expect(intakeServiceLabel('thiet-ke-website')).toBe('Thiết kế website');
    expect(intakeServiceLabel('_common')).toBe('Chưa chọn dịch vụ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-service-resolve.spec.ts`  
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
export const CATALOG_SERVICE_SLUGS = [
  'dich-vu-seo-tong-the',
  'dich-vu-aeo',
  'dich-vu-seo-local',
  'dich-vu-seo-audit',
  'dich-vu-quan-tri-website',
  'thiet-ke-website',
  'thiet-ke-website-tron-goi',
  'thiet-ke-landing-page',
  'quang-cao-facebook',
  'quang-cao-google',
  'thue-tai-khoan-quang-cao',
  'tiep-thi-noi-dung',
] as const;

export const PILOT_SERVICE_SLUGS = [
  'dich-vu-seo-tong-the',
  'quang-cao-google',
  'thiet-ke-website',
] as const;

const LABELS: Record<string, string> = {
  'dich-vu-seo-tong-the': 'SEO tổng thể',
  'quang-cao-google': 'Quảng cáo Google',
  'thiet-ke-website': 'Thiết kế website',
  _common: 'Chưa chọn dịch vụ',
};

const KNOWN = new Set<string>([...CATALOG_SERVICE_SLUGS, '_common']);

export function normalizeIntakeSlug(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s === '00-form-chung' || s === 'common' || s === 'form-chung') return '_common';
  return s;
}

export function resolveIntakeServiceSlug(input: {
  urlSlug?: string | null;
  sessionSlug?: string | null;
  funnelSlug?: string | null;
}): string {
  const url = normalizeIntakeSlug(input.urlSlug);
  if (url && KNOWN.has(url) && url !== '_common') return url;
  if (url === '_common') {
    /* fall through — URL common does not beat session/funnel */
  }
  const session = normalizeIntakeSlug(input.sessionSlug);
  if (session && KNOWN.has(session) && session !== '_common') return session;
  const funnel = normalizeIntakeSlug(input.funnelSlug);
  if (funnel && KNOWN.has(funnel)) return funnel;
  if (url === '_common') return '_common';
  return '_common';
}

export function intakeServiceLabel(slug: string, catalogName?: string): string {
  const n = normalizeIntakeSlug(slug) || '_common';
  if (catalogName?.trim()) return catalogName.trim();
  return LABELS[n] ?? n;
}

export function gapToGo(bantTotal: number, goThreshold = 24): number {
  const t = Number(bantTotal) || 0;
  return Math.max(0, goThreshold - t);
}

export function isPilotServiceSlug(slug: string): boolean {
  return (PILOT_SERVICE_SLUGS as readonly string[]).includes(normalizeIntakeSlug(slug));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-service-resolve.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-service-resolve.ts services/ops-web/src/lib/crm/intake-service-resolve.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): resolve intake service slug and gap-to-Go

EOF
)"
```

---

### Task 1: Three pilot definitions (API)

**Files:**
- Modify: `services/ptt-crm-api/src/intake/intake-definitions.util.ts`
- Create: `services/ptt-crm-api/src/intake/intake-definitions.util.spec.ts`
- Modify: `services/ops-web/src/lib/crm/intake-questions.ts` (`IntakeDefinitionUi` extra fields)

**Interfaces:**
- Consumes: `getUiDefinition(slug)` today always returns `COMMON_FORM`
- Produces: `schema_version: 3`, `is_pilot_form`, `qualify_items`, `win_intel_prompts`, `l2_preview_keys`; SEO phone keys include `seo_domain`

- [ ] **Step 1: Write the failing test**

```ts
import { getUiDefinition } from './intake-definitions.util';

describe('getUiDefinition pilots', () => {
  it('returns common for unknown and aeo', () => {
    const common = getUiDefinition('_common') as { is_pilot_form?: boolean; slug: string };
    expect(common.slug).toBe('_common');
    expect(common.is_pilot_form).toBe(false);
    expect((getUiDefinition('dich-vu-aeo') as { is_pilot_form?: boolean }).is_pilot_form).toBe(false);
  });

  it('seo pilot has seo_domain and qualify_items', () => {
    const seo = getUiDefinition('dich-vu-seo-tong-the') as {
      is_pilot_form: boolean;
      schema_version: number;
      phone_question_items: Array<{ key: string; critical?: boolean }>;
      qualify_items: Array<{ key: string }>;
    };
    expect(seo.is_pilot_form).toBe(true);
    expect(seo.schema_version).toBe(3);
    expect(seo.phone_question_items.some((q) => q.key === 'seo_domain' && q.critical)).toBe(true);
    expect(seo.qualify_items.map((q) => q.key)).toEqual(
      expect.arrayContaining(['nganh', 'ngan_sach', 'domain', 'nhu_cau']),
    );
  });

  it('google ads and website are pilots', () => {
    expect((getUiDefinition('quang-cao-google') as { is_pilot_form: boolean }).is_pilot_form).toBe(true);
    expect((getUiDefinition('thiet-ke-website') as { is_pilot_form: boolean }).is_pilot_form).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/intake/intake-definitions.util.spec.ts --no-coverage`  
Expected: FAIL — `is_pilot_form` undefined / no `seo_domain`.

- [ ] **Step 3: Implement forms**

Keep `COMMON_FORM` + `getUiDefinition` wrapper. Add `SEO_FORM`, `GADS_FORM`, `WEB_FORM` objects with `phone_qs`, `inperson_qs`, `red_flags` (common 8 + 2 spec extras), `qualify_items`, `win_intel_prompts`, `l2_preview_keys`.

Phone item keys **must** match spec §7.2–7.4:

- SEO: `seo_domain`, `phone_pain_point`, `phone_budget`, `phone_decision_maker`, `seo_gsc`, `seo_competitors`, `seo_keywords`, `seo_history`, `phone_timeline`, `phone_industry`
- Google: `gads_account`, `phone_pain_point`, `phone_budget`, `phone_decision_maker`, `gads_type`, `gads_lp`, `gads_tracking`, `gads_history`, `phone_timeline`, `phone_industry`
- Web: `web_type`, `phone_pain_point`, `phone_budget`, `phone_decision_maker`, `web_deadline`, `web_refs`, `web_pages`, `web_brand`, `phone_industry`, `web_current`

Critical sets: keep common three + spec extras (`seo_domain`, `gads_type`, `web_type`, `web_deadline`).

In `getUiDefinition`:

```ts
const PILOT: Record<string, typeof COMMON_FORM & { qualify_items: unknown[] }> = {
  'dich-vu-seo-tong-the': SEO_FORM,
  'quang-cao-google': GADS_FORM,
  'thiet-ke-website': WEB_FORM,
};
const defSlug = resolveDefinitionSlug(slug);
const svc = PILOT[defSlug] ?? COMMON_FORM;
// build items; return { ..., qualify_items: svc.qualify_items ?? [], is_pilot_form: Boolean(PILOT[defSlug]), schema_version: 3 }
```

Extend `IntakeDefinitionUi`:

```ts
qualify_items?: Array<{ key: string; text: string; critical?: boolean }>;
win_intel_prompts?: Array<{ key: string; hint: string }>;
l2_preview_keys?: string[];
is_pilot_form?: boolean;
```

Copy question **text** verbatim from spec §7 (Vietnamese).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/intake/intake-definitions.util.spec.ts --no-coverage`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/intake-definitions.util.ts \
  services/ptt-crm-api/src/intake/intake-definitions.util.spec.ts \
  services/ops-web/src/lib/crm/intake-questions.ts
git commit -m "$(cat <<'EOF'
feat(crm): pilot intake definitions for SEO, Google Ads, website

EOF
)"
```

---

### Task 2: `GET /api/crm/intake/context`

**Files:**
- Create: `services/ptt-crm-api/src/intake/intake-context.util.ts`
- Create: `services/ptt-crm-api/src/intake/intake-context.util.spec.ts`
- Modify: `services/ptt-crm-api/src/intake/intake.service.ts` — add `getLeadContext(leadId, actor)`
- Modify: `services/ptt-crm-api/src/intake/intake.controller.ts`
- Modify: `services/ops-web/src/lib/api.ts` — `IntakeLeadContext`, `fetchIntakeContext`

**Interfaces:**
- Consumes: lead `meta_json`, funnel `service_slug`, LMP prep chip if table ready
- Produces:

```ts
export type IntakeLeadContextDto = {
  lead_id: number;
  full_name: string;
  company_name: string | null;
  industry: string | null;
  industry_slug: string | null;
  funnel_service_slug: string | null;
  presales_stage: string | null;
  l2_docs: unknown[];
  prep: { status: string; prep_stage: string; pain_excerpt: string } | null;
};
```

- [ ] **Step 1: Write the failing test** (parse util only)

```ts
import { parseLeadMetaIndustry } from './intake-context.util';

describe('parseLeadMetaIndustry', () => {
  it('reads company and industry from object or json string', () => {
    expect(parseLeadMetaIndustry({ company: 'KTL', industry: 'BĐS' })).toEqual({
      company_name: 'KTL',
      industry: 'BĐS',
      industry_slug: null,
    });
    expect(parseLeadMetaIndustry('{"company_name":"X","industry_slug":"bds"}')).toEqual({
      company_name: 'X',
      industry: null,
      industry_slug: 'bds',
    });
  });

  it('returns nulls for garbage', () => {
    expect(parseLeadMetaIndustry(null)).toEqual({
      company_name: null,
      industry: null,
      industry_slug: null,
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `cd services/ptt-crm-api && npx jest src/intake/intake-context.util.spec.ts --no-coverage`

- [ ] **Step 3: Implement util + service + route**

```ts
export function parseLeadMetaIndustry(meta: unknown): {
  company_name: string | null;
  industry: string | null;
  industry_slug: string | null;
} {
  let obj: Record<string, unknown> = {};
  if (typeof meta === 'string') {
    try {
      obj = JSON.parse(meta) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (meta && typeof meta === 'object') {
    obj = meta as Record<string, unknown>;
  }
  const company = String(obj.company_name ?? obj.company ?? '').trim() || null;
  const industry = String(obj.industry ?? '').trim() || null;
  const industry_slug = String(obj.industry_slug ?? '').trim() || null;
  return { company_name: company, industry, industry_slug };
}
```

Controller (after `stats`, before `entry`):

```ts
@Get('context')
async context(@Req() req: IntakeRequest, @Query('lead_id') leadId?: string) {
  const lid = Number(leadId || 0);
  if (!Number.isFinite(lid) || lid <= 0) {
    throw new BadRequestException({ error: 'lead_id_required' });
  }
  return this.intake.getLeadContext(lid, await this.actorContext(req));
}
```

`getLeadContext`: assert lead visible (`b2bVisibility`); load lead row + funnel snapshot (reuse existing funnel repo methods already used by intake load); map `l2_docs` from funnel if present else `[]`; prep chip optional try/catch empty.

`fetchIntakeContext` in `api.ts` mirrors other `crmFetch` helpers.

- [ ] **Step 4: Run util tests PASS**

Run: `cd services/ptt-crm-api && npx jest src/intake/intake-context.util.spec.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/intake-context.util.ts \
  services/ptt-crm-api/src/intake/intake-context.util.spec.ts \
  services/ptt-crm-api/src/intake/intake.service.ts \
  services/ptt-crm-api/src/intake/intake.controller.ts \
  services/ops-web/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(crm): add intake context endpoint for industry and service

EOF
)"
```

---

### Task 3: Deal Bar + 4-tab shell (S0 UI)

**Files:**
- Create: `services/ops-web/src/components/crm/intake/IntakeDealBar.tsx`
- Create: `services/ops-web/src/components/crm/intake/IntakeWorkspaceTabs.tsx`
- Modify: `services/ops-web/src/app/crm/intake/IntakeContent.tsx`
- Modify: `services/ops-web/src/app/globals.css` (append `.intake-deal-bar`, `.intake-workspace-tabs`)
- Delete usage of stacked `IntakeLeadContextCard` + `IntakePrepSummaryCard` + always-open stepper from main column (keep components; stepper moves into collapsed Deal Bar / later Handoff)

**Interfaces:**
- Consumes: `resolveIntakeServiceSlug`, `gapToGo`, `intakeServiceLabel`, `fetchIntakeContext`, `funnelServiceSlug`, `liveBantTotal`
- Produces: `activeTab: 'qualify' | 'discovery' | 'win_intel' | 'handoff'`; `resolvedSlug`

Default tab: `discovery` if draft && BANT &lt; 18; `handoff` if session `completed`; else `qualify`.

Deal Bar props (exact):

```ts
export type IntakeDealBarProps = {
  leadName: string;
  companyName: string | null;
  industry: string | null;
  serviceSlug: string;
  serviceLabel: string;
  bantTotal: number;
  gap: number;
  stage: string | null;
  sciExcerpt: string | null;
  leadHref: string;
  cockpitHref: string;
  canEdit: boolean;
  slugMismatch: boolean;
  funnelCollapsed: boolean;
  onToggleFunnel: () => void;
  onServiceChange: (slug: string) => void;
};
```

- [ ] **Step 1: Write Deal Bar render test** (if the repo has no RTL for intake, skip RTL — instead unit-test tab picker)

Create `services/ops-web/src/lib/crm/intake-workspace-tab.ts` + spec:

```ts
export type IntakeWorkspaceTab = 'qualify' | 'discovery' | 'win_intel' | 'handoff';

export function pickDefaultIntakeTab(input: {
  sessionStatus?: string | null;
  bantTotal: number;
}): IntakeWorkspaceTab {
  if (input.sessionStatus === 'completed') return 'handoff';
  if ((input.bantTotal ?? 0) < 18) return 'discovery';
  return 'qualify';
}
```

```ts
import { describe, expect, it } from 'vitest';
import { pickDefaultIntakeTab } from './intake-workspace-tab';

describe('pickDefaultIntakeTab', () => {
  it('handoff when completed', () => {
    expect(pickDefaultIntakeTab({ sessionStatus: 'completed', bantTotal: 0 })).toBe('handoff');
  });
  it('discovery when draft and low BANT', () => {
    expect(pickDefaultIntakeTab({ sessionStatus: 'draft', bantTotal: 8 })).toBe('discovery');
  });
  it('qualify when BANT >= 18', () => {
    expect(pickDefaultIntakeTab({ sessionStatus: 'draft', bantTotal: 18 })).toBe('qualify');
  });
});
```

- [ ] **Step 2: Run fail then implement tab util — PASS**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-workspace-tab.spec.ts`

- [ ] **Step 3: Wire IntakeContent**

In `IntakeContent` (hooks **above** any `if (!authReady)` return):

1. After funnel + sessions load, `resolvedSlug = resolveIntakeServiceSlug({ urlSlug: searchParams, sessionSlug: active?.service_slug, funnelSlug: funnelServiceSlug(funnelSnap) })`.
2. `fetchIntakeDefinitionBySlug(access, resolvedSlug)` — **not** `'_common'` hardcoded (replace line that fetches `_common`).
3. Fetch `fetchIntakeContext` when `leadId > 0`.
4. Main column: `IntakeDealBar` then `IntakeWorkspaceTabs`.  
   - `qualify` / `discovery` / `win_intel` / `handoff` children: for S0, **move existing sections** into tabs without new win_intel yet (win_intel tab can show “S1” placeholder **only if** you cannot move discovery — prefer: Qualify = existing Bant + red flags; Discovery = existing discovery; Win intel = muted “Sẽ mở ở S1”; Handoff = commitments + stakeholders + AI + collapsed `CrmFunnelStepper`).
5. Remove `IntakeLeadContextCard` and `IntakePrepSummaryCard` from the stack. SCI excerpt = context.prep.pain_excerpt.
6. Help `<details>` → single `?` button toggling a short drawer (4 steps).
7. PageToolbar subtitle: `Phiên qualify theo dịch vụ` (not the long BANT acronym paragraph).

CSS: sticky `.intake-deal-bar { position: sticky; top: 0; z-index: 5; }` under existing intake layout. Do not create a new CSS file.

- [ ] **Step 4: Manual / unit**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-service-resolve.spec.ts src/lib/crm/intake-workspace-tab.spec.ts`  
Expected: PASS. Smoke: `npm run lint` on touched TSX if convenient.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-workspace-tab.ts \
  services/ops-web/src/lib/crm/intake-workspace-tab.spec.ts \
  services/ops-web/src/components/crm/intake/IntakeDealBar.tsx \
  services/ops-web/src/components/crm/intake/IntakeWorkspaceTabs.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): add intake Deal Bar and workspace tabs

EOF
)"
```

---

### Task 4: Create/PATCH session slug (S1)

**Files:**
- Modify: `services/ops-web/src/lib/crm/intake-session-form.ts`
- Create: `services/ops-web/src/lib/crm/intake-session-form.spec.ts` (or extend if exists)
- Modify: `IntakeContent.tsx` `onCreate` + Deal Bar `onServiceChange`

**Interfaces:**
- Consumes: `buildCreateIntakeSessionBody` currently sets `service_slug: '_common'`
- Produces: `buildCreateIntakeSessionBody({ ..., serviceSlug })`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildCreateIntakeSessionBody } from './intake-session-form';

describe('buildCreateIntakeSessionBody', () => {
  it('sends resolved service slug', () => {
    const body = buildCreateIntakeSessionBody({
      leadId: 5,
      lifecycleId: 0,
      mode: 'phone',
      lead: { full_name: 'Tuan', source: 'facebook' },
      serviceSlug: 'dich-vu-seo-tong-the',
    });
    expect(body.service_slug).toBe('dich-vu-seo-tong-the');
    expect(body.lead_id).toBe(5);
  });

  it('defaults _common when slug omitted', () => {
    expect(
      buildCreateIntakeSessionBody({ leadId: 1, lifecycleId: 0, mode: 'phone' }).service_slug,
    ).toBe('_common');
  });
});
```

- [ ] **Step 2: Run fail** (`service_slug` still `_common` even when passed)

- [ ] **Step 3: Implement**

Add `serviceSlug?: string` to input; `service_slug: normalize or input.serviceSlug?.trim() || '_common'`.

`onCreate`: pass `resolvedSlug`.  
`onServiceChange`: if `active.status === 'draft'` and `canCreate`, `patchIntakeSession(access, active.id, { service_slug })` then reload definition for new slug; keep bant/answers in React state. If completed, `setMessage('Reopen hoặc tạo phiên mới để đổi dịch vụ.')`.

Confirm `PatchIntakeSessionBody` in `intake.types.ts` already allows `service_slug` via session update — if PATCH ignores slug, add `service_slug?: string` to `PatchIntakeSessionBody` and persist in `intake-pg.repository` update whitelist.

- [ ] **Step 4: Tests PASS**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-session-form.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-session-form.ts \
  services/ops-web/src/lib/crm/intake-session-form.spec.ts \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx \
  services/ptt-crm-api/src/intake/intake.types.ts \
  services/ptt-crm-api/src/intake/intake-pg.repository.ts
git commit -m "$(cat <<'EOF'
feat(crm): persist intake session service slug from Deal Bar

EOF
)"
```

---

### Task 5: Win intel + Qualify / Handoff tabs (S1)

**Files:**
- Create: `services/ops-web/src/lib/crm/intake-win-intel.ts`
- Create: `services/ops-web/src/lib/crm/intake-win-intel.spec.ts`
- Modify: `services/ops-web/src/lib/crm/intake-answers.ts`
- Create: `IntakeQualifyTab.tsx`, `IntakeWinIntelSection.tsx`, `IntakeHandoffTab.tsx`
- Modify: `IntakeContent.tsx` — state `winIntel`, include in autosave snapshot + PATCH
- Modify: `intakeFormFromSession` to load win_intel

**Interfaces:**

```ts
export type WinIntelKey = 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk';
export type WinIntelState = Record<WinIntelKey, { answer: string; confidence: string }>;

export function emptyWinIntel(): WinIntelState;
export function parseWinIntel(answers: Record<string, unknown> | undefined): WinIntelState;
export function mergeWinIntelPatch(
  existing: Record<string, unknown> | undefined,
  winIntel: WinIntelState,
): Record<string, unknown>;
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { emptyWinIntel, mergeWinIntelPatch, parseWinIntel } from './intake-win-intel';

describe('parseWinIntel', () => {
  it('fills four keys', () => {
    const w = parseWinIntel({
      win_intel: { incumbent: { answer: 'Agency A', confidence: 'heard' } },
    });
    expect(w.incumbent.answer).toBe('Agency A');
    expect(w.competitor.answer).toBe('');
  });
});

describe('mergeWinIntelPatch', () => {
  it('keeps discovery when merging', () => {
    const out = mergeWinIntelPatch({ crm_fields: { need: 'x' } }, {
      ...emptyWinIntel(),
      incumbent: { answer: 'A', confidence: 'confirmed' },
    });
    expect((out.crm_fields as { need: string }).need).toBe('x');
    expect((out.win_intel as { incumbent: { answer: string } }).incumbent.answer).toBe('A');
  });
});
```

- [ ] **Step 2: Run fail**

- [ ] **Step 3: Implement parse/merge; `buildIntakeAnswersPatch` adds `winIntel` argument and calls `mergeWinIntelPatch` last.**

Qualify tab: existing `IntakeBantSection` + `IntakeRedFlagsSection` (default collapsed) + checklist from `intakeDefinition.qualify_items` stored as discovery-like ticks in `answers_json.qualify_checked` **or** reuse discovery keys if they match — **prefer** `answers_json.qualify_checked: Record<string, boolean>` to avoid colliding with phone keys.

Handoff: move `IntakeStakeholderMatrix` (collapsed if `liveBantTotal < 18`), `IntakeCommitmentsSection`, `IntakeAiSummaryPanel`, `CrmFunnelStepper`. L2: map `context.l2_docs` read-only list; empty → muted “Tick L2 trên lead”.

Remove `BantQualifyChecklist` import path from Intake (do not delete the Cockpit file).

- [ ] **Step 4: PASS vitest win-intel + answers if you add a case**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-win-intel.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-win-intel.ts \
  services/ops-web/src/lib/crm/intake-win-intel.spec.ts \
  services/ops-web/src/lib/crm/intake-answers.ts \
  services/ops-web/src/lib/crm/intake-session-form.ts \
  services/ops-web/src/components/crm/intake/IntakeQualifyTab.tsx \
  services/ops-web/src/components/crm/intake/IntakeWinIntelSection.tsx \
  services/ops-web/src/components/crm/intake/IntakeHandoffTab.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx
git commit -m "$(cat <<'EOF'
feat(crm): add intake win-intel and qualify handoff tabs

EOF
)"
```

---

### Task 6: Sales Kit rules engine (S2)

**Files:**
- Create: `services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.ts`
- Create: `services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.spec.ts`
- Copy twin: `services/ops-web/src/lib/crm/intake-sales-kit-rules.ts` + `.spec.ts` **or** keep single source on API and FE only displays API results (preferred: **server is source of truth**; FE does not duplicate scoring).

**Interfaces:**

```ts
export type SalesKitIntent =
  | 'next_question'
  | 'gap_to_go'
  | 'win_intel'
  | 'service_dive'
  | 'summary_30s'
  | 'red_flag'
  | 'freeform'
  | 'ask_library'
  | 'battle_card'
  | 'pricing_band';

export type SalesKitRulesInput = {
  intent: SalesKitIntent;
  message?: string;
  bant: Record<string, number>;
  discoveryAnswers: Record<string, { answer?: string }>;
  criticalKeys: string[];
  qualifyItems: Array<{ key: string; text: string }>;
  serviceSlug: string;
  isPilot: boolean;
};

export type SalesKitRulesOutput = {
  reply_vi: string;
  next_question?: { key: string; text: string; tab: 'discovery' | 'qualify' | 'win_intel' };
  apply: {
    discovery?: Array<{ key: string; answer: string }>;
    win_intel?: Partial<Record<string, string>>;
    ai_summary?: string;
    bant_hints?: Partial<Record<string, number>>;
    red_flags?: string[];
  };
  gap: { total: number; to_go: number; weakest: string[] };
  citations: [];
  stub_mode: true;
};
```

- [ ] **Step 1: Failing tests**

```ts
import { runSalesKitRules } from './intake-sales-kit-rules.util';

const base = {
  bant: { budget: 0, authority: 0, need: 0, timeline: 0, fit: 0, history: 0 },
  discoveryAnswers: {},
  criticalKeys: ['phone_pain_point', 'phone_budget', 'phone_decision_maker'],
  qualifyItems: [{ key: 'domain', text: 'Website domain' }],
  serviceSlug: 'dich-vu-seo-tong-the',
  isPilot: true,
};

describe('runSalesKitRules', () => {
  it('gap_to_go lists all empty when total 0', () => {
    const out = runSalesKitRules({ ...base, intent: 'gap_to_go' });
    expect(out.gap.total).toBe(0);
    expect(out.gap.to_go).toBe(24);
    expect(out.gap.weakest).toEqual(['budget', 'authority', 'need', 'timeline', 'fit', 'history']);
    expect(out.apply.bant_hints).toBeUndefined();
    expect(out.reply_vi).toMatch(/Budget|ngân sách/i);
  });

  it('next_question returns first critical without answer', () => {
    const out = runSalesKitRules({ ...base, intent: 'next_question' });
    expect(out.next_question?.key).toBe('phone_pain_point');
    expect(out.next_question?.tab).toBe('discovery');
  });

  it('service_dive tells non-pilot to use common form', () => {
    const out = runSalesKitRules({
      ...base,
      intent: 'service_dive',
      serviceSlug: 'dich-vu-aeo',
      isPilot: false,
    });
    expect(out.reply_vi).toMatch(/Chưa có playbook/);
  });

  it('ask_library without chunks stays empty-state', () => {
    const out = runSalesKitRules({ ...base, intent: 'ask_library', message: 'đắt' });
    expect(out.citations).toEqual([]);
    expect(out.reply_vi).toMatch(/Chưa có file|kho/i);
  });
});
```

- [ ] **Step 2: Run fail**

- [ ] **Step 3: Implement `runSalesKitRules`**

- `weakest`: keys with score `<= 2`, sort ascending, then missing.  
- `next_question`: first `criticalKeys` whose `discoveryAnswers[key].answer` is blank.  
- `service_dive` pilot: list up to 3 `qualifyItems` not yet answered.  
- `summary_30s` rules: join `BANT {total}/30 · DV {slug}` + first 3 non-empty discovery answers, **no** `[stub]`.  
- `ask_library` / `pricing_band` at this task: empty-state only (S4 fills retrieve).

- [ ] **Step 4: PASS**

Run: `cd services/ptt-crm-api && npx jest src/intake/intake-sales-kit-rules.util.spec.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.ts \
  services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add sales-kit rules engine for intake intents

EOF
)"
```

---

### Task 7: `POST …/sessions/:id/sales-kit` + replace summary stub (S2)

**Files:**
- Modify: `intake.service.ts` — `salesKitTurn`, rewrite `generateAiSummary`
- Modify: `intake.controller.ts`
- Modify: `intake-pg.repository.ts` — `saveAiSummary` writes provided string (rename from stub)
- Modify: `services/ops-web/src/lib/api.ts` — `postIntakeSalesKit`

**Interfaces:**
- `POST /api/crm/intake/sessions/:id/sales-kit` body `{ intent, message? }`  
- Response = `SalesKitRulesOutput` + `run_id?`  
- `generateAiSummary`: call `runSalesKitRules({ intent: 'summary_30s', ...session })`; save `reply_vi` as `ai_summary`. If `ANTHROPIC_API_KEY` or existing `AiLlmClient` configured **and** `PTT_INTAKE_SALES_KIT_LLM=1`, skip LLM in this task (S3). This task **must** eliminate `[stub]` string.

- [ ] **Step 1: Service unit test with mocked pg**

Add `intake.service.spec.ts` if missing; otherwise test `buildRulesInputFromSession` pure helper in `intake-sales-kit-rules.util.ts`:

```ts
it('summary text never contains [stub]', () => {
  const out = runSalesKitRules({ ...base, intent: 'summary_30s' });
  expect(out.reply_vi.includes('[stub]')).toBe(false);
});
```

- [ ] **Step 2–4: Implement endpoint + wire `generateAiSummary` to rules; remove `saveAiSummaryStub` concatenation-only path (keep persist function that takes `summary: string`).**

Controller:

```ts
@Post('sessions/:id/sales-kit')
@UseGuards(StaffIntakeWriteGuard)
@HttpCode(HttpStatus.OK)
async salesKit(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: { intent?: string; message?: string },
  @Req() req: IntakeRequest,
) {
  return this.intake.salesKitTurn(id, body, await this.actorContext(req));
}
```

`salesKitTurn`: load session, visibility, build input from `bant_json` + `answers_json`, `runSalesKitRules`, return. No session write.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/intake.service.ts \
  services/ptt-crm-api/src/intake/intake.controller.ts \
  services/ptt-crm-api/src/intake/intake-pg.repository.ts \
  services/ops-web/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(crm): expose sales-kit turn API and unstub intake summary

EOF
)"
```

---

### Task 8: Sales Kit panel + apply (S2 UI)

**Files:**
- Create: `services/ops-web/src/lib/crm/intake-sales-kit-apply.ts` + `.spec.ts`
- Create: `services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.tsx`
- Modify: `IntakeContent.tsx` — dock kit (desktop) / sheet (existing sidebar pattern)
- Modify: `globals.css` — `.intake-kit`
- Create: `services/ops-web/src/lib/crm/intake-sales-kit-flags.ts` — `intakeSalesKitEnabled()` reads `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT` default `'1'`

**Interfaces:**

```ts
export function applySalesKitToForm(
  current: { discovery: DiscoveryChecklistState; winIntel: WinIntelState; bant: Record<string, number> },
  apply: SalesKitRulesOutput['apply'],
  selected: { discovery: boolean; winIntel: boolean; bantHints: boolean },
): typeof current;
```

- [ ] **Step 1: Failing apply test**

```ts
it('does not write bant unless selected', () => {
  const cur = { discovery: emptyDiscoveryForMode('phone'), winIntel: emptyWinIntel(), bant: { budget: 1 } };
  const next = applySalesKitToForm(cur, { bant_hints: { budget: 4 } }, {
    discovery: false,
    winIntel: false,
    bantHints: false,
  });
  expect(next.bant.budget).toBe(1);
});

it('writes bant when selected', () => {
  const cur = { discovery: emptyDiscoveryForMode('phone'), winIntel: emptyWinIntel(), bant: { budget: 1 } };
  const next = applySalesKitToForm(cur, { bant_hints: { budget: 4 } }, {
    discovery: false,
    winIntel: false,
    bantHints: true,
  });
  expect(next.bant.budget).toBe(4);
});
```

- [ ] **Step 2–4: Implement apply + panel**

Chips 1–6 call `postIntakeSalesKit` with intents from spec §9.2. Chip 7–8 visible but may  empty-state until S4.  
Default checkboxes: discovery/win_intel/summary on; **bant_hints off**.  
`IntakeSalesKitPanel` does not import Copilot components.

Flag file:

```ts
export function intakeSalesKitEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_INTAKE_SALES_KIT ?? '1').trim() !== '0';
}
export function intakeSalesKitLlmEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM ?? '0').trim() === '1';
}
```

Hide freeform chat input when LLM flag is 0; chips still work.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-sales-kit-apply.ts \
  services/ops-web/src/lib/crm/intake-sales-kit-apply.spec.ts \
  services/ops-web/src/lib/crm/intake-sales-kit-flags.ts \
  services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(crm): dock intake Sales Kit panel with confirm-to-apply

EOF
)"
```

---

### Task 9: Playwright S0–S2 + user guide

**Files:**
- Create: `services/ops-web/e2e/intake-deal-bar-sales-kit.spec.ts`
- Modify: `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` (Intake: Deal Bar, tabs, kit chips)
- Modify: `docs/huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md` § card SCI trên Intake → Deal Bar chip

Reuse auth/helpers from `e2e/intake-bant-phase25-stepper.spec.ts` / `e2e/helpers/funnel-stepper-helpers.ts`.

- [ ] **Step 1: Write spec**

```ts
test('deal bar and discovery tab replace stacked context cards', async ({ page }) => {
  // login + open /crm/intake?lead_id=<fixture>
  await expect(page.locator('.intake-deal-bar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A. Ngữ cảnh lead' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Discovery/i })).toBeVisible();
});
```

If fixture lead slug is SEO, assert `seo_domain` / domain question visible after creating phone session.  
Assert kit chip “Còn thiếu để Go” shows `24` when BANT 0.  
Do **not** require LLM.

- [ ] **Step 2: Run e2e locally** (same env as phase25)

Run: `cd services/ops-web && npx playwright test e2e/intake-deal-bar-sales-kit.spec.ts`  
Expected: PASS on staging/dev with staff fixture.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/e2e/intake-deal-bar-sales-kit.spec.ts \
  docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md \
  docs/huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md
git commit -m "$(cat <<'EOF'
test(crm): e2e intake Deal Bar workspace and document kit UI

EOF
)"
```

**S0–S2 ship gate:** PO can merge here.

---

### Task 10: LLM summary + kit (S3)

**Files:**
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `intakeSalesKitLlmEnabled` from `PTT_INTAKE_SALES_KIT_LLM`
- Modify: `intake.service.ts` — after rules, if flag + `AiLlmClient` available, `completeJson` for `summary_30s` and `freeform` / `next_question` **wording only** (do not invent BANT numbers)
- Audit: `ai_agent_runs` `use_case=intake_ai_summary` | `intake_sales_kit`

**Interfaces:**
- LLM output `{ summary_vi: string, suggested_questions: string[], bant_hints?: Record<string, number> }`  
- Persist summary + `ai_suggested_questions`; **never** auto-write `bant_json`  
- On timeout/error: return rules output, `stub_mode: true`

- [ ] **Step 1: Unit-test prompt builder** (no live network)

Create `intake-sales-kit-llm.util.ts`:

```ts
export function assertNoInventedMoney(reply: string, citations: Array<{ kind: string }>): boolean {
  if (!/\d+\s*(tr|triệu|vnd|đ)/i.test(reply)) return true;
  return citations.some((c) => c.kind === 'pricing' || c.kind === 'qa');
}
```

```ts
it('blocks money without pricing citation', () => {
  expect(assertNoInventedMoney('Gói 20 triệu', [])).toBe(false);
  expect(assertNoInventedMoney('Gói 20 triệu', [{ kind: 'pricing' }])).toBe(true);
});
```

- [ ] **Step 2–4: Implement flag + `completeJson` path; strip money if assert fails.**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/config/app-config.service.ts \
  services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.ts \
  services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.spec.ts \
  services/ptt-crm-api/src/intake/intake.service.ts
git commit -m "$(cat <<'EOF'
feat(crm): optional LLM path for intake sales kit

EOF
)"
```

---

### Task 11: `sales_kit_files` DDL + folder playbooks (S4)

**Files:**
- Create: `docs/specs/2026-08-29-sales-kit-files-ddl.sql`
- Create: `services/ptt-crm-api/src/intake/sales-kit-library.util.ts` + `.spec.ts` (`folderKeyOk`, `playbookSlugForFolder`)
- Modify: playbooks create-on-ensure for `sk-dich-vu-seo-tong-the-qa` etc. **or** lazy-create on first upload

DDL:

```sql
CREATE TABLE IF NOT EXISTS sales_kit_files (
  id BIGSERIAL PRIMARY KEY,
  playbook_id UUID,
  lead_id INTEGER,
  session_id INTEGER,
  folder_key VARCHAR(191) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(127) NOT NULL,
  storage_key TEXT NOT NULL,
  parse_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_files_folder_idx ON sales_kit_files (folder_key);
CREATE INDEX IF NOT EXISTS sales_kit_files_lead_idx ON sales_kit_files (lead_id, session_id);
```

```ts
export function folderKeyOk(key: string): boolean {
  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  return parts.every((p) => /^[a-z0-9][a-z0-9-_]*$/.test(p));
}
export function playbookSlugForFolder(folderKey: string): string {
  return `sk-${folderKey.replace(/\//g, '-')}`;
}
```

- [ ] Tests: accept `dich-vu-seo-tong-the/qa`; reject `../etc`; session slug `sk-session-5-12`.
- [ ] Commit DDL + util.

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add sales_kit_files schema and folder keys

EOF
)"
```

---

### Task 12: Ingest Excel Q&A + pricing (S4)

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-ingest.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-ingest.util.spec.ts`
- Create fixture in spec via `exceljs` (do not commit a binary unless needed)

**Interfaces:**

```ts
export type IngestChunk = { chunk_key: string; title: string; body: string; kind: 'qa' | 'pricing' };

export function parseSalesKitXlsx(buf: Buffer, kind: 'qa' | 'pricing' | 'auto'): {
  chunks: IngestChunk[];
  error?: 'xlsx_qa_columns' | 'xlsx_empty';
};
```

- [ ] **Step 1: Test builds a workbook in-memory**

```ts
import ExcelJS from 'exceljs';

it('parses Q/A aliases', async () => {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('qa');
  sh.addRow(['cau_hoi', 'cau_tra_loi']);
  sh.addRow(['KH nói đắt', 'Neo gói TC 3 tháng, không giảm dưới band']);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const out = parseSalesKitXlsx(buf, 'qa');
  expect(out.chunks).toHaveLength(1);
  expect(out.chunks[0].body).toContain('KH nói đắt');
  expect(out.chunks[0].body).toContain('Neo gói TC');
});

it('fails without Q/A columns', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('x').addRow(['foo', 'bar']);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  expect(parseSalesKitXlsx(buf, 'qa').error).toBe('xlsx_qa_columns');
});
```

- [ ] **Step 2–4: Implement header alias map from spec §8.10; pricing columns `item|goi`, `min_vnd`, `max_vnd`, `note`.**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): parse sales-kit Excel Q&A and pricing sheets

EOF
)"
```

---

### Task 13: Ingest PDF text + image gate (S4)

**Files:**
- Modify: `sales-kit-ingest.util.ts` — `parseSalesKitPdf(buf)`, `shouldHoldImageForOcr(llmOn: boolean)`
- Prefer a lightweight `pdf-parse` **only if** already in lockfile; otherwise implement a **minimal** text extract using existing buffer scan for `/Type /Page` is **not** acceptable. Check `package.json`: if no pdf lib, add **`pdf-parse`** (no Chromium). If PO forbids new deps, PDF ingest returns `needs_ocr` always until a dep is approved — **default this plan: add `pdf-parse`** as the one new dependency.

- [ ] Test: tiny PDF fixture (`%PDF` with extractable Hello) if `pdf-parse` works; else test `needs_ocr` on empty extract.
- [ ] Image: `parse_status = llmOn ? 'pending_vision' : 'needs_ocr'` — vision job only when S3 flag on; S4 can ship images as `needs_ocr` without vision.

- [ ] Commit:

```bash
git commit -m "$(cat <<'EOF'
feat(crm): extract sales-kit PDF text and gate images for OCR

EOF
)"
```

---

### Task 14: Upload API + RAG retrieve (S4)

**Files:**
- Modify: `intake.controller.ts` — `POST sales-kit/files` multipart, `GET sales-kit/files`, `POST sales-kit/files/:id/approve`
- Modify: `PlaybooksService.ragQuery` — optional `tags?: string[]` / `category?: string` filter **or** add `ragQuerySalesKit` in intake service that lists chunks by playbook ids then scores with existing `keywordScore` + `cosineSimilarity` (avoid breaking CSKH playbooks). **Prefer intake-local retrieve** using `listChunks` of kit playbooks — do not change CSKH ranked endpoint behavior.
- Modify: `salesKitTurn` for `ask_library` / `pricing_band` / `battle_card`: retrieve top 5, map citations `{ file_id, file_name, folder_path, excerpt, score, kind }`. Keyword-only: `reply_vi` = first QA answer body. LLM off required path.
- Caps: upload org = `playbooks.configure` OR `crm_leads.configure`; session bag = `crm_leads.edit` + matching `lead_id`/`session_id`.
- MIME / size from spec §8.10.
- Storage: `PTT_SALES_KIT_STORAGE_DIR` default `var/sales-kit` under repo/cwd; mkdirp; never serve files without staff guard.

Session retrieve filter: `lead_id = session.lead_id AND session_id = session.id` UNION org folders for slug + `_common`.

- [ ] Jest: retrieve helper prefers session chunk over org when scores tie (session score +0.2).
- [ ] Commit:

```bash
git commit -m "$(cat <<'EOF'
feat(crm): upload sales-kit files and retrieve Q&A with citations

EOF
)"
```

---

### Task 15: Admin library + túi phiên UI + e2e S4

**Files:**
- Create: `services/ops-web/src/app/crm/intake/sales-kit/page.tsx` + client panel
- Modify: `OpsNav.tsx` — link **Kho Sales Kit** if `playbooks.configure` or `crm_leads.configure`
- Create: `IntakeSalesKitLibrarySheet.tsx` — session dropzone + org browse read-only
- Modify: `IntakeSalesKitPanel` — chips 7–8 live; render `citations`
- Extend: `e2e/intake-deal-bar-sales-kit.spec.ts` — upload fixture xlsx (generate in test) OR skip if no configure cap
- Seed: on admin first load empty `dich-vu-seo-tong-the/qa`, button **Tải mẫu** downloads generated xlsx (same columns as Task 12)

- [ ] UAT-13–16 from spec as Playwright if credentials allow; otherwise Jest ingest + manual checklist in PR.

- [ ] Commit:

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add sales-kit library admin and session file bag

EOF
)"
```

---

## Self-review (spec coverage)

| Spec | Task |
|------|------|
| Deal Bar fields / resolve slug | 0, 2, 3 |
| 4 tabs + collapse SCI/stepper | 3, 5 |
| 3 pilot definitions | 1 |
| Create/PATCH slug | 4 |
| Win intel + qualify items | 5 |
| Kit 6 waters / rules / no stub summary | 6, 7 |
| Panel + apply BANT confirm | 8 |
| E2E S0–S2 + guides | 9 |
| LLM flag + no invented money | 10 |
| Folders, xlsx/pdf/image, RAG, citation, túi phiên, admin | 11–15 |
| Out of scope 9 slugs / docx / M2 early | Global constraints |

No TBD left in tasks. Types (`WinIntelKey`, `SalesKitIntent`, `IntakeLeadContextDto`) are named consistently across tasks.

---

## Execution handoff

Plan saved to [`docs/superpowers/plans/2026-08-29-intake-deal-bar-sales-kit.md`](docs/superpowers/plans/2026-08-29-intake-deal-bar-sales-kit.md).

**Two execution options:**

1. **Subagent-Driven (recommended)** — one fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans and checkpoints  

**Which approach?** If you only want a mergeable increment first, start **Tasks 0–9 (S0–S2)** — Deal Bar + 3 forms + kit rules, no LLM/kho.
