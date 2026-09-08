import { readFileSync } from 'fs';
import { join } from 'path';
import { QuoteApprovalService } from './quote-approval.service';
import { DEFAULT_PTT_SETTINGS } from './quote-settings.service';

const VID = '19d722af-0000-4000-8000-000000000022';
const ACTOR = { staffId: 7, staffAuthVia: 'jwt' as const };

class ApprovalMemory {
  sqls: string[] = [];
  versions = new Map<string, Record<string, unknown>>([
    [
      VID,
      {
        id: VID,
        proposal_id: 9,
        n: 1,
        state: 'working',
        snapshot_json: {},
        fee_vnd: 100_000_000,
        media_vnd: 0,
        discount_vnd: 0,
        tax_vnd: 8_000_000,
        payable_vnd: 108_000_000,
        nsr_vnd: 100_000_000,
        direct_cost_vnd: 77_600_000,
        gm_bps: 2240,
        created_by: 7,
      },
    ],
  ]);
  proposals = new Map<number, Record<string, unknown>>([
    [9, { id: 9, status: 'draft', current_version_id: VID, quote_code: 'QT-PTT-2026-000022' }],
  ]);
  settings: Record<string, unknown> = { ...DEFAULT_PTT_SETTINGS };
  lines: Record<string, unknown>[] = [
    {
      id: 1,
      proposal_id: 9,
      version_id: VID,
      final_price_vnd: 100_000_000,
      discount_vnd: 0,
      unit_price_vnd: 100_000_000,
      item_type: 'fee',
      sku_code: 'DV01-TC',
      cost_labor_vnd: 77_600_000,
      cost_outsource_vnd: null,
      cost_other_vnd: null,
    },
  ];
  clauses: Record<string, unknown>[] = [];
  approvals: Record<string, unknown>[] = [];
  steps: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  nextApproval = 1;
  nextStep = 1;

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO clients/i.test(sql)) {
      throw new Error('must_not_insert_clients');
    }
    if (/DELETE FROM crm_proposals/i.test(sql)) {
      throw new Error('must_not_hard_delete_proposals');
    }
    if (/FROM crm_quote_settings/i.test(sql)) {
      return { rows: [this.settings] };
    }
    if (/FROM crm_proposals/i.test(sql)) {
      const id = Number(params[0] ?? 0);
      const row = this.proposals.get(id);
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      const id = String(params[0] ?? '');
      const row = this.versions.get(id);
      return { rows: row ? [row] : [] };
    }
    if (/UPDATE crm_quote_versions/i.test(sql)) {
      const id = String(params[params.length - 1] ?? params[0] ?? '');
      const row = this.versions.get(id);
      if (!row) return { rows: [] };
      if (/state\s*=/i.test(sql)) {
        row.state = params[0];
      }
      return { rows: [row] };
    }
    if (/UPDATE crm_proposals/i.test(sql)) {
      const id = Number(params[params.length - 1] ?? params[0]);
      const row = this.proposals.get(id);
      if (!row) return { rows: [] };
      if (/status\s*=/i.test(sql)) {
        row.status = params[0];
      }
      return { rows: [row] };
    }
    if (/FROM crm_quote_line_item/i.test(sql)) {
      const proposalId = Number(params[0] ?? 0);
      return { rows: this.lines.filter((line) => Number(line.proposal_id) === proposalId) };
    }
    if (/FROM crm_quote_clauses/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.clauses.filter((c) => String(c.version_id) === vid) };
    }
    if (/INSERT INTO crm_quote_approvals/i.test(sql)) {
      const row = {
        id: `apr-${this.nextApproval++}`,
        version_id: params[0],
        policy_snapshot: params[1],
        created_at: new Date().toISOString(),
      };
      this.approvals.push(row);
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_approval_steps/i.test(sql)) {
      const row = {
        id: `step-${this.nextStep++}`,
        approval_id: params[0],
        seq: params[1],
        section: params[2],
        state: params[3],
        assignee_staff_id: params[4] ?? null,
        sla_hours: params[5] ?? null,
        acted_at: null,
        comment: params[6] ?? null,
        delegate_from: params[7] ?? null,
      };
      this.steps.push(row);
      return { rows: [row] };
    }
    if (/JOIN crm_quote_approvals/i.test(sql) && /crm_quote_approval_steps/i.test(sql)) {
      const staff = /p\.owner_staff_id = \$/i.test(sql)
        ? params.find((p) => typeof p === 'number' && p > 0)
        : undefined;
      const rows: Record<string, unknown>[] = [];
      for (const step of this.steps) {
        const approval = this.approvals.find((a) => String(a.id) === String(step.approval_id));
        if (!approval) continue;
        const version = this.versions.get(String(approval.version_id));
        if (!version) continue;
        const proposal = this.proposals.get(Number(version.proposal_id));
        if (!proposal) continue;
        if (staff != null && Number(proposal.owner_staff_id) !== Number(staff)) continue;
        rows.push({
          ...step,
          version_id: approval.version_id,
          policy_snapshot: approval.policy_snapshot,
          approval_created_at: approval.created_at,
          version_n: version.n,
          nsr_vnd: version.nsr_vnd,
          direct_cost_vnd: version.direct_cost_vnd,
          gm_bps: version.gm_bps,
          proposal_id: version.proposal_id,
          quote_code: proposal.quote_code,
          owner_staff_id: proposal.owner_staff_id,
          status: proposal.status,
          client_name: proposal.client_name,
          owner_name: proposal.owner_name,
        });
      }
      return { rows };
    }
    if (/FROM crm_quote_approval_steps/i.test(sql) && /WHERE\s+id::text/i.test(sql)) {
      const sid = String(params[0] ?? '');
      const row = this.steps.find((s) => String(s.id) === sid);
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_quote_approval_steps/i.test(sql)) {
      const approvalId = String(params[0] ?? '');
      return {
        rows: this.steps
          .filter((s) => String(s.approval_id) === approvalId)
          .sort((a, b) => Number(a.seq) - Number(b.seq)),
      };
    }
    if (/FROM crm_quote_approvals/i.test(sql)) {
      const key = String(params[0] ?? '');
      const row =
        this.approvals.find((a) => String(a.id) === key) ||
        this.approvals.find((a) => String(a.version_id) === key);
      return { rows: row ? [row] : [] };
    }
    if (/UPDATE crm_quote_approval_steps/i.test(sql)) {
      const sid = String(params[params.length - 1] ?? '');
      const row = this.steps.find((s) => String(s.id) === sid);
      if (!row) return { rows: [] };
      if (/state\s*=/i.test(sql) && /acted_at/i.test(sql)) {
        row.state = params[0];
        row.comment = params[1];
        row.acted_at = params[2] ?? new Date().toISOString();
      } else if (/assignee_staff_id/i.test(sql)) {
        row.assignee_staff_id = params[0];
        row.delegate_from = params[1];
        row.comment = params[2];
        if (params[3] != null) (row as { until?: unknown }).until = params[3];
      } else if (/state\s*=/i.test(sql)) {
        row.state = params[0];
      }
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        proposal_id: params[1],
        version_id: params[2],
        action: params[5],
        snapshot_json: params[7],
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

function load(db = new ApprovalMemory()) {
  return { db, svc: new QuoteApprovalService(db) };
}

describe('QuoteApprovalService AC-03 / comments / BR-QT-006', () => {
  it('AC-03: GM 2240 bps / floor 2500 submit-approval creates Finance + GDKD; cannot publish before done', async () => {
    const { db, svc } = load();

    const out = await svc.submitApproval(VID, ACTOR);

    const sections = out.steps.map((s) => s.section);
    expect(sections).toEqual(expect.arrayContaining(['Finance', 'GDKD']));
    expect(out.steps.filter((s) => ['Finance', 'GDKD'].includes(s.section))).toHaveLength(2);
    expect(out.steps.find((s) => s.section === 'Finance')?.state).toBe('waiting');
    expect(out.steps.find((s) => s.section === 'GDKD')?.state).toBe('locked');
    expect(db.versions.get(VID)?.state).toBe('submitted');
    expect(db.proposals.get(9)?.status).toBe('pending_approval');

    await expect(svc.assertPublishable(VID)).rejects.toMatchObject({
      response: { error: 'approval_incomplete' },
    });

    const finance = out.steps.find((s) => s.section === 'Finance')!;
    await svc.actOnStep(finance.id, { action: 'approve' }, ACTOR);
    await expect(svc.assertPublishable(VID)).rejects.toMatchObject({
      response: { error: 'approval_incomplete' },
    });

    const gdkd = out.steps.find((s) => s.section === 'GDKD')!;
    await svc.actOnStep(gdkd.id, { action: 'approve' }, ACTOR);
    await expect(svc.assertPublishable(VID)).resolves.toBeUndefined();
  });

  it('return/reject without comment → 400 comment_required', async () => {
    const { svc } = load();
    const out = await svc.submitApproval(VID, ACTOR);
    const sid = out.steps[0].id;

    await expect(svc.actOnStep(sid, { action: 'return' }, ACTOR)).rejects.toMatchObject({
      response: { error: 'comment_required' },
    });
    await expect(svc.actOnStep(sid, { action: 'reject', comment: '   ' }, ACTOR)).rejects.toMatchObject({
      response: { error: 'comment_required' },
    });
  });

  it('reject without lost_reason → 400', async () => {
    const { svc } = load();
    const out = await svc.submitApproval(VID, ACTOR);
    const sid = out.steps[0].id;

    await expect(
      svc.actOnStep(sid, { action: 'reject', comment: 'lost the deal' }, ACTOR),
    ).rejects.toMatchObject({
      response: { error: 'lost_reason_required' },
    });
  });

  it('BR-QT-006: extra zero-price line does not bypass discount/GM policy', async () => {
    const { db, svc } = load();
    const version = db.versions.get(VID)!;
    version.discount_vnd = 8_000_000;
    version.payable_vnd = 99_360_000;
    version.gm_bps = 2240;
    db.lines.push({
      id: 2,
      proposal_id: 9,
      version_id: VID,
      final_price_vnd: 0,
      discount_vnd: 0,
      unit_price_vnd: 0,
      item_type: 'fee',
      sku_code: 'DUMMY-0',
      cost_labor_vnd: null,
      cost_outsource_vnd: null,
      cost_other_vnd: null,
    });

    const out = await svc.submitApproval(VID, ACTOR);
    const snapshot = out.approval.policy_snapshot as Record<string, unknown>;
    expect(snapshot.discount_bps).toBe(800);
    expect(snapshot.gm_bps).toBe(2240);
    expect(snapshot.fee_vnd).toBe(100_000_000);
    expect(out.steps.map((s) => s.section)).toEqual(
      expect.arrayContaining(['Finance', 'GDKD', 'AM Lead', 'AD']),
    );
  });

  it('internal key may submit with staffId 0', async () => {
    const { svc } = load();
    const out = await svc.submitApproval(VID, { staffId: 0, staffAuthVia: 'internal' });
    expect(out.steps.length).toBeGreaterThan(0);
  });

  it('reject and return keep assertPublishable failing', async () => {
    const rejectCase = load();
    rejectCase.db.versions.get(VID)!.gm_bps = 2500;
    const rejected = await rejectCase.svc.submitApproval(VID, ACTOR);
    expect(rejected.steps).toHaveLength(1);
    await rejectCase.svc.actOnStep(
      rejected.steps[0].id,
      { action: 'reject', comment: 'margin story does not hold', lost_reason: 'budget' },
      ACTOR,
    );
    expect(rejectCase.db.proposals.get(9)?.status).toBe('rejected');
    await expect(rejectCase.svc.assertPublishable(VID)).rejects.toMatchObject({
      response: { error: 'approval_incomplete' },
    });

    const returnCase = load();
    returnCase.db.versions.get(VID)!.gm_bps = 2500;
    const returned = await returnCase.svc.submitApproval(VID, ACTOR);
    await returnCase.svc.actOnStep(
      returned.steps[0].id,
      { action: 'return', comment: 'please add cost card' },
      ACTOR,
    );
    expect(returnCase.db.proposals.get(9)?.status).toBe('returned');
    await expect(returnCase.svc.assertPublishable(VID)).rejects.toMatchObject({
      response: { error: 'approval_incomplete' },
    });
  });

  it('refuses submit when gm_bps is null or the plan is empty', async () => {
    const { db, svc } = load();
    db.versions.get(VID)!.gm_bps = null;

    await expect(svc.submitApproval(VID, ACTOR)).rejects.toMatchObject({
      response: { error: 'gm_required' },
    });
    expect(db.approvals).toHaveLength(0);
  });

  it('acting on a locked step is 400', async () => {
    const { svc } = load();
    const out = await svc.submitApproval(VID, ACTOR);
    const locked = out.steps.find((s) => s.state === 'locked')!;
    expect(locked.section).toBe('GDKD');

    await expect(svc.actOnStep(locked.id, { action: 'approve' }, ACTOR)).rejects.toMatchObject({
      response: { error: 'step_locked' },
    });
    await expect(
      svc.actOnStep(locked.id, { action: 'return', comment: 'too early' }, ACTOR),
    ).rejects.toMatchObject({ response: { error: 'step_locked' } });
    await expect(
      svc.actOnStep(locked.id, { action: 'reject', comment: 'too early', lost_reason: 'budget' }, ACTOR),
    ).rejects.toMatchObject({ response: { error: 'step_locked' } });
  });

  it('second approve of a done step does not re-approve', async () => {
    const { db, svc } = load();
    db.versions.get(VID)!.gm_bps = 2500;
    const out = await svc.submitApproval(VID, ACTOR);
    await svc.actOnStep(out.steps[0].id, { action: 'approve' }, ACTOR);
    expect(db.proposals.get(9)?.status).toBe('approved');
    db.proposals.get(9)!.status = 'pending_approval';
    db.versions.get(VID)!.state = 'submitted';
    await expect(svc.actOnStep(out.steps[0].id, { action: 'approve' }, ACTOR)).rejects.toMatchObject({
      response: { error: 'step_not_waiting' },
    });
    expect(db.proposals.get(9)?.status).toBe('pending_approval');
    expect(db.versions.get(VID)?.state).toBe('submitted');
  });

  it('delegate stores actor + delegate_staff_id + until + reason', async () => {
    const { db, svc } = load();
    const out = await svc.submitApproval(VID, ACTOR);
    const sid = out.steps[0].id;
    const acted = await svc.actOnStep(
      sid,
      {
        action: 'delegate',
        comment: 'on leave',
        delegate_staff_id: 44,
        until: '2026-09-15T00:00:00.000Z',
      },
      ACTOR,
    );
    expect(acted.step.delegate_from).toBe(7);
    expect(acted.step.assignee_staff_id).toBe(44);
    expect(acted.step.comment).toBe('on leave');
    expect(acted.step.until).toBe('2026-09-15T00:00:00.000Z');
    expect(db.steps[0].delegate_from).toBe(7);
    expect(db.steps[0].assignee_staff_id).toBe(44);
  });
});

describe('approval HTTP wiring', () => {
  it('wires submit-approval on quote-versions and step actions under /api/crm', () => {
    const versions = readFileSync(join(__dirname, 'quote-versions.controller.ts'), 'utf8');
    const steps = readFileSync(join(__dirname, 'quote-approval-steps.controller.ts'), 'utf8');
    const mod = readFileSync(join(__dirname, 'proposals.module.ts'), 'utf8');
    expect(versions).toMatch(/@Post\(':vid\/submit-approval'\)/);
    expect(versions).toMatch(/StaffProposalsWriteGuard|StaffQuoteGuard/);
    expect(steps).toMatch(/@Controller\('api\/crm\/quote-approval-steps'\)/);
    expect(steps).toMatch(/@Post\(':sid\/actions'\)/);
    expect(steps).toMatch(/RequireQuoteSection\('crm_quote\.approve',\s*'execute'\)/);
    expect(steps).toMatch(/StaffQuoteGuard/);
    expect(steps).not.toMatch(/\/api\/quotes/);
    expect(mod).toMatch(/QuoteApprovalService/);
    expect(mod).toMatch(/QuoteApprovalStepsController/);
  });

  it('GET /api/crm/proposals/approvals is static before :id and uses view', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    const approvalsAt = src.search(/@Get\('approvals'\)/);
    const idAt = src.search(/@Get\(':id'\)/);
    expect(approvalsAt).toBeGreaterThan(-1);
    expect(idAt).toBeGreaterThan(-1);
    expect(approvalsAt).toBeLessThan(idAt);
    expect(src).toMatch(/@Get\('approvals'\)[\s\S]{0,400}RequireQuoteAction\('view'\)/);
    expect(src).toMatch(/listInbox|listApprovals/);
    expect(src).not.toMatch(/\/api\/quotes/);
  });
});

describe('QuoteApprovalService inbox', () => {
  const INBOX = {
    scope: 'me' as const,
    staffId: 7,
    teamIds: [] as number[],
    hasFinance: true,
    canApprove: true,
  };

  it('lists waiting/locked steps for current staff and hides other owners on scope=me', async () => {
    const { db, svc } = load();
    db.proposals.get(9)!.owner_staff_id = 7;
    db.proposals.get(9)!.client_name = 'An Phát';
    db.proposals.get(9)!.owner_name = 'Minh';
    await svc.submitApproval(VID, ACTOR);

    const otherVid = '19d722af-0000-4000-8000-000000000099';
    db.versions.set(otherVid, {
      ...db.versions.get(VID)!,
      id: otherVid,
      proposal_id: 88,
      gm_bps: 2240,
      state: 'working',
    });
    db.proposals.set(88, {
      id: 88,
      status: 'draft',
      current_version_id: otherVid,
      quote_code: 'QT-PTT-2026-000099',
      owner_staff_id: 99,
      client_name: 'Other Co',
      owner_name: 'Other',
    });
    await svc.submitApproval(otherVid, { staffId: 99, staffAuthVia: 'jwt' });

    const out = await svc.listInbox(INBOX);
    expect(out.items.every((row) => row.owner.staff_id === 7)).toBe(true);
    expect(out.items.some((row) => row.quote_code === 'QT-PTT-2026-000099')).toBe(false);
    expect(out.items.some((row) => row.state === 'waiting')).toBe(true);
    expect(out.items.some((row) => row.state === 'locked')).toBe(true);
    expect(out.items[0]?.steps?.length).toBeGreaterThan(1);
    expect(out.has_finance).toBe(true);
    expect(out.can_approve).toBe(true);
  });

  it('chip=done returns acted steps; chip=sla returns breached waiting/locked', async () => {
    const { db, svc } = load();
    db.proposals.get(9)!.owner_staff_id = 7;
    const submitted = await svc.submitApproval(VID, ACTOR);
    await svc.actOnStep(submitted.steps[0].id, { action: 'approve' }, ACTOR);
    db.approvals[0].created_at = '2026-09-01T00:00:00.000Z';

    const done = await svc.listInbox({ ...INBOX, chip: 'done' });
    expect(done.items.some((row) => row.state === 'done')).toBe(true);
    expect(done.items.every((row) => row.state === 'done' || row.state === 'skipped')).toBe(true);

    const sla = await svc.listInbox(
      { ...INBOX, chip: 'sla' },
      new Date('2026-09-08T12:00:00.000Z'),
    );
    expect(sla.items.length).toBeGreaterThan(0);
    expect(sla.items.every((row) => row.sla_breached)).toBe(true);
    expect(sla.items.every((row) => row.state === 'waiting' || row.state === 'locked')).toBe(true);
  });

  it('strips NSR / cost / GM without crm_quote.finance', async () => {
    const { db, svc } = load();
    db.proposals.get(9)!.owner_staff_id = 7;
    await svc.submitApproval(VID, ACTOR);

    const out = await svc.listInbox({ ...INBOX, hasFinance: false });
    expect(out.has_finance).toBe(false);
    expect(out.items.length).toBeGreaterThan(0);
    for (const row of out.items) {
      expect(row.snapshot.nsr_vnd).toBeNull();
      expect(row.snapshot.direct_cost_vnd).toBeNull();
      expect(row.snapshot.gp_vnd).toBeNull();
      expect(row.snapshot.gm_bps).toBeNull();
    }
    expect(JSON.stringify(out)).not.toMatch(/100000000|77600000/);
  });
});
