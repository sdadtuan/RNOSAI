# PTT Facebook Lead Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a four-file 9:16 Lead pack (H1/H2/H3 15s + H1-30) that passes pack QC, lands in Creative OS, uses one Instant Form, and launches three `re_lead_default` ad sets — without the 49s brand film or an on-screen AI label.

**Architecture:** Campaign rules live in a pure QC util (not the generic 10-key CP QC). Editors produce MP4s from a locked bible/VO/shot list, probe them, fill facts, and only ingest versions that the util marks `passed`. Instant Form field keys are locked so webhook `raw_field_data` supports the 70% qualific metric. Ads Ops launches three ad sets on the same form; H1-30 stays paused until day 7.

**Tech Stack:** NestJS `ptt-crm-api` (Jest), Creative OS `/crm/creative-os`, Meta Ads Ops `/meta/ads-ops` + Ads Manager Instant Form, ffmpeg/ffprobe, CapCut or Premiere. No new npm packages. Do not regenerate stock film in CP Video Studio.

**SoT:** [2026-09-10-ptt-fb-lead-video-design.md](../specs/2026-09-10-ptt-fb-lead-video-design.md)

## Global Constraints

- Objective `OUTCOME_LEADS` / `LEAD_GENERATION` / template `re_lead_default`. Never optimize for calls.
- Four files only: `ptt-lead-h1-15.mp4`, `ptt-lead-h2-15.mp4`, `ptt-lead-h3-15.mp4`, `ptt-lead-h1-30.mp4`.
- 1080×1920, 30 fps, H.264 + AAC, ≤ 30 MB/file.
- One AI Advisor face id `ptt-advisor-f-01`. Face time ≤ 5.5s per 15s file. No founder/AM name.
- Do not burn `Hình ảnh AI` or `Hình ảnh minh họa bằng AI` on video, caption, or primary text.
- Proof = real UI on `https://rs.pttads.vn` with client names blurred. No fake CPL %.
- Do not use `/Users/quoctuan/Downloads/PTT MKT.mp4` as master or recycle its faces.
- Do not change `QC_CHECK_KEYS` in `cp-qc.service.ts` (ten SRS keys stay).
- Do not invent a second lead ingest. Webhook already writes `meta.raw_field_data`.
- Vietnamese copy only on creative. Phone `0900 353 9226` is secondary on H1-30 only.
- Safe zone: 110px top, 280px bottom. Captions in the top third, words spaced.
- Internal metadata: `contains_human=true`, `ai_disclosure=true`. Never render those flags on the file.

---

## File map

| File | Responsibility |
|---|---|
| `services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.util.ts` | Pack QC: technical, safe area, talent, copy, UI shot, launch rollup |
| `services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.util.spec.ts` | Jest for every §9 gate |
| `services/ptt-crm-api/src/webhooks/ptt-fb-lead-form.util.ts` | Instant Form key map + qualific from `raw_field_data` |
| `services/ptt-crm-api/src/webhooks/ptt-fb-lead-form.util.spec.ts` | Jest for field keys and qualific |
| `docs/creative/ptt-fb-lead/character-bible.md` | Locked Advisor prompt + wardrobe |
| `docs/creative/ptt-fb-lead/vo-scripts.md` | VO + caption + primary text per hook |
| `docs/creative/ptt-fb-lead/shot-list.md` | Timecoded EDL + UI capture list |
| `docs/creative/ptt-fb-lead/qc-facts.example.json` | Facts shape editors fill after ffprobe |
| `docs/creative/ptt-fb-lead/launch-brief.md` | Form + Ads Ops names + day-7 rules |
| `scripts/probe_ptt_fb_lead_video.sh` | ffprobe → JSON stub for one MP4 |

Do **not** modify: `cp-qc.service.ts` `QC_CHECK_KEYS`, Video Studio render path, quote/lead-party modules, webhook Graph fetch (only read `raw_field_data`).

---

### Task 1: Pack QC util (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.util.ts`
- Create: `services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.util.spec.ts`

**Interfaces:**
- Consumes: none (pure)
- Produces: `ADVISOR_FACE_ID`, `LEAD_VIDEO_FILES`, `LeadVideoFileFacts`, `evaluateLeadVideoFile()`, `evaluateLeadVideoPack()`, `assertLeadVideoLaunchable()`

- [ ] **Step 1: Write the failing test**

```typescript
import {
  ADVISOR_FACE_ID,
  LEAD_VIDEO_FILES,
  assertLeadVideoLaunchable,
  evaluateLeadVideoFile,
  evaluateLeadVideoPack,
  type LeadVideoFileFacts,
} from './ptt-fb-lead-video-qc.util';

function base15(hook_id: LeadVideoFileFacts['hook_id'], filename: string): LeadVideoFileFacts {
  return {
    hook_id,
    filename,
    width: 1080,
    height: 1920,
    duration_sec: 15,
    has_audio: true,
    face_sec: 5.5,
    face_id: ADVISOR_FACE_ID,
    founder_claim: false,
    ui_shot: true,
    caption_has_spaces: true,
    caption_top_third: true,
    safe_top_px: 110,
    safe_bottom_px: 280,
    logo_present: true,
    cta_is_form: true,
    cta_is_call_only: false,
    ai_label_on_creative: false,
    fake_cpl_claim: false,
    contains_human: true,
    ai_disclosure: true,
    primary_text: 'Ngan sach chay. Inbox im.',
  };
}

function passingPack(): LeadVideoFileFacts[] {
  return [
    base15('h1', 'ptt-lead-h1-15.mp4'),
    base15('h2', 'ptt-lead-h2-15.mp4'),
    { ...base15('h3', 'ptt-lead-h3-15.mp4'), face_sec: 7, ui_shot: true },
    { ...base15('h1_30', 'ptt-lead-h1-30.mp4'), duration_sec: 30, face_sec: 5.5 },
  ];
}

describe('LEAD_VIDEO_FILES', () => {
  it('locks the four pack filenames and face id', () => {
    expect(ADVISOR_FACE_ID).toBe('ptt-advisor-f-01');
    expect(LEAD_VIDEO_FILES).toEqual([
      { hook_id: 'h1', filename: 'ptt-lead-h1-15.mp4', duration_sec: 15 },
      { hook_id: 'h2', filename: 'ptt-lead-h2-15.mp4', duration_sec: 15 },
      { hook_id: 'h3', filename: 'ptt-lead-h3-15.mp4', duration_sec: 15 },
      { hook_id: 'h1_30', filename: 'ptt-lead-h1-30.mp4', duration_sec: 30 },
    ]);
  });
});

describe('evaluateLeadVideoFile', () => {
  it('passes a legal H1 15s file', () => {
    const report = evaluateLeadVideoFile(base15('h1', 'ptt-lead-h1-15.mp4'));
    expect(report.overall).toBe('passed');
    expect(report.checks.technical.result).toBe('passed');
    expect(report.checks.talent.result).toBe('passed');
  });

  it('blocks wrong resolution or duration outside ±0.2s', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), width: 720 }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'technical_not_9x16_1080' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), duration_sec: 15.5 }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'technical_duration' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), has_audio: false }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'missing_audio' });
  });

  it('blocks H1-30 unless duration is 30±0.2s', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1_30', 'ptt-lead-h1-30.mp4'), duration_sec: 15 }).checks.technical)
      .toEqual({ result: 'blocked', reason: 'technical_duration' });
  });

  it('blocks unsafe caption zone and missing word spaces', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), safe_bottom_px: 200 }).checks.safe_area)
      .toEqual({ result: 'blocked', reason: 'safe_area_violated' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), caption_has_spaces: false }).checks.caption)
      .toEqual({ result: 'blocked', reason: 'caption_no_spaces' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), caption_top_third: false }).checks.caption)
      .toEqual({ result: 'blocked', reason: 'caption_not_top_third' });
  });

  it('blocks talent over 5.5s on 15s, wrong face, or founder claim', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), face_sec: 5.6 }).checks.talent)
      .toEqual({ result: 'blocked', reason: 'face_too_long' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), face_id: 'stock-ceo' }).checks.talent)
      .toEqual({ result: 'blocked', reason: 'face_id_mismatch' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), founder_claim: true }).checks.talent)
      .toEqual({ result: 'blocked', reason: 'founder_claim' });
  });

  it('allows H3 face_sec up to 7s (0-3 plus 11-15) and still requires a mid UI shot', () => {
    const ok = evaluateLeadVideoFile({ ...base15('h3', 'ptt-lead-h3-15.mp4'), face_sec: 7, ui_shot: true });
    expect(ok.checks.talent.result).toBe('passed');
    expect(evaluateLeadVideoFile({ ...base15('h3', 'ptt-lead-h3-15.mp4'), ui_shot: false }).checks.ui)
      .toEqual({ result: 'blocked', reason: 'ui_shot_missing' });
  });

  it('blocks missing UI on H1/H2/H1-30, call-only CTA, AI label, and fake CPL', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), ui_shot: false }).checks.ui)
      .toEqual({ result: 'blocked', reason: 'ui_shot_missing' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), cta_is_call_only: true, cta_is_form: false }).checks.cta)
      .toEqual({ result: 'blocked', reason: 'cta_call_only' });
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), ai_label_on_creative: true }).checks.copy)
      .toEqual({ result: 'blocked', reason: 'ai_label_on_creative' });
    expect(evaluateLeadVideoFile({
      ...base15('h1', 'ptt-lead-h1-15.mp4'),
      primary_text: 'CPL giam 40%',
      fake_cpl_claim: true,
    }).checks.claim).toEqual({ result: 'blocked', reason: 'fake_cpl_claim' });
    expect(evaluateLeadVideoFile({
      ...base15('h1', 'ptt-lead-h1-15.mp4'),
      primary_text: 'Hinh anh AI — de lai SDT',
    }).checks.copy).toEqual({ result: 'blocked', reason: 'ai_label_on_creative' });
  });

  it('blocks when internal flags are missing even though they stay off-canvas', () => {
    expect(evaluateLeadVideoFile({ ...base15('h1', 'ptt-lead-h1-15.mp4'), ai_disclosure: false }).checks.internal)
      .toEqual({ result: 'blocked', reason: 'ai_disclosure_missing' });
  });
});

describe('evaluateLeadVideoPack / assertLeadVideoLaunchable', () => {
  it('passes the four-file pack and allows H1-30 to stay paused', () => {
    const pack = evaluateLeadVideoPack(passingPack());
    expect(pack.overall).toBe('passed');
    expect(() => assertLeadVideoLaunchable(pack, { require_h1_30: false })).not.toThrow();
  });

  it('blocks launch when any 15s file is missing', () => {
    const pack = evaluateLeadVideoPack(passingPack().filter((f) => f.hook_id !== 'h2'));
    expect(pack.files.h2).toEqual({ overall: 'blocked', reason: 'missing_file' });
    expect(pack.overall).toBe('blocked');
    expect(() => assertLeadVideoLaunchable(pack, { require_h1_30: false })).toThrow(
      expect.objectContaining({ error: 'pack_qc_blocked' }),
    );
  });

  it('blocks scale when require_h1_30 and H1-30 is missing or failed', () => {
    const without30 = evaluateLeadVideoPack(passingPack().filter((f) => f.hook_id !== 'h1_30'));
    expect(() => assertLeadVideoLaunchable(without30, { require_h1_30: true })).toThrow(
      expect.objectContaining({ error: 'pack_qc_blocked' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/cp/ptt-fb-lead-video-qc.util.spec.ts --no-coverage`

Expected: FAIL — `Cannot find module './ptt-fb-lead-video-qc.util'`

- [ ] **Step 3: Write minimal implementation**

```typescript
export const ADVISOR_FACE_ID = 'ptt-advisor-f-01';

export const LEAD_VIDEO_FILES = [
  { hook_id: 'h1' as const, filename: 'ptt-lead-h1-15.mp4', duration_sec: 15 },
  { hook_id: 'h2' as const, filename: 'ptt-lead-h2-15.mp4', duration_sec: 15 },
  { hook_id: 'h3' as const, filename: 'ptt-lead-h3-15.mp4', duration_sec: 15 },
  { hook_id: 'h1_30' as const, filename: 'ptt-lead-h1-30.mp4', duration_sec: 30 },
];

export type LeadVideoHookId = (typeof LEAD_VIDEO_FILES)[number]['hook_id'];

export type LeadVideoFileFacts = {
  hook_id: LeadVideoHookId;
  filename: string;
  width: number;
  height: number;
  duration_sec: number;
  has_audio: boolean;
  face_sec: number;
  face_id: string;
  founder_claim: boolean;
  ui_shot: boolean;
  caption_has_spaces: boolean;
  caption_top_third: boolean;
  safe_top_px: number;
  safe_bottom_px: number;
  logo_present: boolean;
  cta_is_form: boolean;
  cta_is_call_only: boolean;
  ai_label_on_creative: boolean;
  fake_cpl_claim: boolean;
  contains_human: boolean;
  ai_disclosure: boolean;
  primary_text: string;
};

export type LeadVideoCheckResult = { result: 'passed' | 'blocked'; reason: string | null };

export type LeadVideoFileReport = {
  overall: 'passed' | 'blocked';
  checks: Record<string, LeadVideoCheckResult>;
};

const AI_LABEL = /h[ìi]nh\s*ảnh\s*ai|hinh\s*anh\s*ai|minh\s*họa\s*bằng\s*ai|minh\s*hoa\s*bang\s*ai/i;

function check(result: 'passed' | 'blocked', reason: string | null = null): LeadVideoCheckResult {
  return { result, reason };
}

function expectedDuration(hookId: LeadVideoHookId): number {
  return hookId === 'h1_30' ? 30 : 15;
}

function maxFaceSec(hookId: LeadVideoHookId): number {
  return hookId === 'h3' ? 7 : 5.5;
}

export function evaluateLeadVideoFile(facts: LeadVideoFileFacts): LeadVideoFileReport {
  const target = expectedDuration(facts.hook_id);
  const technical = !facts.has_audio
    ? check('blocked', 'missing_audio')
    : facts.width !== 1080 || facts.height !== 1920
      ? check('blocked', 'technical_not_9x16_1080')
      : Math.abs(facts.duration_sec - target) > 0.2
        ? check('blocked', 'technical_duration')
        : check('passed');

  const safe_area = facts.safe_top_px >= 110 && facts.safe_bottom_px >= 280 && facts.logo_present
    ? check('passed')
    : check('blocked', 'safe_area_violated');

  const caption = !facts.caption_has_spaces
    ? check('blocked', 'caption_no_spaces')
    : !facts.caption_top_third
      ? check('blocked', 'caption_not_top_third')
      : check('passed');

  const talent = facts.founder_claim
    ? check('blocked', 'founder_claim')
    : facts.face_id !== ADVISOR_FACE_ID
      ? check('blocked', 'face_id_mismatch')
      : facts.face_sec > maxFaceSec(facts.hook_id)
        ? check('blocked', 'face_too_long')
        : check('passed');

  const ui = facts.ui_shot ? check('passed') : check('blocked', 'ui_shot_missing');

  const cta = facts.cta_is_call_only || !facts.cta_is_form
    ? check('blocked', 'cta_call_only')
    : check('passed');

  const labeled = facts.ai_label_on_creative || AI_LABEL.test(facts.primary_text);
  const copy = labeled ? check('blocked', 'ai_label_on_creative') : check('passed');
  const claim = facts.fake_cpl_claim ? check('blocked', 'fake_cpl_claim') : check('passed');
  const internal = facts.contains_human && facts.ai_disclosure
    ? check('passed')
    : check('blocked', 'ai_disclosure_missing');

  const checks = { technical, safe_area, caption, talent, ui, cta, copy, claim, internal };
  const overall = Object.values(checks).some((item) => item.result === 'blocked') ? 'blocked' : 'passed';
  return { overall, checks };
}

export type LeadVideoPackReport = {
  overall: 'passed' | 'blocked';
  files: Record<LeadVideoHookId, LeadVideoFileReport | { overall: 'blocked'; reason: 'missing_file' }>;
};

export function evaluateLeadVideoPack(files: LeadVideoFileFacts[]): LeadVideoPackReport {
  const byHook = new Map(files.map((file) => [file.hook_id, file]));
  const out = {} as LeadVideoPackReport['files'];
  for (const row of LEAD_VIDEO_FILES) {
    const facts = byHook.get(row.hook_id);
    out[row.hook_id] = facts
      ? evaluateLeadVideoFile({ ...facts, filename: row.filename, hook_id: row.hook_id })
      : { overall: 'blocked', reason: 'missing_file' };
  }
  const overall = Object.values(out).some((file) => file.overall === 'blocked') ? 'blocked' : 'passed';
  return { overall, files: out };
}

export function assertLeadVideoLaunchable(
  pack: LeadVideoPackReport,
  opts: { require_h1_30: boolean },
): void {
  const hooks: LeadVideoHookId[] = opts.require_h1_30
    ? ['h1', 'h2', 'h3', 'h1_30']
    : ['h1', 'h2', 'h3'];
  const blocked = hooks.some((hook) => pack.files[hook].overall === 'blocked');
  if (blocked) {
    throw Object.assign(new Error('pack_qc_blocked'), { error: 'pack_qc_blocked' });
  }
}
```

Note on H3 face time: spec §5 says ≤ 5.5s / 15s, and §6.3 uses 0–3 + 11–15 (= 7s). **This plan locks H3 max face at 7s** so the storyboard is legal. H1/H2/H1-30 stay at 5.5s.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `cd services/ptt-crm-api && npx jest src/cp/ptt-fb-lead-video-qc.util.spec.ts --no-coverage`

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.util.ts \
  services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(cp): add PTT Facebook Lead pack QC gates

EOF
)"
```

---

### Task 2: Instant Form keys + qualific (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/webhooks/ptt-fb-lead-form.util.ts`
- Create: `services/ptt-crm-api/src/webhooks/ptt-fb-lead-form.util.spec.ts`

**Interfaces:**
- Consumes: webhook `meta.raw_field_data` (`Record<string, string>`)
- Produces: `PTT_LEAD_FORM_KEYS`, `PTT_LEAD_BUDGET_VALUES`, `PTT_LEAD_CHANNEL_VALUES`, `leadFormQualific()`, `leadFormQualificRate()`

Do **not** change `fetchFacebookLeadFromGraph`. Custom answers already land in `raw_field_data`.

- [ ] **Step 1: Write the failing test**

```typescript
import {
  PTT_LEAD_BUDGET_VALUES,
  PTT_LEAD_CHANNEL_VALUES,
  PTT_LEAD_FORM_KEYS,
  leadFormQualific,
  leadFormQualificRate,
} from './ptt-fb-lead-form.util';

describe('PTT_LEAD_FORM_KEYS', () => {
  it('locks Instant Form keys Ads Manager must use', () => {
    expect(PTT_LEAD_FORM_KEYS).toEqual({
      full_name: 'full_name',
      phone_number: 'phone_number',
      company_name: 'company_name',
      ad_budget_band: 'ad_budget_band',
      ad_channels: 'ad_channels',
    });
    expect(PTT_LEAD_BUDGET_VALUES).toEqual(['<20tr', '20-50', '50-100', '>100']);
    expect(PTT_LEAD_CHANNEL_VALUES).toEqual(['meta', 'tiktok', 'google', 'none']);
  });
});

describe('leadFormQualific', () => {
  it('qualifies when company + budget + channel are present', () => {
    expect(leadFormQualific({
      full_name: 'Lan',
      phone_number: '0900000000',
      company_name: 'PTT Demo',
      ad_budget_band: '20-50',
      ad_channels: 'meta',
    })).toEqual({
      has_company: true,
      has_budget: true,
      has_channel: true,
      qualified: true,
    });
  });

  it('accepts company alias and rejects short company or unknown bands', () => {
    expect(leadFormQualific({ company: 'AB', ad_budget_band: '20-50', ad_channels: 'tiktok' }).qualified).toBe(true);
    expect(leadFormQualific({ company_name: 'A', ad_budget_band: '20-50', ad_channels: 'meta' }).qualified).toBe(false);
    expect(leadFormQualific({ company_name: 'PTT', ad_budget_band: '20–50', ad_channels: 'meta' }).has_budget).toBe(false);
  });
});

describe('leadFormQualificRate', () => {
  it('returns 0 when there are no leads and does not invent 100', () => {
    expect(leadFormQualificRate([])).toEqual({ total: 0, qualified: 0, rate: null });
  });

  it('computes qualified / total for day-7 gate', () => {
    const rows = [
      { company_name: 'A Co', ad_budget_band: '<20tr', ad_channels: 'none' },
      { company_name: 'B Co', ad_budget_band: '50-100', ad_channels: 'google' },
      { company_name: '', ad_budget_band: '20-50', ad_channels: 'meta' },
    ];
    expect(leadFormQualificRate(rows)).toEqual({ total: 3, qualified: 2, rate: 2 / 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/webhooks/ptt-fb-lead-form.util.spec.ts --no-coverage`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
export const PTT_LEAD_FORM_KEYS = {
  full_name: 'full_name',
  phone_number: 'phone_number',
  company_name: 'company_name',
  ad_budget_band: 'ad_budget_band',
  ad_channels: 'ad_channels',
} as const;

export const PTT_LEAD_BUDGET_VALUES = ['<20tr', '20-50', '50-100', '>100'] as const;
export const PTT_LEAD_CHANNEL_VALUES = ['meta', 'tiktok', 'google', 'none'] as const;

export type LeadFormFields = Record<string, string | undefined>;

export type LeadFormQualific = {
  has_company: boolean;
  has_budget: boolean;
  has_channel: boolean;
  qualified: boolean;
};

function read(fields: LeadFormFields, ...keys: string[]): string {
  for (const key of keys) {
    const value = String(fields[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function leadFormQualific(fields: LeadFormFields): LeadFormQualific {
  const company = read(fields, PTT_LEAD_FORM_KEYS.company_name, 'company');
  const budget = read(fields, PTT_LEAD_FORM_KEYS.ad_budget_band);
  const channel = read(fields, PTT_LEAD_FORM_KEYS.ad_channels);
  const has_company = company.length >= 2;
  const has_budget = (PTT_LEAD_BUDGET_VALUES as readonly string[]).includes(budget);
  const has_channel = (PTT_LEAD_CHANNEL_VALUES as readonly string[]).includes(channel);
  return {
    has_company,
    has_budget,
    has_channel,
    qualified: has_company && has_budget && has_channel,
  };
}

export function leadFormQualificRate(rows: LeadFormFields[]): {
  total: number;
  qualified: number;
  rate: number | null;
} {
  const total = rows.length;
  if (total === 0) return { total: 0, qualified: 0, rate: null };
  const qualified = rows.filter((row) => leadFormQualific(row).qualified).length;
  return { total, qualified, rate: qualified / total };
}
```

- [ ] **Step 4: Run tests**

Run: `cd services/ptt-crm-api && npx jest src/webhooks/ptt-fb-lead-form.util.spec.ts src/cp/ptt-fb-lead-video-qc.util.spec.ts --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/webhooks/ptt-fb-lead-form.util.ts \
  services/ptt-crm-api/src/webhooks/ptt-fb-lead-form.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(meta): lock Instant Form keys for PTT Lead audit pack

EOF
)"
```

---

### Task 3: Bible, VO, shot list, facts template

**Files:**
- Create: `docs/creative/ptt-fb-lead/character-bible.md`
- Create: `docs/creative/ptt-fb-lead/vo-scripts.md`
- Create: `docs/creative/ptt-fb-lead/shot-list.md`
- Create: `docs/creative/ptt-fb-lead/qc-facts.example.json`

**Interfaces:**
- Consumes: spec §4–§6, `ADVISOR_FACE_ID`
- Produces: editor-facing copy that Task 4–5 must follow verbatim

- [ ] **Step 1: Write `character-bible.md`**

```markdown
# Character bible — ptt-advisor-f-01

- face_id: `ptt-advisor-f-01`
- Vai: Advisor PTT, không tên, không nhận founder/AM
- Nữ, 32–38, Việt, da sáng trung
- Tóc buộc hoặc ngang vai gọn
- Sơ mi trắng hoặc navy, không blazer studio stock
- Nền tường `#0b2147` hoặc cửa sổ lệch, nông DOF
- Key trái, fill nhẹ, không rim vàng
- 9:16, nhìn ống kính, headroom 12–15%, vai–đầu ~60%
- Giọng: thu người Việt, lipsync; cấm TTS bản chính
- Cùng một seed/face cho H1, H2, H3, H1-30

## Prompt render (dán nguyên)

Vietnamese woman 34 years old, natural skin, no plastic sheen, navy shirt,
hair tied back, looking at camera, vertical 9:16, dark navy wall #0b2147,
soft key from camera-left, shallow depth of field, documentary not cinematic,
no boardroom, no suit jacket, photoreal, still head, subtle blink.

## Cấm

Mặt từ PTT MKT.mp4, răng quá trắng, blink thưa, nhìn lệch lens, chữ Hình ảnh AI.
```

- [ ] **Step 2: Write `vo-scripts.md`** (copy spec §6 exactly)

Use the locked lines:

H1 VO: «Bạn đang trả tiền cho click — không phải cho khách.» / «Creative không đạt QC thì form không ăn.» / «Lead vào CRM trong phút. Không chờ báo cáo thứ Hai.» / «Để lại SĐT. PTT audit CPL và creative — 15 phút.»

H1 primary: `Ngân sách chạy. Inbox im. Để lại SĐT — PTT chỉ chỗ đang thủng.`

H2 VO: «Agency của bạn gửi slide.» / «Bạn cần khách.» / «PTT đo Spend, lead, CPL trên một màn — không Excel cuối tuần.» / «Form lấy đúng người quyết định. Không lấy cho đủ số.» / «Điền form. Audit funnel không lấy phí.»

H2 primary: `Agency gửi slide. Bạn cần khách. PTT đo Spend–lead–CPL trên một màn.`

H3 VO: «Đừng tăng ngân sách nếu lịch tư vấn không tăng.» / «Audit 15 phút. Không pitch 40 slide.»

H3 primary: `Đừng tăng ngân sách nếu lịch không tăng. Audit 15 phút — không 40 slide.`

H1-30 extra VO: «Không cam kết doanh thu trên video. Cam kết quy trình đo được.»

Include a caption table matching spec §6.1–§6.3 (spaced Vietnamese, top third).

- [ ] **Step 3: Write `shot-list.md`**

```markdown
# Shot list

## UI capture (blur tên khách trước khi edit)

1. `https://rs.pttads.vn/crm/creative-os` — QC fail rồi pass (safe zone đỏ).
2. `https://rs.pttads.vn/meta/ads-ops` hoặc `/meta/facebook-ads` — Spend / CPL.
3. `https://rs.pttads.vn/crm/leads/{id}` — lead mới vào, blur `full_name` / company.

Quay 9:16 hoặc crop 1080×1920. Không mock dashboard tiếng Anh.

## H1 15s

| t | A-roll | B-roll |
|---|---|---|
| 0.0–2.5 | Advisor, câu 1 | — |
| 2.5–3.5 | — | Ads Manager spend (blur) |
| 3.5–7.5 | — | QC fail → pass |
| 7.5–11.5 | — | Form → lead CRM |
| 11.5–15 | Advisor CTA | Type `Audit 15 phút — miễn phí.` |

## H2 15s

| t | Shot |
|---|---|
| 0–4 | Type cards `Agency gửi slide.` / `Bạn cần khách.` |
| 4–9 | Ads Ops Spend + CPL |
| 9–12 | Instant Form fields (screenshot form preview) |
| 12–15 | Advisor CTA |

## H3 15s

| t | Shot |
|---|---|
| 0–3 | Advisor |
| 3–11 | QC + CRM |
| 11–15 | Advisor |

## H1-30

0–8 = H1. 8–18 three UI beats. 18–26 objection VO. 26–30 type + logo. SĐT `0900 353 9226` nhỏ, trên 280px đáy.
```

- [ ] **Step 4: Write `qc-facts.example.json`**

```json
{
  "files": [
    {
      "hook_id": "h1",
      "filename": "ptt-lead-h1-15.mp4",
      "width": 1080,
      "height": 1920,
      "duration_sec": 15,
      "has_audio": true,
      "face_sec": 5.5,
      "face_id": "ptt-advisor-f-01",
      "founder_claim": false,
      "ui_shot": true,
      "caption_has_spaces": true,
      "caption_top_third": true,
      "safe_top_px": 110,
      "safe_bottom_px": 280,
      "logo_present": true,
      "cta_is_form": true,
      "cta_is_call_only": false,
      "ai_label_on_creative": false,
      "fake_cpl_claim": false,
      "contains_human": true,
      "ai_disclosure": true,
      "primary_text": "Ngân sách chạy. Inbox im. Để lại SĐT — PTT chỉ chỗ đang thủng."
    }
  ]
}
```

- [ ] **Step 5: Commit**

```bash
git add docs/creative/ptt-fb-lead
git commit -m "$(cat <<'EOF'
docs(creative): lock PTT Lead bible, VO, and shot list

EOF
)"
```

---

### Task 4: Probe script

**Files:**
- Create: `scripts/probe_ptt_fb_lead_video.sh`

**Interfaces:**
- Consumes: one MP4 path
- Produces: stdout JSON with `width`, `height`, `duration_sec`, `has_audio`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail
file="${1:?usage: probe_ptt_fb_lead_video.sh /path/to.mp4}"
if [[ ! -f "$file" ]]; then
  echo "missing_file" >&2
  exit 1
fi
width="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$file")"
height="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$file")"
duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file")"
audio_streams="$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$file" | wc -l | tr -d ' ')"
python3 - "$file" "$width" "$height" "$duration" "$audio_streams" <<'PY'
import json, sys
path, width, height, duration, audio = sys.argv[1:6]
print(json.dumps({
  "filename": path.split("/")[-1],
  "width": int(width),
  "height": int(height),
  "duration_sec": round(float(duration), 3),
  "has_audio": int(audio) > 0,
}, ensure_ascii=False))
PY
```

- [ ] **Step 2: Make executable and smoke-test the usage path**

Run: `chmod +x scripts/probe_ptt_fb_lead_video.sh && scripts/probe_ptt_fb_lead_video.sh`

Expected: exit 1, stderr starts with `usage:`

- [ ] **Step 3: Commit**

```bash
git add scripts/probe_ptt_fb_lead_video.sh
git commit -m "$(cat <<'EOF'
chore(scripts): probe 9:16 Lead pack files with ffprobe

EOF
)"
```

---

### Task 5: Produce talent, VO, UI (ops — no Nest change)

**Files:**
- Create locally (not git): `~/Movies/ptt-fb-lead/vo/*.wav`, `talent/*.mp4`, `ui/*.mp4`
- Do not commit binaries or client-identifiable screen recordings

**Interfaces:**
- Consumes: Task 3 bible + VO
- Produces: raw A-roll / B-roll used in Task 6

- [ ] **Step 1: Thu VO**

Record four WAV 48 kHz mono, one take per hook, mic not TTS. Filenames: `vo-h1.wav`, `vo-h2.wav`, `vo-h3.wav`, `vo-h1-30.wav`. Peak ≤ −3 dB.

- [ ] **Step 2: Render Advisor**

One face seed. Takes needed: H1 hook, H1 CTA, H2 CTA, H3 hook, H3 CTA (five clips). Reject if lipsync lệch > 2 frames or blink/teeth fail bible.

- [ ] **Step 3: Screen-record UI**

Login `https://rs.pttads.vn`. Capture the three shots in `shot-list.md`. Blur names in Premiere/CapCut **before** any review share.

- [ ] **Step 4: Gate before edit**

Checklist (all must be true): same face, navy/white shirt, no boardroom, no `PTT MKT.mp4` frames, VO is human, UI is `rs.pttads.vn`.

---

### Task 6: Edit and export four MP4s

**Files (local deliverables):**
- `~/Movies/ptt-fb-lead/out/ptt-lead-h1-15.mp4`
- `~/Movies/ptt-fb-lead/out/ptt-lead-h2-15.mp4`
- `~/Movies/ptt-fb-lead/out/ptt-lead-h3-15.mp4`
- `~/Movies/ptt-fb-lead/out/ptt-lead-h1-30.mp4`

**Interfaces:**
- Consumes: Task 5 media + Task 3 EDL
- Produces: four files named exactly `LEAD_VIDEO_FILES`

- [ ] **Step 1: Timeline**

Follow `shot-list.md`. Logo PT, Brand Kit, top-right, ≥ 110px from top. Captions Be Vietnam Pro / Inter, white + black stroke, spaces between words, top third. Music ducked −12 dB under VO. No `Hình ảnh AI`.

- [ ] **Step 2: Export**

```bash
# Repeat per hook; set -t 15 or 30
ffmpeg -y -i timeline.mov \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -r 30 -s 1080x1920 -b:v 12M -maxrate 16M -bufsize 24M \
  -c:a aac -b:a 160k -ac 2 -ar 48000 \
  -movflags +faststart -t 15 \
  ~/Movies/ptt-fb-lead/out/ptt-lead-h1-15.mp4
```

H1-30 uses `-t 30`. File size must be ≤ 30 MB (`ls -l`).

- [ ] **Step 3: Probe**

```bash
for f in ptt-lead-h1-15.mp4 ptt-lead-h2-15.mp4 ptt-lead-h3-15.mp4 ptt-lead-h1-30.mp4; do
  scripts/probe_ptt_fb_lead_video.sh "$HOME/Movies/ptt-fb-lead/out/$f"
done
```

Expected: each JSON `width=1080`, `height=1920`, `has_audio=true`, duration 15±0.2 or 30±0.2.

---

### Task 7: Fill facts and run pack QC

**Files:**
- Create locally: `~/Movies/ptt-fb-lead/out/qc-facts.json` (do not commit if it references local paths)

**Interfaces:**
- Consumes: `evaluateLeadVideoPack`, probe JSON, human measures (`face_sec`, safe px)
- Produces: `overall: passed` before ingest

- [ ] **Step 1: Copy example → facts**

Copy `docs/creative/ptt-fb-lead/qc-facts.example.json` to `qc-facts.json`. Fill four objects. Set `face_sec` from the timeline (H1/H2 ≤ 5.5, H3 ≤ 7). Set `ui_shot` true only if the `rs.pttads.vn` shot is in the file.

- [ ] **Step 2: Evaluate facts through Jest (no extra runner)**

Create: `services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts`

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLeadVideoLaunchable, evaluateLeadVideoPack, type LeadVideoFileFacts } from './ptt-fb-lead-video-qc.util';

const factsPath = process.env.PTT_LEAD_QC_FACTS
  ?? resolve(process.cwd(), '../../docs/creative/ptt-fb-lead/qc-facts.example.json');

describe('optional pack facts', () => {
  it('example fixture is launchable without H1-30 required', () => {
    if (!existsSync(factsPath)) return;
    const parsed = JSON.parse(readFileSync(factsPath, 'utf8')) as { files: LeadVideoFileFacts[] };
    const pack = evaluateLeadVideoPack(parsed.files);
    if (factsPath.endsWith('qc-facts.example.json')) {
      expect(pack.files.h1.overall).toBe('passed');
      return;
    }
    expect(pack.files.h1.overall).toBe('passed');
    expect(pack.files.h2.overall).toBe('passed');
    expect(pack.files.h3.overall).toBe('passed');
    assertLeadVideoLaunchable(pack, { require_h1_30: false });
  });
});
```

Run example: `cd services/ptt-crm-api && npx jest src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts --no-coverage`

Run real pack: `PTT_LEAD_QC_FACTS=$HOME/Movies/ptt-fb-lead/out/qc-facts.json cd services/ptt-crm-api && npx jest src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts --no-coverage`

Expected (real pack): PASS. If FAIL, re-edit — do not ingest.

- [ ] **Step 3: Commit the optional spec + example (not the local movies)**

```bash
git add services/ptt-crm-api/src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts \
  docs/creative/ptt-fb-lead/qc-facts.example.json
git commit -m "$(cat <<'EOF'
test(cp): evaluate optional PTT Lead pack facts JSON

EOF
)"
```

---

### Task 8: Ingest Creative OS + Brand Kit + CP QC

**Files:** none in git. Ops on `https://rs.pttads.vn`.

**Interfaces:**
- Consumes: four passed MP4s, house `agency_client_id` (PTT Ads self-account in AM 360)
- Produces: four `crm_cp_assets` in state ready, project named `PTT FB Lead 2026-09`

- [ ] **Step 1: Project**

Open `/crm/creative-os`. Create project `PTT FB Lead 2026-09`, khách = PTT house client (combobox, not raw UUID). Deliverable type video.

- [ ] **Step 2: Brand Kit**

`/crm/creative-os/brand-kits` — confirm logo PT + palette `#07152e` / `#2a6cff` / `#ff715d`. Attach kit on the project.

- [ ] **Step 3: Ingest**

`/crm/creative-os/media?tab=ingest`

For each file: MIME `video/mp4`, filename **exactly** `ptt-lead-h1-15.mp4` (and the other three). Tick rights: AI talent (no model-release of a real person), territory VN, channels Meta.

- [ ] **Step 4: Quality tab**

`/crm/creative-os/media?tab=quality` — run CP technical QC (the ten SRS keys). Provide facts: 1080×1920, duration, `has_audio=true`, `safe_area_ok=true`, `caption_overflow=false`, `logo_present=true`, `cta_present=true`, `disclaimer_present=true` (disclaimer = offer text, **not** an AI label), `loudness_lufs` between −16 and −12, `black_frozen=false`, `moderation=ok`.

Export/final only if CP `qc_status` is not `blocked`. Pack util from Task 7 is the campaign gate; CP QC is the module gate. Both must be non-blocked.

- [ ] **Step 5: Metadata**

On each version snapshot / comment: `contains_human=true`, `ai_disclosure=true`, `face_id=ptt-advisor-f-01`. Do not put those strings in the picture.

---

### Task 9: Instant Form + thank-you

**Files:**
- Create: `docs/creative/ptt-fb-lead/launch-brief.md`

**Interfaces:**
- Consumes: `PTT_LEAD_FORM_KEYS` / budget / channel values
- Produces: one Meta Instant Form id stored in the brief

- [ ] **Step 1: Write `launch-brief.md`**

```markdown
# Launch brief — PTT FB Lead audit

## Instant Form

- Name: `PTT Audit CPL 2026-09`
- Headline: `Nhận audit CPL + creative — 15 phút`
- Privacy: on
- Thank-you: `AM PTT liên hệ trong giờ hành chính.`
- CTA on ad: `Đăng ký` or `Tìm hiểu thêm` (never `Gọi ngay`)
- Optimization: Lead / Instant Form. Phone on video is not the event.

### Fields (key = Graph name)

| Key | Type | Required | Values |
|---|---|---|---|
| full_name | short | yes | |
| phone_number | phone | yes | |
| company_name | short | yes | |
| ad_budget_band | dropdown | yes | `<20tr` · `20-50` · `50-100` · `>100` |
| ad_channels | dropdown | yes | `meta` · `tiktok` · `google` · `none` |

Labels VI on the form; **keys must match the table** (no `20–50` en-dash).

## Ads

Campaign: `PTT \| Lead \| Audit15 \| 2026-09`
Template: `re_lead_default`
Ad sets (60/25/15): `AS \| H1 pain`, `AS \| H2 agency`, `AS \| H3 face`
Ads: `AD \| H1 15`, `AD \| H2 15`, `AD \| H3 15`
H1-30 ad set **paused**: `AS \| H1 30 scale`
Primary texts: vo-scripts.md
```

- [ ] **Step 2: Create the form in Ads Manager**

Page = PTT Ads page already mapped on the house client. Copy form id into `launch-brief.md` as `form_id: <id>`.

- [ ] **Step 3: Confirm webhook**

Submit a test lead from the form preview. On `/crm/leads` a new row appears with `source` facebook and `meta.raw_field_data` containing the five keys. If `fetch: pending_token`, fix page token **before** spend.

- [ ] **Step 4: Commit the brief (form id after create)**

```bash
git add docs/creative/ptt-fb-lead/launch-brief.md
git commit -m "$(cat <<'EOF'
docs(ads): add PTT Lead Instant Form and launch names

EOF
)"
```

---

### Task 10: Creative Hub approve + Ads Ops launch

**Files:** none. UI: `/crm/creatives`, `/meta/ads-ops`, `/crm/campaign-writes`.

**Interfaces:**
- Consumes: `MetaAdsOpsLaunchBody` (`client_id`, `external_account_id`, `template_id: re_lead_default`, `creative_submission_id`, daily budget)
- Produces: three write requests, H1-30 not submitted

Preconditions (guide `05-meta-ads.md`): `PTT_META_ADS_OPS_ENABLED`, cap `meta_ads_ops.launch`, Launch QA passed for the house lifecycle, creative **approved**.

- [ ] **Step 1: Submit four files (or three 15s) to Creative Hub**

`/crm/creatives` — title `PTT Lead H1 15` / `H2` / `H3`. Status → approved. Ads Ops `fetchApprovedCreative` rejects `not_approved`.

- [ ] **Step 2: Preflight**

`/meta/ads-ops` → house `client_id` → load preflight. If not ready, fix items or only continue with `preflight_ack` if PO signed.

- [ ] **Step 3: Launch H1**

Wizard fields:

- `template_id`: `re_lead_default`
- `campaign_name`: `PTT | Lead | Audit15 | 2026-09`
- `adset_name`: `AS | H1 pain`
- `ad_name`: `AD | H1 15`
- `daily_budget_vnd`: start **300000** (60% of a 500000 test; adjust H2=125000, H3=75000 so the three sum 500000)
- Instant Form = `PTT Audit CPL 2026-09`
- Placement: Reels + FB/IG feed. Advantage+ ok. Audience: VN, 25–55, interests marketing/SME — **do not** retarget existing customers in wave 1.

Submit. Track `/crm/campaign-writes` until worker creates the campaign.

- [ ] **Step 4: Launch H2 and H3**

Same campaign if the worker supports adding ad sets; otherwise two more launches with the **same** `campaign_name` only if Ads Ops creates separate campaigns — then name `PTT | Lead | Audit15 | 2026-09 | H2` and `... | H3` so Hub mapping stays obvious. Prefer **one campaign / three ad sets**. If the launch API only creates a campaign+one ad set per submit, run it three times and map all three on `/meta/facebook-ads`.

- [ ] **Step 5: Do not launch H1-30**

Keep file ingested and QC passed. Ad set stays paused / unsubmitted until Task 12.

- [ ] **Step 6: Ads Manager copy check**

CTA ≠ Gọi ngay. Primary text has no AI label. Form attached. Destination = Instant Form.

---

### Task 11: Day-0 closed loop

**Files:** none.

- [ ] **Step 1: Test lead**

Submit the real form once (your phone). Confirm `/crm/leads/[id]` has phone + `raw_field_data.company_name`.

- [ ] **Step 2: Qualific smoke**

```typescript
import { leadFormQualific } from './ptt-fb-lead-form.util';
// paste raw_field_data from the lead
expect(leadFormQualific(raw).qualified).toBe(true);
```

Or in Node REPL after copying fields. If `ad_budget_band` is `20–50` (en-dash), **fix the form values** before spend — the util rejects that.

- [ ] **Step 3: Hub**

`/meta/facebook-ads` — map the new campaign(s) to the house client. CAPI: `/meta/tracking` no growing `pending` for this page.

- [ ] **Step 4: Fail closed**

If webhook test lead is missing after 10 minutes: pause ads, do not scale.

---

### Task 12: Day-7 kill / scale

**Files:** update `docs/creative/ptt-fb-lead/launch-brief.md` with the decision table filled.

**Interfaces:**
- Consumes: Hub T-1 metrics + `leadFormQualificRate`
- Produces: pause/kill/scale actions

- [ ] **Step 1: Pull metrics**

From `/meta/facebook-ads` for the three ad sets: spend, leads CRM, CPL, 3s view / hook rate.

From DB or lead export, run qualific:

```typescript
leadFormQualificRate(leads.map((l) => (l.meta?.raw_field_data ?? {}) as Record<string, string>));
```

Gate: `rate === null` (0 leads) → do not scale. `rate < 0.7` → fix form, do not scale H1-30.

- [ ] **Step 2: Apply spec §10**

| Rule | Action |
|---|---|
| H3 hook rate < H1 and H2 by > 30% relative | Pause H3 first |
| H1 CPL Instant Form ≤ old call-only baseline (or best of the three) | Keep H1 |
| H1 hook rate wins and qualific ≥ 70% | Launch paused `AS \| H1 30 scale` with `assertLeadVideoLaunchable(pack, { require_h1_30: true })` |
| Any ad disapproved for AI person | Recut / shorten face; **do not** burn `Hình ảnh AI` unless PO says policy now requires it on-creative |

- [ ] **Step 3: Commit the filled decision**

```bash
git add docs/creative/ptt-fb-lead/launch-brief.md
git commit -m "$(cat <<'EOF'
docs(ads): record day-7 PTT Lead pack kill/scale

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| §1–§3 problem / positioning / claims ban | Task 3 copy + Task 6 edit + QC `founder_claim` / `fake_cpl_claim` |
| §4 visual system | Task 3–6 |
| §5 talent bible, no on-screen AI label, internal flags | Task 3, 5, 7, 8 |
| §6 scripts H1/H2/H3/H1-30 | Task 3, 6 |
| §7 Instant Form + existing webhook | Task 2, 9, 11 |
| §8 pack files + Ads Ops | Task 6, 10 |
| §9 CP + pack QC | Task 1, 7, 8 |
| §10 7-day gates | Task 12 |
| §11 wave order | Task 5→12 |
| §12 lipsync / staging UI / no auto AI label | Task 5, 6, 12 |
| H3 0–3 + 11–15 face | Task 1 locks 7s max for `h3` only |

## Out of this plan

- Regenerating AI stock in CP Video Studio
- Changing `QC_CHECK_KEYS`
- New webhook tables
- Promote Lead → AM 360
- Publishing case-study % on video
- Committing MP4 binaries
