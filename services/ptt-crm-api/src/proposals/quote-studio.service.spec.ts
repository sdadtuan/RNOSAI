import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { QuoteApprovalService } from './quote-approval.service';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuotePublicService } from './quote-public.service';
import { QuoteShareService } from './quote-share.service';
import { ServiceKpiRepository } from '../kpi-hub/service-kpi/service-kpi.repository';
import { QuoteStudioService } from './quote-studio.service';

const VID = '19d722af-0000-4000-8000-000000000024';
const ACTOR = { staffId: 7, staffAuthVia: 'jwt' as const };
const FORBIDDEN_KEYS = ['cost', 'margin', 'gm_bps', 'nsr', 'approval'] as const;
const LEAK_RE =
  /"cost"|"margin"|"gm_bps"|"nsr"|"nsr_vnd"|"direct_cost_vnd"|"approval"|"approvals"|"approval_id"|"Hidden internal"/;

class StudioMemory {
  sqls: string[] = [];
  versions = new Map<string, Record<string, unknown>>();
  proposals = new Map<number, Record<string, unknown>>();
  leads = new Map<number, Record<string, unknown>>();
  payments: Record<string, unknown>[] = [];
  lines: Record<string, unknown>[] = [];
  kpis: Record<string, unknown>[] = [];
  options: Record<string, unknown>[] = [];
  approvals: Record<string, unknown>[] = [];
  steps: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];

  seed(overrides: { studio?: Record<string, unknown> } = {}) {
    const future = new Date(Date.now() + 14 * 86400000).toISOString();
    this.proposals.set(9, {
      id: 9,
      quote_code: 'QT-PTT-2026-000024',
      current_version_id: VID,
      status: 'approved',
      title: 'Growth Proposal Q4/2026',
      objective: 'Lead căn hộ cao cấp',
      audience: 'CFO',
      campaign_period: '2026-Q4',
      valid_until: future.slice(0, 10),
      owner_staff_id: 7,
    });
    this.versions.set(VID, {
      id: VID,
      proposal_id: 9,
      n: 2,
      state: 'approved',
      snapshot_json: {
        cost: 40_000_000,
        margin: 0.224,
        gm_bps: 2240,
        nsr: 100_000_000,
        approval: { status: 'approved' },
        approvals: [{ step: 'Finance' }],
        kpis: [{ label: 'Lead dự kiến', value: '1.000', class: 'projected_result' }],
        studio: {
          sections: {
            '08': { on: true },
            '09': { on: true },
            ...(overrides.studio ?? {}),
          },
        },
      },
      fee_vnd: 100_000_000,
      media_vnd: 20_000_000,
      discount_vnd: 0,
      tax_vnd: 8_000_000,
      payable_vnd: 128_000_000,
      nsr_vnd: 100_000_000,
      direct_cost_vnd: 40_000_000,
      gm_bps: 2240,
      valid_until: future,
      created_by: 7,
    });
    this.payments = [
      { id: 'pay-1', version_id: VID, seq: 1, pct_bps: 5000, amount_vnd: 64_000_000, milestone: 'Kickoff' },
      { id: 'pay-2', version_id: VID, seq: 2, pct_bps: 5000, amount_vnd: 64_000_000, milestone: 'Close' },
    ];
    this.lines = [
      {
        id: 1,
        proposal_id: 9,
        dv_code: 'DV08',
        scope_notes: 'Meta Ads',
        client_visible: true,
        cost_labor_vnd: 12_000_000,
        final_price_vnd: 80_000_000,
      },
      {
        id: 2,
        proposal_id: 9,
        dv_code: 'DV99',
        scope_notes: 'hidden option',
        client_visible: false,
        cost_labor_vnd: 1,
        final_price_vnd: 1,
      },
    ];
    this.kpis = [
      {
        id: 'kpi-1',
        version_id: VID,
        option_key: 'A',
        name: 'Lead dự kiến',
        class: 'projected_result',
        value_text: '1000',
        source: 'Q3 baseline',
        assumption: 'CTR 1.2% giữ nguyên',
      },
    ];
    this.options = [
      {
        id: 'opt-a',
        version_id: VID,
        option_key: 'A',
        name: 'Standard',
        recommended: true,
        client_visible: true,
        payable_vnd: 128_000_000,
      },
      {
        id: 'opt-b',
        version_id: VID,
        option_key: 'B',
        name: 'Hidden internal',
        recommended: false,
        client_visible: false,
        payable_vnd: 80_000_000,
      },
    ];
    this.approvals = [
      { id: 'apr-1', version_id: VID, policy_snapshot: {}, created_at: future },
    ];
    this.steps = [
      {
        id: 'step-1',
        approval_id: 'apr-1',
        seq: 1,
        section: 'Finance',
        state: 'done',
        assignee_staff_id: 7,
        sla_hours: 24,
        acted_at: future,
        comment: null,
        delegate_from: null,
      },
    ];
  }

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/DELETE FROM crm_proposals/i.test(sql)) {
      throw new Error('must_not_hard_delete_proposals');
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      const id = String(params[0] ?? '');
      const row = this.versions.get(id);
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_proposals/i.test(sql)) {
      const id = Number(params[0] ?? 0);
      const row = this.proposals.get(id);
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_leads/i.test(sql)) {
      const lead = this.leads.get(Number(params[0]));
      return { rows: lead ? [lead] : [] };
    }
    if (/FROM crm_quote_approvals/i.test(sql)) {
      const key = String(params[0] ?? '');
      const row =
        this.approvals.find((a) => String(a.id) === key) ||
        this.approvals.find((a) => String(a.version_id) === key);
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
    if (/FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.payments.filter((row) => String(row.version_id) === vid) };
    }
    if (/FROM crm_quote_line_item/i.test(sql)) {
      const pid = Number(params[0]);
      return { rows: this.lines.filter((row) => Number(row.proposal_id) === pid) };
    }
    if (/FROM crm_quote_kpis/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.kpis.filter((row) => String(row.version_id) === vid) };
    }
    if (/FROM crm_quote_options/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return {
        rows: this.options
          .filter((row) => String(row.version_id) === vid)
          .sort((a, b) => String(a.option_key).localeCompare(String(b.option_key))),
      };
    }
    if (/UPDATE crm_quote_versions/i.test(sql)) {
      const id = String(params[params.length - 1] ?? params[0] ?? '');
      const row = this.versions.get(id);
      if (!row) return { rows: [] };
      if (/snapshot_json/i.test(sql)) {
        row.snapshot_json = params[0];
      }
      if (/party_json/i.test(sql)) {
        row.party_json = params[0];
      }
      if (/state\s*=/i.test(sql)) row.state = params[0];
      return { rows: [row] };
    }
    if (/UPDATE crm_proposals/i.test(sql)) {
      const id = Number(params[params.length - 1] ?? params[0]);
      const row = this.proposals.get(id);
      if (!row) return { rows: [] };
      if (/status\s*=/i.test(sql)) row.status = params[0];
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        proposal_id: params[1],
        version_id: params[2],
        actor_staff_id: params[3],
        actor_kind: params[4],
        action: params[5],
        resource: params[6],
        snapshot_json: params[7] ?? {},
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

function load(overrides: { studio?: Record<string, unknown>; objective?: string } = {}) {
  const db = new StudioMemory();
  db.seed(overrides);
  if (overrides.objective) {
    db.proposals.get(9)!.objective = overrides.objective;
  }
  const audit = new QuoteAuditRepository(db);
  const approvals = new QuoteApprovalService(db);
  const mailer = { send: async () => ({ ok: true, skipped: true }) };
  const shares = new QuoteShareService(db, audit, mailer as never);
  const publicQuotes = new QuotePublicService(db, shares);
  const serviceKpiRepo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
  const svc = new QuoteStudioService(db, approvals, publicQuotes, audit, serviceKpiRepo);
  return { db, svc, publicQuotes };
}

describe('QuoteStudioService publish gate', () => {
  it('AC-06: publish payload has no cost/margin/approval/hidden option keys', async () => {
    const { svc, db } = load();

    const dto = await svc.publish(VID, ACTOR);

    for (const key of FORBIDDEN_KEYS) {
      expect(dto).not.toHaveProperty(key);
    }
    expect(JSON.stringify(dto)).not.toMatch(LEAK_RE);
    expect(dto.investment).toBeDefined();
    expect(dto.investment).not.toHaveProperty('gm_bps');
    expect(dto.investment).not.toHaveProperty('cost');
    expect((dto.cta as { accept: string }).accept).toBe('Xác nhận đề xuất');
    expect(db.versions.get(VID)?.state).toBe('published');
    expect(db.proposals.get(9)?.status).toBe('sent');
  });

  it('section 09 off → 400 studio_gate', async () => {
    const { svc, db } = load({ studio: { '09': { on: false } } });

    await expect(svc.publish(VID, ACTOR)).rejects.toMatchObject({
      response: { error: 'studio_gate' },
    });
    try {
      await svc.publish(VID, ACTOR);
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }
    expect(db.versions.get(VID)?.state).toBe('approved');
    expect(db.proposals.get(9)?.status).toBe('approved');
  });

  it('AC-LP-02: publish with lead missing company_name is 400', async () => {
    const { svc, db } = load();
    db.proposals.get(9)!.lead_id = 5;
    db.leads.set(5, { company_name: '', phone: '0901', email: '', full_name: 'Tuan' });

    await expect(svc.publish(VID, ACTOR)).rejects.toMatchObject({
      response: { error: 'company_name_required', message: 'Nhập tên công ty trước khi gửi báo giá.' },
    });
    expect(db.versions.get(VID)?.state).toBe('approved');
  });

  it('real_estate banned phrase in objective blocks publish with 400', async () => {
    const { svc, db } = load({ objective: 'Chiến dịch cam kết doanh số 50 căn' });
    const snap = db.versions.get(VID)!.snapshot_json as Record<string, unknown>;
    const studio = (snap.studio ?? {}) as Record<string, unknown>;
    studio.industry = 'real_estate';
    snap.studio = studio;

    await expect(svc.publish(VID, ACTOR)).rejects.toMatchObject({
      response: { error: 'kpi_policy_banned_phrase' },
    });
    expect(db.versions.get(VID)?.state).toBe('approved');
  });

  it('AC-LP-04: publish with company + phone snapshots party_json', async () => {
    const { svc, db } = load();
    db.proposals.get(9)!.lead_id = 5;
    db.leads.set(5, {
      company_name: '360 Auto',
      company_address: '',
      phone: '0901234567',
      email: '',
      full_name: 'Tuan Truong',
      logo_asset_id: null,
    });

    await svc.publish(VID, ACTOR);

    expect(db.versions.get(VID)?.state).toBe('published');
    expect(db.versions.get(VID)?.party_json).toMatchObject({
      company_name: '360 Auto',
      contact_name: 'Tuan Truong',
      phone: '0901234567',
    });
  });
});

describe('studio preview + section toggle', () => {
  it('preview DTO matches public GET fields and has no cost/margin/NSR', async () => {
    const { svc } = load();
    const dto = await svc.preview(VID, ACTOR);
    expect((dto.cta as { accept: string }).accept).toBe('Xác nhận đề xuất');
    expect(dto).not.toHaveProperty('cost');
    expect(dto).not.toHaveProperty('margin');
    expect(JSON.stringify(dto)).not.toMatch(LEAK_RE);
  });

  it('preview hydrates studio 08/09 from snapshot and missing flags stay off', async () => {
    const off = load({ studio: { '08': { on: false }, '09': { on: false } } });
    const offDto = await off.svc.preview(VID, ACTOR);
    expect(offDto.studio).toMatchObject({
      sections: { '08': { on: false }, '09': { on: false } },
    });

    const empty = load();
    const version = empty.db.versions.get(VID);
    if (version) version.snapshot_json = { kpis: [] };
    const emptyDto = await empty.svc.preview(VID, ACTOR);
    expect(emptyDto.studio).toMatchObject({
      sections: { '08': { on: false }, '09': { on: false } },
    });
  });

  it('saveSections persists 08/09 on snapshot', async () => {
    const { svc, db } = load({ studio: { '08': { on: false }, '09': { on: false } } });
    const out = await svc.saveSections(VID, { '08': true, '09': true }, ACTOR);
    expect(out.sections).toMatchObject({ '08': { on: true }, '09': { on: true } });
    const snap = db.versions.get(VID)?.snapshot_json as {
      studio?: { sections?: Record<string, { on?: boolean }> };
    };
    expect(snap.studio?.sections?.['08']?.on).toBe(true);
    expect(snap.studio?.sections?.['09']?.on).toBe(true);
  });
});

describe('studio publish HTTP wiring', () => {
  it('wires POST publish on quote-versions with crm_quote.publish execute', () => {
    const versions = readFileSync(join(__dirname, 'quote-versions.controller.ts'), 'utf8');
    const mod = readFileSync(join(__dirname, 'proposals.module.ts'), 'utf8');
    expect(versions).toMatch(/@Controller\('api\/crm\/quote-versions'\)/);
    expect(versions).toMatch(/@Post\(':vid\/publish'\)/);
    expect(versions).toMatch(/@Get\(':vid\/preview'\)/);
    expect(versions).toMatch(/@Patch\(':vid\/studio'\)/);
    expect(versions).toMatch(/RequireQuoteSection\('crm_quote\.publish',\s*'execute'\)/);
    expect(versions).toMatch(/StaffQuoteGuard/);
    expect(versions).not.toMatch(/\/api\/quotes/);
    expect(mod).toMatch(/QuoteStudioService/);
  });
});
