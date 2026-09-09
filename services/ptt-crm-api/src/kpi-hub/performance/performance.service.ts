import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import type { ServiceKpiRepository } from '../service-kpi/service-kpi.repository';
import { filterFieldsForRole } from './performance-acl';
import { computeDashboardTiles, buildWeeklyRhythm } from './performance-dashboard';
import { buildLedgers, isMaterialQuotedDelta, quotedDeltaPct } from './performance-ledgers';
import { roasDisplay, funnelStage } from './performance-marketing';
import { cascadeQuality, canClosePeriod, type Quality } from './performance-quality';
import { evaluateReadiness, validateTargetBand } from './performance-readiness';
import {
  assertActualWritable,
  assertRedRitual,
  assertReviewTransition,
} from './performance-ritual';
import { assertNotClosed, freezeSnapshot } from './performance-snapshot';
import { seedPerformanceCatalog } from './performance.catalog';
import { healthFromDirection, progressPercent, validateScorecardWeights } from './performance-score';
import type {
  AssignmentLifecycle,
  CollectionMethod,
  LedgerQuality,
  PmAssignment,
  PmAuditLog,
  PmCatalog,
  PmCheckIn,
  PmCorrectiveAction,
  PmScopeType,
  PmScorecard,
  PmScorecardItem,
  PmSettings,
  PmSnapshot,
  PmViewerRole,
} from './performance.types';

const DOMAIN_ERROR_CODES = new Set([
  'name_required',
  'target_required',
  'weight_exceeds_100',
  'blocker_required_when_red',
  'action_required_when_red',
  'actual_locked',
  'readiness_blocked',
  'quality_blocks_close',
  'reopen_required',
  'reopen_reason_required',
  'duplicate_assignment',
  'band_invalid',
  'forecast_disclaimer_required',
  'return_comment_required',
  'stale_version',
  'idempotency_replay',
  'assignment_not_found',
  'scorecard_not_found',
  'invalid_review_state',
]);

function mapDomainError(err: unknown): never {
  const msg = (err as Error).message;
  if (DOMAIN_ERROR_CODES.has(msg)) throw new BadRequestException({ error: msg });
  throw err;
}

function parseMappingQuality(raw: string): Quality {
  const lower = raw.toLowerCase();
  if (lower.includes('stale')) return 'stale';
  if (lower.includes('verified')) return 'verified';
  return 'pending';
}

@Injectable()
export class PerformanceService {
  private catalog: PmCatalog = seedPerformanceCatalog();
  private idempotency = new Map<string, unknown>();
  private hydratedActuals: Array<{
    instance_id: string;
    value: number | null;
    quality_status?: string;
    quality?: string;
  }> | null = null;

  constructor(@Optional() private readonly serviceKpiRepo?: ServiceKpiRepository) {}

  getCatalog(): PmCatalog {
    return this.catalog;
  }

  private enrich(row: PmAssignment): PmAssignment {
    const assigned_target = row.assigned_target ?? row.target;
    const quoted_vs_assigned_pct = quotedDeltaPct(row.quoted_target, assigned_target);
    const quoted_vs_actual_pct = quotedDeltaPct(row.quoted_target, row.actual);
    const auto = row.collection_method === 'api' || row.collection_method === 'connector';
    return {
      ...row,
      assigned_target,
      quoted_vs_assigned_pct,
      quoted_vs_actual_pct,
      quoted_delta_material: isMaterialQuotedDelta(quoted_vs_assigned_pct),
      actual_locked: row.quality === 'verified' && auto,
    };
  }

  getAssignment(id: string): PmAssignment {
    const asg = this.catalog.assignments.find((a) => a.id === id);
    if (!asg) throw new BadRequestException({ error: 'assignment_not_found' });
    return this.enrich(asg);
  }

  getDashboard() {
    const rows = this.catalog.assignments.map((a) => ({
      lifecycle: a.lifecycle,
      status: a.status,
      quality: a.quality,
      assumption_open: a.assumption_open,
    }));
    const tiles = computeDashboardTiles({
      rows,
      item_scores: this.catalog.assignments.map((a) => a.progress),
      checkins_expected: 58,
      checkins_on_time: 53,
    });
    const cpl = this.catalog.assignments.find((a) => a.id === 'asg-cpl')!;
    const ledgerCells = buildLedgers({
      quoted_target: cpl.quoted_target,
      assigned_target: cpl.assigned_target,
      verified_actual: cpl.actual,
      quality: cpl.quality,
    });
    const ledgers = {
      quoted: { ...ledgerCells.quoted, hint: 'Proposal QT-0089' },
      assigned: { ...ledgerCells.assigned, hint: 'Scorecard Q4' },
      verified: {
        ...ledgerCells.verified,
        hint: cpl.quality === 'stale' ? 'Stale 29h' : '',
      },
    };
    const rhythm = buildWeeklyRhythm({
      open_assumptions: this.catalog.assignments.filter((a) => a.assumption_open).map((a) => a.name),
      at_risk: this.catalog.assignments.filter((a) => a.status === 'red').map((a) => a.name),
      stale_label: 'CRM Valid Lead stale 29h',
      gm_miss: 'CPL An Phát +28% vs quoted',
      pending_scorecard: 'Scorecard Q4/2026 pending approval',
    });
    return {
      ...this.catalog.dashboard,
      ...tiles,
      ledgers,
      rhythm,
    };
  }

  private mapSkpiQuality(raw: string | undefined): LedgerQuality {
    if (raw === 'valid' || raw === 'verified') return 'verified';
    if (raw === 'stale') return 'stale';
    return 'pending';
  }

  private async loadHydratedActuals(): Promise<void> {
    if (!this.serviceKpiRepo || this.hydratedActuals) return;
    this.hydratedActuals = await this.serviceKpiRepo.listRecentActuals();
  }

  private async hydrateFromInstance(asg: PmAssignment): Promise<PmAssignment> {
    if (!this.serviceKpiRepo || !asg.instance_id) return this.enrich(asg);
    await this.loadHydratedActuals();
    const match = this.hydratedActuals?.find((a) => a.instance_id === asg.instance_id);
    if (!match || match.value == null) return this.enrich(asg);
    const rawQuality = match.quality_status ?? match.quality;
    asg.actual = match.value;
    asg.quality = this.mapSkpiQuality(rawQuality);
    asg.progress = progressPercent({ actual: match.value, target: asg.target, direction: asg.direction });
    asg.status = healthFromDirection({
      actual: match.value,
      target: asg.target,
      direction: asg.direction,
      progress: asg.progress,
    });
    return this.enrich(asg);
  }

  async listAssignments(scope?: string) {
    let items = this.catalog.assignments;
    if (this.serviceKpiRepo) {
      items = await Promise.all(items.map((a) => this.hydrateFromInstance({ ...a })));
    } else {
      items = items.map((a) => this.enrich(a));
    }
    if (!scope || scope === 'all') return { items };
    return { items: items.filter((a) => a.scope_type === scope) };
  }

  createAssignment(body: {
    name: string;
    definition_code?: string;
    owner: string;
    scope_type: PmScopeType;
    scope_name: string;
    department?: string;
    cycle?: string;
    period?: string;
    direction?: PmAssignment['direction'];
    target: number;
    target_label?: string;
    unit?: string;
    source?: string;
    collection_method?: CollectionMethod;
    instance_id?: string;
    quoted_target?: number | null;
    assumption_open?: boolean;
  }): PmAssignment {
    const name = body.name?.trim();
    if (!name || name.length < 3) throw new BadRequestException({ error: 'name_required' });
    if (!Number.isFinite(body.target)) throw new BadRequestException({ error: 'target_required' });
    const collection_method = body.collection_method ?? 'manual';
    const row: PmAssignment = this.enrich({
      id: `asg-${Date.now()}`,
      name,
      code: `KPI-${(body.definition_code ?? 'CUS').replace(/\W/g, '').slice(0, 12)}-${String(this.catalog.assignments.length + 1).padStart(3, '0')}`,
      definition_code: body.definition_code ?? 'CUSTOM',
      owner: body.owner,
      scope_type: body.scope_type,
      scope_name: body.scope_name,
      department: body.department ?? body.scope_name,
      cycle: body.cycle ?? 'Tháng',
      period: body.period ?? '09/2026',
      direction: body.direction ?? 'higher',
      target: body.target,
      target_label: body.target_label ?? String(body.target),
      actual: null,
      unit: body.unit ?? '',
      progress: null,
      status: 'no_data',
      trend: 'na',
      source: body.source ?? 'Manual',
      quality: 'pending',
      quoted_target: body.quoted_target ?? null,
      assigned_target: body.target,
      source_id: null,
      instance_id: body.instance_id ?? null,
      collection_method,
      lifecycle: 'draft',
      client_visible: false,
      disclaimer: '',
      assumption_open: body.assumption_open ?? false,
      target_min: null,
      target_stretch: null,
      quoted_vs_assigned_pct: null,
      quoted_vs_actual_pct: null,
      quoted_delta_material: false,
      actual_locked: false,
      row_version: 1,
    });
    this.catalog.assignments.unshift(row);
    return row;
  }

  activateAssignment(id: string): PmAssignment {
    const asg = this.catalog.assignments.find((a) => a.id === id);
    if (!asg) throw new BadRequestException({ error: 'assignment_not_found' });
    const band = validateTargetBand({
      direction: asg.direction,
      min: asg.target_min,
      target: asg.target,
      stretch: asg.target_stretch,
    });
    const auto = asg.collection_method === 'api' || asg.collection_method === 'connector';
    const readiness = evaluateReadiness({
      definition_active: asg.definition_code !== 'CUSTOM',
      owner_active: Boolean(asg.owner?.trim()),
      band_valid: band.ok,
      has_measurement_plan: Boolean(asg.source_id || asg.instance_id),
      auto_tracked: auto,
      client_visible: asg.client_visible,
      has_disclaimer: Boolean(asg.disclaimer?.trim()),
    });
    if (!readiness.can_activate) {
      throw new BadRequestException({ error: 'readiness_blocked', gates: readiness.gates });
    }
    asg.lifecycle = 'active';
    asg.row_version += 1;
    return this.enrich(asg);
  }

  listScorecards() {
    return { items: this.catalog.scorecards };
  }

  addScorecardItem(scorecardId: string, item: Omit<PmScorecardItem, 'id'>) {
    const sc = this.catalog.scorecards.find((s) => s.id === scorecardId);
    if (!sc) throw new BadRequestException({ error: 'scorecard_not_found' });
    const next = [...sc.items, { ...item, id: `it-${Date.now()}` }];
    const { total, valid } = validateScorecardWeights(next.map((i) => i.weight));
    if (total > 100) throw new BadRequestException({ error: 'weight_exceeds_100', total });
    sc.items = next;
    sc.weight_total = total;
    sc.weight_valid = valid;
    return sc;
  }

  listCheckIns(assignmentId?: string) {
    const items = assignmentId
      ? this.catalog.checkins.filter((c) => c.assignment_id === assignmentId)
      : this.catalog.checkins;
    const assignment =
      this.catalog.assignments.find((a) => a.id === (assignmentId ?? 'asg-p1')) ??
      this.catalog.assignments.find((a) => a.status === 'red') ??
      this.catalog.assignments[0];
    return {
      assignment: assignment ? this.enrich(assignment) : assignment,
      items,
      actions: this.catalog.actions.filter((a) => !assignmentId || a.assignment_id === assignmentId),
    };
  }

  async createCheckIn(body: {
    assignment_id: string;
    note: string;
    actual?: number;
    forecast?: string;
    evidence?: string;
    author?: string;
    action_title?: string;
  }): Promise<PmCheckIn> {
    const asg = this.catalog.assignments.find((a) => a.id === body.assignment_id);
    if (!asg) throw new BadRequestException({ error: 'assignment_not_found' });
    try {
      assertActualWritable({
        quality: asg.quality,
        collection_method: asg.collection_method ?? 'manual',
        incoming_actual: body.actual,
      });
    } catch (e) {
      throw new BadRequestException({ error: (e as Error).message });
    }
    if (
      body.actual != null &&
      asg.quality === 'verified' &&
      (asg.collection_method === 'api' || asg.collection_method === 'connector')
    ) {
      throw new BadRequestException({ error: 'actual_locked' });
    }
    if (body.actual != null && asg.quality !== 'verified') {
      asg.actual = body.actual;
      asg.progress = progressPercent({ actual: body.actual, target: asg.target, direction: asg.direction });
      asg.status = healthFromDirection({
        actual: body.actual,
        target: asg.target,
        direction: asg.direction,
        progress: asg.progress,
      });
    }
    const existingAction =
      this.catalog.actions.find((a) => a.assignment_id === asg.id)?.title ?? '';
    try {
      assertRedRitual({
        health: asg.status,
        blocker: body.note,
        action_title: body.action_title ?? existingAction,
      });
    } catch (e) {
      mapDomainError(e);
    }
    if (asg.status === 'red' && body.action_title?.trim()) {
      this.createAction({
        assignment_id: asg.id,
        title: body.action_title,
        owner: body.author ?? asg.owner,
        due: new Date(Date.now() + 86400000).toLocaleDateString('vi-VN'),
        impact: 'Corrective action from check-in',
      });
    }
    const row: PmCheckIn = {
      id: `ck-${Date.now()}`,
      assignment_id: asg.id,
      date: new Date().toLocaleDateString('vi-VN'),
      author: body.author ?? asg.owner,
      status: asg.status,
      note: body.note,
      forecast: body.forecast,
      evidence: body.evidence,
      review_state: 'submitted',
    };
    this.catalog.checkins.unshift(row);
    return row;
  }

  reviewCheckIn(
    id: string,
    body: { to: 'approved' | 'returned' | 'escalated'; comment?: string },
  ): PmCheckIn {
    const ck = this.catalog.checkins.find((c) => c.id === id);
    if (!ck) throw new BadRequestException({ error: 'assignment_not_found' });
    try {
      const next = assertReviewTransition(ck.review_state ?? 'submitted', body.to, body.comment ?? '');
      ck.review_state = next;
      ck.review_comment = body.comment;
      if (next === 'approved') ck.status = 'approved';
    } catch (e) {
      mapDomainError(e);
    }
    return ck;
  }

  createAction(body: Omit<PmCorrectiveAction, 'id'>): PmCorrectiveAction {
    const row = { ...body, id: `ac-${Date.now()}` };
    this.catalog.actions.unshift(row);
    return row;
  }

  closePeriod(body: { scorecard_id: string; period: string }): PmSnapshot {
    const sc = this.catalog.scorecards.find((s) => s.id === body.scorecard_id);
    if (!sc) throw new BadRequestException({ error: 'scorecard_not_found' });
    if (sc.status === 'closed') throw new BadRequestException({ error: 'reopen_required' });

    const linkedAssignments = sc.items
      .map((item) => this.catalog.assignments.find((a) => a.definition_code === item.definition_code))
      .filter((a): a is PmAssignment => a != null);

    const cascadeRows = this.catalog.crm_mappings.map((m) => ({
      kpi: m.kpi,
      quality: parseMappingQuality(m.quality),
      dependents: m.related ? [m.related] : [],
    }));
    cascadeQuality(cascadeRows);

    const qualityRows: Array<{ quality: Quality }> = linkedAssignments.map((a) => ({
      quality: a.quality as Quality,
    }));

    if (!canClosePeriod(qualityRows)) {
      throw new BadRequestException({ error: 'quality_blocks_close' });
    }

    const frozen = freezeSnapshot({ scorecard_id: sc.id, period: body.period, items: sc.items });
    const snapshot: PmSnapshot = {
      id: `snap-${Date.now()}`,
      scorecard_id: sc.id,
      period_label: body.period,
      hash: frozen.hash,
      payload: frozen.payload,
      closed_at: frozen.closed_at,
    };
    this.catalog.snapshots.push(snapshot);
    sc.status = 'closed';
    this.catalog.reports.period_state = 'closed';
    this.catalog.reports.snapshots = this.catalog.snapshots.length;
    this.catalog.audit_logs.unshift({
      id: `aud-${Date.now()}`,
      actor: 'system',
      action: 'period_close',
      entity: sc.id,
      payload_json: { period: body.period, hash: frozen.hash },
      created_at: new Date().toISOString(),
    });
    return snapshot;
  }

  reopenPeriod(body: { scorecard_id: string; period: string; reason: string }): PmScorecard {
    if (!body.reason?.trim()) throw new BadRequestException({ error: 'reopen_reason_required' });
    const sc = this.catalog.scorecards.find((s) => s.id === body.scorecard_id);
    if (!sc) throw new BadRequestException({ error: 'scorecard_not_found' });
    if (sc.status !== 'closed') throw new BadRequestException({ error: 'reopen_required' });
    sc.status = 'active';
    this.catalog.reports.period_state = 'open';
    this.catalog.audit_logs.unshift({
      id: `aud-${Date.now()}`,
      actor: 'system',
      action: 'period_reopen',
      entity: sc.id,
      payload_json: { period: body.period, reason: body.reason },
      created_at: new Date().toISOString(),
    });
    return sc;
  }

  listSnapshots(scorecardId?: string, period?: string): { items: PmSnapshot[] } {
    let items = this.catalog.snapshots;
    if (scorecardId) items = items.filter((s) => s.scorecard_id === scorecardId);
    if (period) items = items.filter((s) => s.period_label === period);
    return { items };
  }

  listAuditLogs(): { items: PmAuditLog[] } {
    return { items: this.catalog.audit_logs };
  }

  exportReport(body: { actor: string; role?: PmViewerRole }) {
    const role = body.role ?? 'lead';
    const rows = this.catalog.assignments.map((a) => filterFieldsForRole(this.enrich(a), role));
    this.catalog.audit_logs.unshift({
      id: `aud-${Date.now()}`,
      actor: body.actor,
      action: 'export',
      entity: 'report',
      payload_json: { role, count: rows.length },
      created_at: new Date().toISOString(),
    });
    return { items: rows };
  }

  getMarketing() {
    const m = this.catalog.marketing;
    return {
      ...m,
      roas: roasDisplay({ attribution_ready: m.attribution_ready, value: 4.52 }),
    };
  }

  getCampaigns() {
    return {
      items: this.catalog.campaigns,
      funnel: [
        { label: 'IMPRESSIONS', value: 1800000, display: '1,8M', hint: 'Forecast base' },
        { label: 'CLICKS', value: 32000, display: '32K', hint: 'CTR ≥ 1,8%' },
        { label: 'VALID LEAD', value: 250, display: '250', hint: 'W1 actual' },
        { label: 'QUALIFIED LEAD', value: 25, display: '25', hint: 'CRM confirmed' },
        funnelStage({ label: 'BOOKING', mapped: false }),
      ],
    };
  }

  getCrmSource() {
    return {
      tiles: [
        { label: 'RAW LEADS', value: 4126, hint: 'Daily CRM sync' },
        { label: 'VALID LEADS', value: 3248, hint: '78,7% validation rate' },
        { label: 'MQL', value: 604, hint: '18,6% of valid lead' },
        { label: 'SQL', value: 152, hint: '25,2% MQL → SQL' },
        { label: 'RESPONSE SLA', value: '27 phút', hint: 'Target < 15 phút', tone: 'critical' },
      ],
      mappings: this.catalog.crm_mappings,
    };
  }

  getReports() {
    return this.catalog.reports;
  }

  getSettings() {
    return this.catalog.settings;
  }

  updateSettings(patch: Partial<PmSettings>) {
    this.catalog.settings = {
      ...this.catalog.settings,
      ...patch,
      impact: patch.impact ?? this.catalog.settings.impact,
    };
    return this.catalog.settings;
  }

  getIdempotency(key: string): unknown | null {
    return this.idempotency.get(key) ?? null;
  }

  putIdempotency(key: string, response: unknown): void {
    this.idempotency.set(key, response);
  }
}
