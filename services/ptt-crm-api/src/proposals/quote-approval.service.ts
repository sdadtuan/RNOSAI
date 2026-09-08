import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QT_QUOTE_QUERY, QuoteQueryFn, QuoteQueryPort } from './quote-audit.repository';
import { QT_TENANT_ID } from './quote-settings.repository';
import { DEFAULT_PTT_SETTINGS } from './quote-settings.service';
import {
  discountBpsFromTotals,
  evaluateQuotePolicy,
  type QuotePolicyFlags,
  type QuotePolicySettings,
} from './quote-policy.util';
import { canTransition, type QuoteStatus } from './quote-status.util';

const SLA_HOURS = 24;

export type QuoteApprovalActor = {
  staffId: number;
  staffAuthVia?: 'internal' | 'jwt';
};

export type QuoteApprovalStepAction = 'approve' | 'return' | 'reject' | 'delegate';

export type QuoteApprovalActionInput = {
  action?: QuoteApprovalStepAction | string;
  comment?: string | null;
  delegate_staff_id?: number | null;
  until?: string | null;
};

export type QuoteApprovalStepRow = {
  id: string;
  approval_id: string;
  seq: number;
  section: string;
  state: string;
  assignee_staff_id: number | null;
  sla_hours: number | null;
  acted_at: string | null;
  comment: string | null;
  delegate_from: number | null;
  until?: string | null;
};

export type QuoteApprovalRow = {
  id: string;
  version_id: string;
  policy_snapshot: Record<string, unknown>;
  created_at?: string;
};

function bad(error: string): never {
  throw new BadRequestException({ error });
}

function num(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function mapStep(row: Record<string, unknown>): QuoteApprovalStepRow {
  return {
    id: String(row.id ?? ''),
    approval_id: String(row.approval_id ?? ''),
    seq: num(row.seq),
    section: String(row.section ?? ''),
    state: String(row.state ?? 'locked'),
    assignee_staff_id: nullableNum(row.assignee_staff_id),
    sla_hours: nullableNum(row.sla_hours),
    acted_at: row.acted_at == null || row.acted_at === '' ? null : String(row.acted_at),
    comment: row.comment == null || row.comment === '' ? null : String(row.comment),
    delegate_from: nullableNum(row.delegate_from),
    until: row.until == null || row.until === '' ? null : String(row.until),
  };
}

function mapApproval(row: Record<string, unknown>): QuoteApprovalRow {
  return {
    id: String(row.id ?? ''),
    version_id: String(row.version_id ?? ''),
    policy_snapshot: asObject(row.policy_snapshot),
    created_at: row.created_at == null ? undefined : String(row.created_at),
  };
}

function commentText(value: unknown): string {
  return String(value ?? '').trim();
}

@Injectable()
export class QuoteApprovalService {
  constructor(@Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort) {}

  async submitApproval(vid: string, actor: QuoteApprovalActor) {
    this.assertStaff(actor);
    return this.inTx(async (query) => {
      const version = await this.requireVersion(vid, query);
      if (String(version.state ?? '').toLowerCase() !== 'working') {
        bad('version_not_working');
      }
      const settings = await this.loadSettings(query);
      const flags = await this.loadFlags(version, query);
      const totals = {
        fee_vnd: num(version.fee_vnd),
        discount_vnd: num(version.discount_vnd),
        payable_vnd: num(version.payable_vnd),
        gm_bps: nullableNum(version.gm_bps),
      };
      const planned = evaluateQuotePolicy(settings, totals, flags);
      if (totals.gm_bps == null) bad('gm_required');
      if (!planned.length) bad('approval_plan_empty');
      const discountBps = discountBpsFromTotals(totals.fee_vnd, totals.discount_vnd);
      const snapshot = {
        fee_vnd: totals.fee_vnd,
        discount_vnd: totals.discount_vnd,
        payable_vnd: totals.payable_vnd,
        gm_bps: totals.gm_bps,
        discount_bps: discountBps,
        settings,
        flags,
        steps: planned,
      };
      const inserted = await query(
        `INSERT INTO crm_quote_approvals (version_id, policy_snapshot)
         VALUES ($1, $2)
         RETURNING id, version_id, policy_snapshot, created_at`,
        [vid, snapshot],
      );
      const approval = mapApproval(inserted.rows[0] ?? { version_id: vid, policy_snapshot: snapshot });
      const steps: QuoteApprovalStepRow[] = [];
      for (const [index, plan] of planned.entries()) {
        const state = index === 0 ? 'waiting' : 'locked';
        const row = await query(
          `INSERT INTO crm_quote_approval_steps
             (approval_id, seq, section, state, assignee_staff_id, sla_hours, comment, delegate_from)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, approval_id, seq, section, state, assignee_staff_id, sla_hours,
                     acted_at, comment, delegate_from`,
          [approval.id, index + 1, plan.section, state, null, SLA_HOURS, null, null],
        );
        steps.push(mapStep(row.rows[0] ?? { ...plan, seq: index + 1, state, approval_id: approval.id }));
      }
      await query(`UPDATE crm_quote_versions SET state = $1 WHERE id::text = $2`, [
        'submitted',
        vid,
      ]);
      await this.setProposalStatus(query, num(version.proposal_id), 'pending_approval');
      await this.audit(
        query,
        num(version.proposal_id),
        vid,
        actor.staffId,
        'quote.approval_submitted',
        snapshot,
      );
      return { approval: { ...approval, policy_snapshot: snapshot }, steps };
    });
  }

  async actOnStep(sid: string, input: QuoteApprovalActionInput, actor: QuoteApprovalActor) {
    this.assertStaff(actor);
    const action = String(input.action ?? '').trim().toLowerCase();
    if (action !== 'approve' && action !== 'return' && action !== 'reject' && action !== 'delegate') {
      bad('invalid_action');
    }
    const comment = commentText(input.comment);
    if ((action === 'return' || action === 'reject') && !comment) {
      bad('comment_required');
    }
    return this.inTx(async (query) => {
      const step = await this.requireStep(sid, query);
      const approval = await this.requireApprovalById(step.approval_id, query);
      const version = await this.requireVersion(approval.version_id, query);
      const siblings = await this.listSteps(step.approval_id, query);
      this.assertStepWaiting(step);

      if (action === 'delegate') {
        const delegateId = nullableNum(input.delegate_staff_id);
        if (delegateId == null || delegateId <= 0) bad('delegate_staff_id_required');
        const until = commentText(input.until) || null;
        const updated = await query(
          `UPDATE crm_quote_approval_steps
              SET assignee_staff_id = $1,
                  delegate_from = $2,
                  comment = $3
            WHERE id::text = $4
            RETURNING id, approval_id, seq, section, state, assignee_staff_id, sla_hours,
                      acted_at, comment, delegate_from`,
          [delegateId, actor.staffId || null, comment || null, sid],
        );
        const mapped = mapStep(updated.rows[0] ?? step);
        mapped.until = until;
        mapped.delegate_from = actor.staffId || mapped.delegate_from;
        mapped.assignee_staff_id = delegateId;
        mapped.comment = comment || mapped.comment;
        await this.audit(
          query,
          num(version.proposal_id),
          approval.version_id,
          actor.staffId,
          'quote.approval_delegated',
          { step_id: sid, delegate_staff_id: delegateId, until, reason: comment || null },
        );
        return { step: mapped, steps: await this.listSteps(step.approval_id, query) };
      }

      if (action === 'return' || action === 'reject') {
        const now = new Date().toISOString();
        await query(
          `UPDATE crm_quote_approval_steps
              SET state = $1, comment = $2, acted_at = $3
            WHERE id::text = $4`,
          ['skipped', comment, now, sid],
        );
        await query(`UPDATE crm_quote_versions SET state = $1 WHERE id::text = $2`, [
          action === 'return' ? 'working' : 'submitted',
          approval.version_id,
        ]);
        await this.setProposalStatus(
          query,
          num(version.proposal_id),
          action === 'return' ? 'returned' : 'rejected',
        );
        const mapped = { ...step, state: 'skipped', comment, acted_at: now };
        await this.audit(
          query,
          num(version.proposal_id),
          approval.version_id,
          actor.staffId,
          action === 'return' ? 'quote.approval_returned' : 'quote.approval_rejected',
          { step_id: sid, comment },
        );
        return { step: mapped, steps: await this.listSteps(step.approval_id, query) };
      }

      const now = new Date().toISOString();
      await query(
        `UPDATE crm_quote_approval_steps
            SET state = $1, comment = $2, acted_at = $3
          WHERE id::text = $4`,
        ['done', comment || null, now, sid],
      );
      const remaining = siblings
        .filter((row) => row.id !== sid)
        .sort((a, b) => a.seq - b.seq);
      const nextLocked = remaining.find((row) => row.state === 'locked');
      if (nextLocked) {
        await query(`UPDATE crm_quote_approval_steps SET state = $1 WHERE id::text = $2`, [
          'waiting',
          nextLocked.id,
        ]);
      }
      const steps = await this.listSteps(step.approval_id, query);
      const requiredDone = steps.length > 0 && steps.every((row) => row.state === 'done');
      if (requiredDone) {
        await query(`UPDATE crm_quote_versions SET state = $1 WHERE id::text = $2`, [
          'approved',
          approval.version_id,
        ]);
        await this.setProposalStatus(query, num(version.proposal_id), 'approved');
      }
      await this.audit(
        query,
        num(version.proposal_id),
        approval.version_id,
        actor.staffId,
        'quote.approval_approved',
        { step_id: sid },
      );
      return {
        step: { ...step, state: 'done', comment: comment || step.comment, acted_at: now },
        steps,
      };
    });
  }

  async assertPublishable(versionId: string): Promise<void> {
    const version = await this.requireVersion(versionId, (sql, params) => this.db.query(sql, params));
    const proposal = await this.requireProposal(num(version.proposal_id), (sql, params) =>
      this.db.query(sql, params),
    );
    if (String(version.state ?? '') !== 'approved' || String(proposal.status ?? '') !== 'approved') {
      bad('approval_incomplete');
    }
    const approval = await this.getApprovalByVersion(versionId);
    if (!approval) bad('approval_incomplete');
    const steps = await this.listSteps(approval.id);
    if (!steps.length || steps.some((row) => row.state !== 'done')) bad('approval_incomplete');
  }

  private assertStaff(actor: QuoteApprovalActor): void {
    if (actor.staffAuthVia === 'internal') return;
    if (!(Number(actor.staffId ?? 0) > 0)) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
  }

  private assertStepWaiting(step: QuoteApprovalStepRow): void {
    if (step.state === 'waiting') return;
    if (step.state === 'locked') bad('step_locked');
    bad('step_not_waiting');
  }

  private async requireProposal(
    proposalId: number,
    query: QuoteQueryFn,
  ): Promise<{ id: number; status: string }> {
    const result = await query(
      `SELECT id, status FROM crm_proposals WHERE id = $1 LIMIT 1`,
      [proposalId],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'quote_not_found' });
    return { id: num(result.rows[0].id), status: String(result.rows[0].status ?? '') };
  }

  private async setProposalStatus(
    query: QuoteQueryFn,
    proposalId: number,
    to: QuoteStatus,
  ): Promise<void> {
    const current = await this.requireProposal(proposalId, query);
    const from = current.status as QuoteStatus;
    if (!canTransition(from, to)) bad('illegal_status');
    await query(`UPDATE crm_proposals SET status = $1 WHERE id = $2`, [to, proposalId]);
  }

  private inTx<T>(fn: (query: QuoteQueryFn) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) return this.db.withTransaction(fn);
    return fn((sql, params) => this.db.query(sql, params));
  }

  private async requireVersion(
    vid: string,
    query: QuoteQueryFn,
  ): Promise<Record<string, unknown>> {
    const result = await query(
      `SELECT id, proposal_id, n, state, snapshot_json, fee_vnd, media_vnd, discount_vnd,
              tax_vnd, payable_vnd, nsr_vnd, direct_cost_vnd, gm_bps, created_by
         FROM crm_quote_versions
        WHERE id::text = $1
        LIMIT 1`,
      [vid],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'version_not_found' });
    return result.rows[0];
  }

  private async loadSettings(query: QuoteQueryFn): Promise<QuotePolicySettings> {
    const result = await query(
      `SELECT gm_floor_bps, discount_auto_bps, director_value_vnd, payment_term_max_days
         FROM crm_quote_settings
        WHERE tenant_id = $1
        LIMIT 1`,
      [QT_TENANT_ID],
    );
    const row = result.rows[0] ?? DEFAULT_PTT_SETTINGS;
    return {
      gm_floor_bps: num(row.gm_floor_bps, num(DEFAULT_PTT_SETTINGS.gm_floor_bps, 2500)),
      discount_auto_bps: num(row.discount_auto_bps, num(DEFAULT_PTT_SETTINGS.discount_auto_bps, 500)),
      director_value_vnd: num(
        row.director_value_vnd,
        num(DEFAULT_PTT_SETTINGS.director_value_vnd, 200000000),
      ),
      payment_term_max_days: num(
        row.payment_term_max_days,
        num(DEFAULT_PTT_SETTINGS.payment_term_max_days, 60),
      ),
    };
  }

  private async loadFlags(
    version: Record<string, unknown>,
    query: QuoteQueryFn,
  ): Promise<QuotePolicyFlags> {
    const proposalId = num(version.proposal_id);
    const lines = await query(
      `SELECT final_price_vnd, unit_price_vnd, discount_vnd, item_type, sku_code,
              cost_labor_vnd, cost_outsource_vnd, cost_other_vnd, catalog_snapshot_json
         FROM crm_quote_line_item
        WHERE proposal_id = $1`,
      [proposalId],
    );
    const clauses = await query(
      `SELECT diverged FROM crm_quote_clauses WHERE version_id::text = $1`,
      [String(version.id)],
    );
    const snap = asObject(version.snapshot_json);
    const paymentTermDays = nullableNum(snap.payment_term_days);
    let hasZero = false;
    let hasCustom = false;
    let costMissing = false;
    for (const line of lines.rows) {
      const price = num(line.final_price_vnd);
      const unit = num(line.unit_price_vnd);
      if (price === 0 || unit === 0) hasZero = true;
      const sku = String(line.sku_code ?? '').toUpperCase();
      const itemType = String(line.item_type ?? '').toLowerCase();
      const catalog = asObject(line.catalog_snapshot_json);
      if (itemType === 'custom' || sku.startsWith('CUSTOM') || catalog.custom === true) {
        hasCustom = true;
      }
      if (itemType === 'fee' || itemType === '') {
        if (line.cost_labor_vnd == null && line.cost_outsource_vnd == null && line.cost_other_vnd == null) {
          costMissing = true;
        }
      }
    }
    return {
      payment_term_days: paymentTermDays,
      clause_diverged: clauses.rows.some(
        (row) => row.diverged === true || row.diverged === 't' || row.diverged === 'true',
      ),
      has_custom: hasCustom,
      has_zero_price: hasZero,
      cost_missing: costMissing,
    };
  }

  private async requireStep(sid: string, query: QuoteQueryFn): Promise<QuoteApprovalStepRow> {
    const result = await query(
      `SELECT id, approval_id, seq, section, state, assignee_staff_id, sla_hours,
              acted_at, comment, delegate_from
         FROM crm_quote_approval_steps
        WHERE id::text = $1
        LIMIT 1`,
      [sid],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'step_not_found' });
    return mapStep(result.rows[0]);
  }

  private async requireApprovalById(
    approvalId: string,
    query: QuoteQueryFn,
  ): Promise<QuoteApprovalRow> {
    const result = await query(
      `SELECT id, version_id, policy_snapshot, created_at
         FROM crm_quote_approvals
        WHERE id::text = $1
        LIMIT 1`,
      [approvalId],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'approval_not_found' });
    return mapApproval(result.rows[0]);
  }

  private async getApprovalByVersion(
    versionId: string,
    query?: QuoteQueryFn,
  ): Promise<QuoteApprovalRow | null> {
    const run = query ?? ((sql: string, params?: unknown[]) => this.db.query(sql, params));
    const result = await run(
      `SELECT id, version_id, policy_snapshot, created_at
         FROM crm_quote_approvals
        WHERE version_id::text = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [versionId],
    );
    return result.rows[0] ? mapApproval(result.rows[0]) : null;
  }

  private async listSteps(approvalId: string, query?: QuoteQueryFn): Promise<QuoteApprovalStepRow[]> {
    const run = query ?? ((sql: string, params?: unknown[]) => this.db.query(sql, params));
    const result = await run(
      `SELECT id, approval_id, seq, section, state, assignee_staff_id, sla_hours,
              acted_at, comment, delegate_from
         FROM crm_quote_approval_steps
        WHERE approval_id::text = $1
        ORDER BY seq ASC`,
      [approvalId],
    );
    return result.rows.map(mapStep);
  }

  private async audit(
    query: QuoteQueryFn,
    proposalId: number,
    versionId: string,
    staffId: number,
    action: string,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    await query(
      `INSERT INTO crm_quote_activity (
         tenant_id, proposal_id, version_id, actor_staff_id, actor_kind, action, resource, snapshot_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [QT_TENANT_ID, proposalId, versionId, staffId || null, 'staff', action, 'quote_approval', snapshot],
    );
  }
}
