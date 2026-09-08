import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteApprovalService } from './quote-approval.service';
import {
  QuoteAuditRepository,
  QT_QUOTE_QUERY,
  QuoteQueryFn,
  QuoteQueryPort,
} from './quote-audit.repository';
import { QuotePublicService } from './quote-public.service';
import { stripPublicQuote } from './quote-public-strip.util';
import { canTransition, type QuoteStatus } from './quote-status.util';

export const QT_STUDIO_SECTIONS = [
  { id: '01', key: 'cover', requiredOnPublish: false },
  { id: '02', key: 'context', requiredOnPublish: false },
  { id: '03', key: 'strategy', requiredOnPublish: false },
  { id: '04', key: 'scope', requiredOnPublish: false },
  { id: '05', key: 'kpi', requiredOnPublish: false },
  { id: '06', key: 'timeline', requiredOnPublish: false },
  { id: '07', key: 'investment', requiredOnPublish: false },
  { id: '08', key: 'terms', requiredOnPublish: true },
  { id: '09', key: 'confirm', requiredOnPublish: true },
] as const;

const FINANCE_MERGE = new Set([
  'cost',
  'margin',
  'gm_bps',
  'nsr',
  'nsr_vnd',
  'direct_cost_vnd',
  'approval',
  'approvals',
  'approval_id',
  'pending_approval',
]);

export type QuoteStudioActor = {
  staffId: number;
  staffAuthVia?: 'internal' | 'jwt';
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

function isOn(value: unknown): boolean {
  if (value === true || value === 't' || value === 'true') return true;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    return row.on === true || row.enabled === true;
  }
  return false;
}

function sectionOn(snapshot: Record<string, unknown>, id: string): boolean {
  const studio = asObject(snapshot.studio);
  const sections = asObject(studio.sections ?? snapshot.sections);
  return isOn(sections[id] ?? sections[`s${id}`]);
}

function isForecastKpi(row: Record<string, unknown>): boolean {
  return String(row.class ?? '').trim().toLowerCase() === 'projected_result';
}

function hasAssumption(row: Record<string, unknown>): boolean {
  return String(row.assumption ?? '').trim().length > 0;
}

export function studioMergeFields(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const k = key.toLowerCase();
    if (FINANCE_MERGE.has(k) || k.startsWith('cost_') || k.startsWith('approval_')) continue;
    out[key] = value;
  }
  return stripPublicQuote(out);
}

@Injectable()
export class QuoteStudioService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly approvals: QuoteApprovalService,
    private readonly publicQuotes: QuotePublicService,
    private readonly audit: QuoteAuditRepository,
  ) {}

  async publish(versionId: string, actor: QuoteStudioActor): Promise<Record<string, unknown>> {
    this.assertStaff(actor);
    const version = await this.requireVersion(versionId);
    this.assertStudioGate(asObject(version.snapshot_json));
    await this.approvals.assertPublishable(versionId);
    if (!(num(version.payable_vnd) > 0)) bad('payable_required');
    await this.assertPaymentPct(versionId);
    await this.assertForecastAssumptions(versionId, asObject(version.snapshot_json));

    const proposalId = num(version.proposal_id);
    const now = new Date().toISOString();
    await this.inTx(async (query) => {
      const proposal = await query(`SELECT id, status FROM crm_proposals WHERE id = $1 LIMIT 1`, [
        proposalId,
      ]);
      const current = String(proposal.rows[0]?.status ?? '') as QuoteStatus;
      if (current !== 'sent' && !canTransition(current, 'sent')) bad('illegal_status');
      await query(`UPDATE crm_quote_versions SET state = $1 WHERE id::text = $2`, [
        'published',
        versionId,
      ]);
      if (current !== 'sent') {
        await query(`UPDATE crm_proposals SET status = $1, updated_at = $2 WHERE id = $3`, [
          'sent',
          now,
          proposalId,
        ]);
      }
      await this.audit.insert(
        {
          proposal_id: proposalId,
          version_id: versionId,
          actor_staff_id: actor.staffId || null,
          actor_kind: 'staff',
          action: 'quote.publish',
          resource: 'quote_studio',
          snapshot_json: studioMergeFields({ version_id: versionId }),
        },
        query,
      );
    });
    return this.publicQuotes.renderByVersionId(versionId);
  }

  async preview(versionId: string, actor: QuoteStudioActor): Promise<Record<string, unknown>> {
    this.assertStaff(actor);
    return this.publicQuotes.renderByVersionId(versionId);
  }

  async saveSections(
    versionId: string,
    sections: Record<string, boolean>,
    actor: QuoteStudioActor,
  ): Promise<{ sections: Record<string, { on: boolean }> }> {
    this.assertStaff(actor);
    const version = await this.requireVersion(versionId);
    const snapshot = asObject(version.snapshot_json);
    const studio = asObject(snapshot.studio);
    const current = asObject(studio.sections ?? snapshot.sections);
    const next: Record<string, { on: boolean }> = { ...current } as Record<string, { on: boolean }>;
    for (const [id, on] of Object.entries(sections ?? {})) {
      next[id] = { on: on === true };
    }
    snapshot.studio = { ...studio, sections: next };
    await this.db.query(`UPDATE crm_quote_versions SET snapshot_json = $1 WHERE id::text = $2`, [
      snapshot,
      versionId,
    ]);
    return { sections: next };
  }

  private assertStaff(actor: QuoteStudioActor): void {
    if (actor.staffAuthVia === 'internal') return;
    if (!(Number(actor.staffId ?? 0) > 0)) {
      throw new ForbiddenException({ error: 'qt_unresolved_staff' });
    }
  }

  private assertStudioGate(snapshot: Record<string, unknown>): void {
    const required = QT_STUDIO_SECTIONS.filter((section) => section.requiredOnPublish);
    if (required.some((section) => !sectionOn(snapshot, section.id))) {
      bad('studio_gate');
    }
  }

  private async assertPaymentPct(versionId: string): Promise<void> {
    const result = await this.db.query(
      `SELECT seq, pct_bps FROM crm_quote_payment_schedules WHERE version_id::text = $1`,
      [versionId],
    );
    const total = result.rows.reduce((sum, row) => sum + num(row.pct_bps), 0);
    if (total !== 10000) bad('payment_pct_invalid');
  }

  private async assertForecastAssumptions(
    versionId: string,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    const live = await this.db.query(
      `SELECT class, assumption FROM crm_quote_kpis WHERE version_id::text = $1`,
      [versionId],
    );
    const snapKpis = Array.isArray(snapshot.kpis) ? (snapshot.kpis as Record<string, unknown>[]) : [];
    const rows = live.rows.length ? live.rows : snapKpis;
    const forecasts = rows.filter((row) => isForecastKpi(row));
    if (forecasts.length && forecasts.some((row) => !hasAssumption(row))) {
      bad('forecast_assumption_required');
    }
  }

  private async requireVersion(versionId: string): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `SELECT id, proposal_id, n, state, snapshot_json, payable_vnd
         FROM crm_quote_versions
        WHERE id::text = $1
        LIMIT 1`,
      [versionId],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'version_not_found' });
    return result.rows[0];
  }

  private inTx<T>(fn: (query: QuoteQueryFn) => Promise<T>): Promise<T> {
    if (this.db.withTransaction) return this.db.withTransaction(fn);
    return fn((sql, params) => this.db.query(sql, params));
  }
}
