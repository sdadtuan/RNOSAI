# Lead Detail Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/crm/leads/{id}` into an AM-first workspace: one Next Best Action, one journey stepper, SCI inline, GDKD rail — no new APIs.

**Architecture:** Pure resolvers (`resolveLeadNextAction`, `resolveLeadJourney`) drive two new cards. Page fetches existing meeting-prep + funnel, stops rendering dual steppers and the main-column AI score card, moves the activity form above the timeline.

**Tech Stack:** Next.js 14 ops-web, React client components, Vitest, Bitrix overlay CSS (`html.ops-shell-bitrix`).

**Spec:** [`docs/superpowers/specs/2026-08-28-lead-detail-workspace-design.md`](../specs/2026-08-28-lead-detail-workspace-design.md)

## Global Constraints

- No new REST endpoints; reuse `fetchLeadMeetingPrep`, `fetchLeadFunnel`, existing B2 / prep callbacks.
- No new CSS file; overlay only in `services/ops-web/src/app/bitrix-theme.css` under `html.ops-shell-bitrix`.
- Brand CTA `#17692f` / hover `#114d24`. One primary PTT button per chrome frame.
- Hero always shows **Gọi ngay** when phone exists. Rule 5 card primary is **Copy script**, not a second green Gọi.
- Status 「Chờ dọn」 stays in DB; it must not become NBA `title_vi`.
- Do not `next build` on the VPS.
- Do not change Deal Room, Intake routes, CSKH board, or `LeadConsultWorkspace` internals.
- Lead `spa_operational`: no B2B NBA rules 5–8; keep CSKH banner.

## File map

| File | Role |
|------|------|
| Create `services/ops-web/src/lib/crm/lead-next-action.ts` | Pure NBA rules 1–10 |
| Create `services/ops-web/src/lib/crm/lead-next-action.spec.ts` | NBA unit tests |
| Create `services/ops-web/src/lib/crm/lead-journey.ts` | Pure 6-step journey |
| Create `services/ops-web/src/lib/crm/lead-journey.spec.ts` | Journey unit tests |
| Create `services/ops-web/src/components/crm/LeadNextActionCard.tsx` | NBA card UI |
| Create `services/ops-web/src/components/crm/LeadJourneyStepper.tsx` | One stepper UI |
| Modify `services/ops-web/src/lib/crm/lead-property-rows.ts` | Drop phone/email from rail |
| Modify `services/ops-web/src/lib/crm/lead-property-rows.spec.ts` | Expect no phone/email keys |
| Modify `services/ops-web/src/components/crm/LeadDetailHero.tsx` | NBA title + Gọi + Cockpit |
| Modify `services/ops-web/src/app/crm/leads/[id]/page.tsx` | Wire NBA, fetch prep, hide old bars, move form |
| Modify `services/ops-web/src/app/bitrix-theme.css` | NBA + journey overlay |
| Modify `docs/huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md` | Point AM to NBA on lead detail |

---

### Task 1: NBA resolver (rules 1–10)

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-next-action.ts`
- Test: `services/ops-web/src/lib/crm/lead-next-action.spec.ts`

**Interfaces:**
- Consumes: funnel `care_pipeline.all_complete`, `presales.presales.stage`; prep `status`, `prep_stage`, `debrief_pending`; lead `phone`, `email`, `status`.
- Produces: `resolveLeadNextAction(input: LeadNextActionInput): LeadNextAction`

- [ ] **Step 1: Write the failing tests**

Create `services/ops-web/src/lib/crm/lead-next-action.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveLeadNextAction } from './lead-next-action';

const base = {
  lmpEnabled: true,
  dealRoomEnabled: true,
  phone: '09014238',
  email: 'in@khangthinhland.com',
  leadStatus: 'pending',
  b2Complete: false,
  presalesStage: null as string | null,
  prepStatus: null as string | null,
  prepStage: null as string | null,
  debriefPending: false,
};

describe('resolveLeadNextAction', () => {
  it('lead #5 fixture → rule 5 Gọi đầu', () => {
    const out = resolveLeadNextAction(base);
    expect(out.rule).toBe(5);
    expect(out.title_vi).toBe('Gọi đầu trong 15 phút');
    expect(out.primary.action).toBe('copy_script');
    expect(out.secondary.map((s) => s.action)).toEqual(['complete_b2']);
  });

  it('missing contact → rule 1', () => {
    const out = resolveLeadNextAction({ ...base, phone: '', email: '' });
    expect(out.rule).toBe(1);
    expect(out.primary.action).toBe('edit_contact');
  });

  it('awaiting_am_input beats first-call', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'awaiting_am_input' });
    expect(out.rule).toBe(2);
    expect(out.primary.action).toBe('save_company_run_prep');
  });

  it('awaiting_entity_choice → rule 3', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'awaiting_entity_choice' });
    expect(out.rule).toBe(3);
  });

  it('prep running beats rule 5', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'running' });
    expect(out.rule).toBe(4);
    expect(out.primary.action).toBe('wait_prep');
  });

  it('B2 done, stage lead → rule 6 Intake', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'lead',
      prepStatus: 'ready',
    });
    expect(out.rule).toBe(6);
    expect(out.primary.action).toBe('open_intake');
  });

  it('Intake Go (consult) → rule 7', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      prepStatus: 'ready',
    });
    expect(out.rule).toBe(7);
    expect(out.primary.action).toBe('open_consult');
  });

  it('proposal + deal room → rule 8', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      prepStatus: 'ready',
      prepStage: 'm2_qualify_win',
    });
    expect(out.rule).toBe(8);
    expect(out.primary.action).toBe('open_deal_room');
  });

  it('prep_stage m3 also triggers rule 8', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      prepStage: 'm3_pre_close',
      prepStatus: 'ready',
    });
    expect(out.rule).toBe(8);
  });

  it('chot + debrief_pending → rule 9', () => {
    const out = resolveLeadNextAction({
      ...base,
      leadStatus: 'chot',
      b2Complete: true,
      debriefPending: true,
    });
    expect(out.rule).toBe(9);
    expect(out.primary.action).toBe('submit_debrief');
  });

  it('LMP off skips rules 2–4 and copy_script', () => {
    const out = resolveLeadNextAction({ ...base, lmpEnabled: false, prepStatus: 'running' });
    expect(out.rule).toBe(5);
    expect(out.primary.action).toBe('add_activity');
  });

  it('fallback rule 10 when B2 done and no later stage', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'done_unknown',
      lmpEnabled: false,
    });
    expect(out.rule).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts
```

Expected: FAIL — `Cannot find module './lead-next-action'` or export missing.

- [ ] **Step 3: Implement resolver**

Create `services/ops-web/src/lib/crm/lead-next-action.ts`:

```ts
export type NextActionKind =
  | 'edit_contact'
  | 'save_company_run_prep'
  | 'select_entity'
  | 'wait_prep'
  | 'open_cockpit'
  | 'call_now'
  | 'copy_script'
  | 'complete_b2'
  | 'open_intake'
  | 'copy_m2_brief'
  | 'open_consult'
  | 'open_deal_room'
  | 'apply_offer_ladder'
  | 'submit_debrief'
  | 'add_activity';

export type LeadNextAction = {
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  title_vi: string;
  body_vi: string;
  primary: { label_vi: string; action: NextActionKind };
  secondary: Array<{ label_vi: string; action: NextActionKind }>;
};

export type LeadNextActionInput = {
  lmpEnabled: boolean;
  dealRoomEnabled: boolean;
  phone: string;
  email: string;
  leadStatus: string;
  b2Complete: boolean;
  presalesStage: string | null;
  prepStatus: string | null;
  prepStage: string | null;
  debriefPending: boolean;
};

function hasContact(input: LeadNextActionInput): boolean {
  return Boolean(input.phone.trim() || input.email.trim());
}

function terminal(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'chot' || s === 'lost';
}

export function resolveLeadNextAction(input: LeadNextActionInput): LeadNextAction {
  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const prep = (input.prepStatus ?? '').trim().toLowerCase();
  const prepStage = (input.prepStage ?? '').trim().toLowerCase();

  if (!hasContact(input)) {
    return {
      rule: 1,
      title_vi: 'Bổ sung SĐT hoặc email',
      body_vi: 'Không có contact — không gọi và không chạy Discover được.',
      primary: { label_vi: 'Bổ sung contact', action: 'edit_contact' },
      secondary: [],
    };
  }

  if (input.lmpEnabled && prep === 'awaiting_am_input') {
    return {
      rule: 2,
      title_vi: 'Nhập tên công ty để chạy prep',
      body_vi: 'AI chưa đủ pháp nhân. Lưu tên công ty (website tuỳ chọn) rồi chạy prep.',
      primary: { label_vi: 'Lưu lên lead & chạy prep', action: 'save_company_run_prep' },
      secondary: [],
    };
  }

  if (input.lmpEnabled && prep === 'awaiting_entity_choice') {
    return {
      rule: 3,
      title_vi: 'Chọn đúng pháp nhân',
      body_vi: 'Nhiều doanh nghiệp khớp SĐT/email — chọn một rồi tiếp tục SCI.',
      primary: { label_vi: 'Xác nhận & tiếp tục', action: 'select_entity' },
      secondary: [],
    };
  }

  if (input.lmpEnabled && (prep === 'pending' || prep === 'running')) {
    return {
      rule: 4,
      title_vi: 'Đang chuẩn bị SCI',
      body_vi: 'Chờ Discover / research xong. Không dùng script giả.',
      primary: { label_vi: 'Đang chạy…', action: 'wait_prep' },
      secondary: [{ label_vi: 'Xem tiến trình', action: 'open_cockpit' }],
    };
  }

  if (input.debriefPending && terminal(input.leadStatus)) {
    return {
      rule: 9,
      title_vi: 'Học từ cuộc chốt',
      body_vi: 'Lead đã Chốt/Lost — gửi debrief để win loop học objection.',
      primary: { label_vi: 'Gửi debrief', action: 'submit_debrief' },
      secondary: [],
    };
  }

  const m3 =
    input.dealRoomEnabled &&
    input.b2Complete &&
    (prepStage === 'm3_pre_close' || stage === 'proposal');
  if (m3) {
    return {
      rule: 8,
      title_vi: 'Chuẩn bị buổi chốt',
      body_vi: 'Mở Deal Room — narrative, 3 gói, close ask.',
      primary: { label_vi: 'Mở Deal Room', action: 'open_deal_room' },
      secondary:
        prep === 'ready'
          ? [{ label_vi: 'Tạo báo giá 3 gói', action: 'apply_offer_ladder' }]
          : [],
    };
  }

  if (input.b2Complete && stage === 'consult') {
    return {
      rule: 7,
      title_vi: 'Handoff Solution',
      body_vi: 'Intake đã Go. Đẩy brief sang Tư vấn / Solution.',
      primary: { label_vi: 'Mở Tư vấn', action: 'open_consult' },
      secondary: [{ label_vi: 'Copy brief M2', action: 'copy_m2_brief' }],
    };
  }

  if (input.b2Complete && (stage === 'lead' || stage === '')) {
    return {
      rule: 6,
      title_vi: 'Qualify BANT',
      body_vi: 'B2 xong — làm Intake Go trước khi handoff.',
      primary: { label_vi: 'Mở Intake', action: 'open_intake' },
      secondary:
        prep === 'ready' ? [{ label_vi: 'Copy brief M2', action: 'copy_m2_brief' }] : [],
    };
  }

  if (!input.b2Complete && input.phone.trim()) {
    return {
      rule: 5,
      title_vi: 'Gọi đầu trong 15 phút',
      body_vi: 'Hero đã có Gọi ngay. Copy script rồi gọi; sau cuộc gọi hoàn thành B2.',
      primary: input.lmpEnabled
        ? { label_vi: 'Copy script', action: 'copy_script' }
        : { label_vi: 'Thêm hoạt động', action: 'add_activity' },
      secondary: [{ label_vi: 'Hoàn thành B2', action: 'complete_b2' }],
    };
  }

  return {
    rule: 10,
    title_vi: 'Xem SCI hoặc nhật ký',
    body_vi: 'Không còn việc bắt buộc trên funnel.',
    primary: input.lmpEnabled
      ? { label_vi: 'Mở Sales Cockpit', action: 'open_cockpit' }
      : { label_vi: 'Thêm hoạt động', action: 'add_activity' },
    secondary: [{ label_vi: 'Thêm hoạt động', action: 'add_activity' }],
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts
```

Expected: all tests PASS. If rule 10 fixture fails, change `presalesStage: 'done_unknown'` path: after B2 + unknown stage, code falls through to rule 5 only if `!b2Complete`; with `b2Complete` and unknown stage it hits rule 10. Good.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-next-action.ts services/ops-web/src/lib/crm/lead-next-action.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add lead next-action resolver for workspace NBA

EOF
)"
```

---

### Task 2: Journey resolver (one stepper)

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-journey.ts`
- Test: `services/ops-web/src/lib/crm/lead-journey.spec.ts`

**Interfaces:**
- Consumes: same funnel + contract flags as `LeadB2bSalesFlowBar.resolveStepStates`.
- Produces: `resolveLeadJourney(input): LeadJourneyStep[]` with keys `b2 | presales | intake | consult | proposal | contract`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveLeadJourney } from './lead-journey';

describe('resolveLeadJourney', () => {
  it('lead #5 — B2 current, rest pending', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: false,
      presalesStage: null,
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.map((s) => s.key)).toEqual([
      'b2',
      'presales',
      'intake',
      'consult',
      'proposal',
      'contract',
    ]);
    expect(steps[0]).toMatchObject({ key: 'b2', state: 'current', label_vi: 'B2 Liên hệ' });
    expect(steps.slice(1).every((s) => s.state === 'pending')).toBe(true);
  });

  it('B2 done + stage lead → intake current', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'lead',
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'b2')?.state).toBe('done');
    expect(steps.find((s) => s.key === 'intake')?.state).toBe('current');
  });

  it('review queue blocks all', () => {
    const steps = resolveLeadJourney({
      reviewActive: true,
      b2Complete: false,
      presalesStage: null,
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.every((s) => s.state === 'blocked')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-journey.spec.ts
```

- [ ] **Step 3: Implement**

Create `services/ops-web/src/lib/crm/lead-journey.ts`:

```ts
export type JourneyState = 'done' | 'current' | 'pending' | 'blocked';

export type LeadJourneyStep = {
  key: 'b2' | 'presales' | 'intake' | 'consult' | 'proposal' | 'contract';
  label_vi: string;
  short_vi: string;
  state: JourneyState;
  href?: string;
  anchor?: string;
};

export type LeadJourneyInput = {
  reviewActive: boolean;
  b2Complete: boolean;
  presalesStage: string | null;
  hasContract: boolean;
  contractActive: boolean;
  lifecycleId: number | null;
  leadId?: number;
  serviceSlug?: string | null;
};

const LABELS: Record<LeadJourneyStep['key'], { label_vi: string; short_vi: string }> = {
  b2: { label_vi: 'B2 Liên hệ', short_vi: 'B2' },
  presales: { label_vi: 'Pre-sales', short_vi: 'Pre' },
  intake: { label_vi: 'Intake BANT', short_vi: 'Intake' },
  consult: { label_vi: 'Tư vấn', short_vi: 'TV' },
  proposal: { label_vi: 'Báo giá', short_vi: 'BG' },
  contract: { label_vi: 'HĐ / Agency', short_vi: 'HĐ' },
};

export function resolveLeadJourney(input: LeadJourneyInput): LeadJourneyStep[] {
  const keys: LeadJourneyStep['key'][] = [
    'b2',
    'presales',
    'intake',
    'consult',
    'proposal',
    'contract',
  ];
  if (input.reviewActive) {
    return keys.map((key) => ({ key, ...LABELS[key], state: 'blocked' as const }));
  }

  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const started = Boolean(stage);
  const order = ['lead', 'consult', 'proposal'];
  const idx = order.indexOf(stage);

  const state: Record<LeadJourneyStep['key'], JourneyState> = {
    b2: input.b2Complete ? 'done' : 'current',
    presales: !input.b2Complete ? 'pending' : !started ? 'current' : idx >= 0 ? 'done' : 'pending',
    intake: !input.b2Complete
      ? 'pending'
      : !started || stage === 'lead'
        ? 'current'
        : 'done',
    consult: stage === 'consult' ? 'current' : idx >= 1 ? 'done' : 'pending',
    proposal: stage === 'proposal' ? 'current' : idx >= 2 ? 'done' : 'pending',
    contract:
      stage === 'proposal'
        ? input.contractActive
          ? 'done'
          : input.hasContract
            ? 'current'
            : 'current'
        : 'pending',
  };

  const leadId = input.leadId;
  const slug = input.serviceSlug?.trim();
  const intakeHref =
    leadId != null
      ? `/crm/intake?lead_id=${leadId}${slug ? `&service_slug=${encodeURIComponent(slug)}` : ''}`
      : undefined;

  return keys.map((key) => ({
    key,
    ...LABELS[key],
    state: state[key],
    anchor:
      key === 'b2' ? '#funnel-b2' : key === 'presales' ? '#funnel-presales' : key === 'contract' ? '#lead-contract' : undefined,
    href:
      key === 'intake'
        ? intakeHref
        : key === 'consult'
          ? undefined
          : key === 'proposal'
            ? leadId != null
              ? `/crm/leads/${leadId}/deal-room`
              : undefined
            : key === 'contract' && input.lifecycleId
              ? `/crm/service-delivery/${input.lifecycleId}`
              : undefined,
  }));
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-journey.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-journey.ts services/ops-web/src/lib/crm/lead-journey.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add single B2B journey resolver for lead detail

EOF
)"
```

---

### Task 3: Rail — drop duplicate contact

**Files:**
- Modify: `services/ops-web/src/lib/crm/lead-property-rows.ts`
- Modify: `services/ops-web/src/lib/crm/lead-property-rows.spec.ts`

**Interfaces:**
- Produces: `leadPropertyRows` no longer emits `phone` or `email` keys. Band stays.

- [ ] **Step 1: Update tests first**

In `lead-property-rows.spec.ts`, change the expected keys to:

```ts
expect(rows.map((r) => r.key)).toEqual([
  'source',
  'channel',
  'project',
  'owner',
  'created',
  'band',
]);
```

Remove the empty-phone assertion `rows.find((r) => r.key === 'phone')`. Keep owner/band assertions.

- [ ] **Step 2: Run — expect FAIL** (phone/email still present)

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-property-rows.spec.ts
```

- [ ] **Step 3: Remove phone/email rows** from the array in `leadPropertyRows` (keep source, channel, project, owner, created, band).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-property-rows.ts services/ops-web/src/lib/crm/lead-property-rows.spec.ts
git commit -m "$(cat <<'EOF'
fix(crm): stop repeating phone and email on the lead property rail

EOF
)"
```

---

### Task 4: `LeadNextActionCard`

**Files:**
- Create: `services/ops-web/src/components/crm/LeadNextActionCard.tsx`
- Reuse: `LeadMeetingPrepProgress`, `LeadMeetingPrepEntityPicker`, AM form fields from `LeadMeetingPrepPanel` (copy the small form JSX — do not import the whole panel).
- Reuse: `buildM1Script` from `app/crm/leads/meeting-prep/m1-script.util.ts`

**Interfaces:**
- Consumes: `LeadNextAction` from Task 1; optional `LeadMeetingPrepResponse`; callbacks map `Record<NextActionKind, () => void>`.
- Produces: card with `data-testid="lead-next-action"` and `data-rule={action.rule}`.

- [ ] **Step 1: No component unit test required** (resolver already covered). Manual check list in Task 7.

- [ ] **Step 2: Implement card**

```tsx
'use client';

import { LeadMeetingPrepProgress } from '@/app/crm/leads/meeting-prep/LeadMeetingPrepProgress';
import { LeadMeetingPrepEntityPicker } from '@/app/crm/leads/meeting-prep/LeadMeetingPrepEntityPicker';
import { buildM1Script } from '@/app/crm/leads/meeting-prep/m1-script.util';
import { lmpSkipReasonMessageVi } from '@/app/crm/leads/meeting-prep/lmp-skip-reason-labels';
import type { LeadMeetingPrepResponse } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';
import type { LeadNextAction, NextActionKind } from '@/lib/crm/lead-next-action';

type Props = {
  action: LeadNextAction;
  prep?: LeadMeetingPrepResponse | null;
  busy?: boolean;
  companyName: string;
  websiteUrl: string;
  onCompanyName: (v: string) => void;
  onWebsiteUrl: (v: string) => void;
  onAction: (kind: NextActionKind) => void;
};

export function LeadNextActionCard({
  action,
  prep,
  busy,
  companyName,
  websiteUrl,
  onCompanyName,
  onWebsiteUrl,
  onAction,
}: Props) {
  const opening =
    action.rule === 5 && prep?.status === 'ready' ? buildM1Script(prep).opening.slice(0, 280) : '';

  return (
    <section className="lead-nba" data-testid="lead-next-action" data-rule={action.rule}>
      <p className="lead-nba__kicker">Việc tiếp theo</p>
      <h2 className="lead-nba__title">{action.title_vi}</h2>
      <p className="lead-nba__body">{action.body_vi}</p>
      {action.rule === 4 && prep ? (
        <LeadMeetingPrepProgress
          status={prep.status}
          stepsCompleted={prep.progress?.steps_completed}
          message={prep.discover_message_vi || prep.progress?.message_vi}
        />
      ) : null}
      {opening ? <blockquote className="lead-nba__script">{opening}</blockquote> : null}
      {action.rule === 2 ? (
        <div className="lead-nba__form">
          <p>{lmpSkipReasonMessageVi(prep?.skip_reason ?? 'missing_company_name')}</p>
          <label>
            Tên công ty *
            <input value={companyName} onChange={(e) => onCompanyName(e.target.value)} required />
          </label>
          <label>
            Website (tuỳ chọn)
            <input value={websiteUrl} onChange={(e) => onWebsiteUrl(e.target.value)} />
          </label>
        </div>
      ) : null}
      {action.rule === 3 && prep?.entity_candidates?.length ? (
        <LeadMeetingPrepEntityPicker
          candidates={prep.entity_candidates}
          busy={busy}
          onSelect={() => onAction('select_entity')}
          discoverMode
        />
      ) : null}
      {action.rule !== 3 ? (
        <div className="lead-nba__actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || action.primary.action === 'wait_prep' || (action.rule === 2 && !companyName.trim())}
            onClick={() => onAction(action.primary.action)}
          >
            {action.primary.label_vi}
          </button>
          {action.secondary.map((s) => (
            <button
              key={s.action}
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => onAction(s.action)}
            >
              {s.label_vi}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

Note: entity picker has its own confirm button — `onSelect` currently receives `entityId`. Change the card so `onSelect={(id) => onAction('select_entity')}` is wrong. **Use:** add optional `onPickEntity?: (id: string) => void` on the card and call that from the picker. Page stores `selectedEntityId` from picker.

Correct picker wiring:

```tsx
onSelect={(entityId) => onPickEntity(entityId)}
```

Add prop `onPickEntity: (entityId: string) => void`.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/components/crm/LeadNextActionCard.tsx
git commit -m "$(cat <<'EOF'
feat(crm): add lead next-action card with inline SCI and Discover

EOF
)"
```

---

### Task 5: `LeadJourneyStepper`

**Files:**
- Create: `services/ops-web/src/components/crm/LeadJourneyStepper.tsx`

**Interfaces:**
- Consumes: `resolveLeadJourney` + `leadId` / funnel / contract.
- Produces: `<nav aria-label="Hành trình B2B">` — **replaces** `LeadB2bSalesFlowBar` + `LeadPresalesFunnelStepper` on overview.

- [ ] **Step 1: Implement**

```tsx
'use client';

import Link from 'next/link';
import type { LeadFunnelSnapshot } from '@/lib/api';
import type { LeadContractFlowSummary } from '@/components/LeadB2bSalesFlowBar';
import { resolveLeadJourney } from '@/lib/crm/lead-journey';

type Props = {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  contract?: LeadContractFlowSummary | null;
  onOpenConsult?: () => void;
};

export function LeadJourneyStepper({ leadId, funnel, contract, onOpenConsult }: Props) {
  const steps = resolveLeadJourney({
    reviewActive: Boolean(funnel?.review_queue.active),
    b2Complete: Boolean(funnel?.care_pipeline.all_complete),
    presalesStage: funnel?.presales?.presales.stage ?? null,
    hasContract: Boolean(contract?.hasContract || contract?.pendingApproval),
    contractActive: contract?.contractStatus === 'active',
    lifecycleId: contract?.lifecycleId ?? null,
    leadId,
    serviceSlug: funnel?.presales?.presales.service_slug ?? null,
  });

  return (
    <nav aria-label="Hành trình B2B" className="lead-journey" data-testid="lead-journey">
      <div className="lead-journey__head">
        <h3 className="lead-journey__title">Hành trình</h3>
        <p className="lead-journey__desc">B2 → Pre-sales → Intake → Tư vấn → Báo giá → HĐ</p>
      </div>
      <ol className="lead-journey__track">
        {steps.map((step, idx) => {
          const inner = (
            <>
              <span className="lead-journey__dot" aria-hidden>
                {step.state === 'done' ? '✓' : idx + 1}
              </span>
              <span className="lead-journey__label">{step.label_vi}</span>
            </>
          );
          return (
            <li key={step.key} className={`lead-journey__step lead-journey__step--${step.state}`}>
              {step.key === 'consult' && onOpenConsult ? (
                <button type="button" className="lead-journey__link" onClick={onOpenConsult}>
                  {inner}
                </button>
              ) : step.href ? (
                <Link href={step.href} className="lead-journey__link">
                  {inner}
                </Link>
              ) : step.anchor ? (
                <a href={step.anchor} className="lead-journey__link">
                  {inner}
                </a>
              ) : (
                <span className="lead-journey__link">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
      {funnel?.review_queue.active ? (
        <p className="lead-journey__alert">
          Lead đang phải tra soát.{' '}
          <Link href="/crm/leads/review-queue">Mở inbox</Link>
        </p>
      ) : null}
    </nav>
  );
}
```

Reuse visual language from `.lead-b2b-flow` in CSS (Task 7) — class names `lead-journey*` so we do not fight old dual bars.

- [ ] **Step 2: Commit**

```bash
git add services/ops-web/src/components/crm/LeadJourneyStepper.tsx
git commit -m "$(cat <<'EOF'
feat(crm): add single journey stepper for B2B lead detail

EOF
)"
```

---

### Task 6: Hero — NBA title + Gọi + Cockpit

**Files:**
- Modify: `services/ops-web/src/components/crm/LeadDetailHero.tsx`
- Reuse: `LeadContactActions` (Gọi ngay + consent) — place in hero actions, **remove duplicate** from rail `contact` prop on page (Task 7).

**Interfaces:**
- Add optional props:

```ts
nbaTitle?: string | null;
showCockpit?: boolean;
onOpenCockpit?: () => void;
contactActions?: React.ReactNode;
```

- [ ] **Step 1: Extend hero**

After the status badge, if `nbaTitle` render:

```tsx
<span className="lead-detail-hero__nba">{nbaTitle}</span>
```

Add `lead-detail-hero__actions` with `{contactActions}` and if `showCockpit`:

```tsx
<button type="button" className="btn btn-sm btn-secondary" onClick={onOpenCockpit}>
  Sales Cockpit
</button>
```

Cockpit is **secondary** (ghost/secondary), never a second primary green next to Gọi.

- [ ] **Step 2: Commit**

```bash
git add services/ops-web/src/components/crm/LeadDetailHero.tsx
git commit -m "$(cat <<'EOF'
feat(crm): surface next-action title and call CTAs on lead hero

EOF
)"
```

---

### Task 7: Assemble page + CSS + hide old chrome

**Files:**
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx`
- Modify: `services/ops-web/src/app/bitrix-theme.css`
- Modify: `docs/huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md` (2 sentences: NBA is the first block)

**Interfaces:**
- Consumes: Tasks 1–6.
- Page fetches prep when `showLmpTab && accessToken` via `fetchLeadMeetingPrep`.
- Stops rendering `LeadB2bSalesFlowBar`, `LeadPresalesFunnelStepper`, and `B2bIntelligencePanel` on B2B overview.
- Renders `LeadJourneyStepper` + `LeadNextActionCard` at top of `showOverviewMain`.
- Moves the 「Thêm hoạt động」 `<div className="lead-panel lead-panel--action">` to the **start** of the timeline `<aside>`.
- Rail `contact={undefined}` (hero owns Gọi).
- Mobile tab labels: `Chi tiết` → `Việc`, `Hoạt động` → `Nhật ký`.
- Deal Room banner: only if `funnelSnap?.care_pipeline.all_complete` (not on lead #5).
- `hideM1Card` stays true when LMP on.

**onAction switch** (page):

| action | behavior |
|--------|----------|
| `edit_contact` | `document.getElementById('lead-contact-actions')` or scroll hero |
| `save_company_run_prep` | `runLeadMeetingPrep(token, leadId, { company_name, website_url })` then reload prep |
| `select_entity` | `selectLeadMeetingPrepEntity(token, leadId, entityId)` |
| `wait_prep` | no-op |
| `open_cockpit` | `openMeetingPrepTab()` |
| `copy_script` | clipboard `buildM1Script(prep).fullTalkTrack` or opening |
| `complete_b2` | `document.getElementById('funnel-b2')?.scrollIntoView()` |
| `open_intake` | `router.push(\`/crm/intake?lead_id=${leadId}\`)` |
| `copy_m2_brief` | clipboard from existing `buildM2HandoffBrief` if import cheap; else `open_consult` |
| `open_consult` | `openConsultTab()` |
| `open_deal_room` | `router.push(\`/crm/leads/${leadId}/deal-room\`)` |
| `apply_offer_ladder` | `applyLeadMeetingPrepOfferLadder` then message |
| `submit_debrief` | `setTerminalDebriefOpen(true)` |
| `add_activity` | `document.getElementById('lead-activity-form')?.scrollIntoView()` |

Poll prep every 5s while status is `pending` or `running` (same as panel).

- [ ] **Step 1: CSS overlay** at end of `html.ops-shell-bitrix` block in `bitrix-theme.css`:

```css
html.ops-shell-bitrix .lead-nba {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e2da);
  border-radius: 10px;
  padding: 1rem 1.15rem;
  margin: 0.75rem 0 1rem;
}
html.ops-shell-bitrix .lead-nba__kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted, #6b6b6b);
}
html.ops-shell-bitrix .lead-nba__title {
  margin: 0.25rem 0;
  font-size: 1.25rem;
}
html.ops-shell-bitrix .lead-nba__actions .btn-primary {
  background: #17692f;
  border-color: #17692f;
}
html.ops-shell-bitrix .lead-nba__actions .btn-primary:hover {
  background: #114d24;
  border-color: #114d24;
}
html.ops-shell-bitrix .lead-journey {
  margin: 0 0 1rem;
}
html.ops-shell-bitrix .lead-journey__track {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
html.ops-shell-bitrix .lead-journey__step--current .lead-journey__dot {
  background: #17692f;
  color: #fff;
}
html.ops-shell-bitrix .lead-detail-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.65rem;
}
html.ops-shell-bitrix .lead-detail-hero__nba {
  font-size: 0.85rem;
  color: #17692f;
  font-weight: 600;
}
```

Copy `.lead-b2b-flow` spacing if needed so the new stepper does not look unstyled. Do not delete old `.lead-b2b-flow` rules (component may still exist for other pages).

- [ ] **Step 2: Wire `page.tsx`**

Imports to add:

```ts
import { LeadNextActionCard } from '@/components/crm/LeadNextActionCard';
import { LeadJourneyStepper } from '@/components/crm/LeadJourneyStepper';
import { resolveLeadNextAction } from '@/lib/crm/lead-next-action';
import { fetchLeadMeetingPrep, runLeadMeetingPrep, selectLeadMeetingPrepEntity, applyLeadMeetingPrepOfferLadder } from '@/lib/lead-meeting-prep-api';
import { buildM1Script } from '@/app/crm/leads/meeting-prep/m1-script.util';
import { dealRoomEnabled } from '@/lib/crm/deal-room-flags';
```

State: `prep`, `companyName`, `websiteUrl`, `nbaBusy`.

`useMemo` NBA from lead + funnel + prep.

Replace the block that renders `LeadB2bSalesFlowBar` + `B2bIntelligencePanel` + `LeadPresalesFunnelStepper` with:

```tsx
<LeadJourneyStepper
  leadId={leadId}
  funnel={funnelSnap}
  contract={contractSummary}
  onOpenConsult={showConsultTab ? openConsultTab : undefined}
/>
<LeadNextActionCard
  action={nba}
  prep={prep}
  busy={nbaBusy}
  companyName={companyName}
  websiteUrl={websiteUrl}
  onCompanyName={setCompanyName}
  onWebsiteUrl={setWebsiteUrl}
  onPickEntity={(id) => void onNbaSelectEntity(id)}
  onAction={onNbaAction}
/>
```

Keep `LeadFunnelPanel` below (B2 form lives there).

Hero:

```tsx
<LeadDetailHero
  lead={lead}
  ownerLabel={ownerLabel}
  flowKind={leadFlowKind}
  flowLabel={leadFlowKindLabel(leadFlowKind)}
  nbaTitle={showB2bFlow ? nba.title_vi : null}
  showCockpit={showLmpTab}
  onOpenCockpit={openMeetingPrepTab}
  contactActions={
    lead.phone ? (
      <LeadContactActions
        phone={lead.phone}
        leadId={lead.id}
        accessToken={accessToken}
        onCopy={onCopyContact}
      />
    ) : null
  }
/>
```

- [ ] **Step 3: Unit regression**

```bash
cd services/ops-web && npx vitest run src/lib/crm/lead-next-action.spec.ts src/lib/crm/lead-journey.spec.ts src/lib/crm/lead-property-rows.spec.ts
```

Expected: all PASS.

- [ ] **Step 4: Browser check** (local ops-web or prod after deploy)

Open `/crm/leads/5`:

1. Top of main: 「Việc tiếp theo」 / 「Gọi đầu trong 15 phút」.
2. One journey bar, not two.
3. SĐT only in hero, not rail.
4. No Điểm AI 15 card on main.
5. Activity form above timeline.
6. `?prep=1` still opens full cockpit.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/app/crm/leads/[id]/page.tsx services/ops-web/src/app/bitrix-theme.css docs/huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md
git commit -m "$(cat <<'EOF'
feat(crm): assemble AM-first lead workspace with NBA and one journey

EOF
)"
```

---

## Self-review (spec coverage)

| Spec | Task |
|------|------|
| NBA rules 1–10, #5 fixture, running beats 5 | 1 |
| One journey 6 steps | 2, 5, 7 |
| SCI inline rule 4–5 | 4 |
| Hero Gọi + Cockpit; no dual green Gọi | 6, 4 |
| Rail no phone/email; band stays | 3 |
| Activity form above timeline | 7 |
| Hide dual steppers + AI score card | 7 |
| Deal Room banner not on #5 | 7 |
| `?prep=1` preserved | 7 |
| Overlay CSS, no new file | 7 |
| No new API | all |
| spa_operational unchanged | 7 (NBA/journey only if `showB2bFlow`) |

No TBD. Types `LeadNextAction` / `NextActionKind` are consistent across Tasks 1, 4, 7.
