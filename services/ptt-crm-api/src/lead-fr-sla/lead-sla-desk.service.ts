import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
import {
  addWorkingDays,
  addWorkingHours,
  computeFr1DueAt,
  subtractWorkingDays,
} from '../lead-sla-settings/lead-sla-working-hours.util';
import { LeadFrSlaRepository } from './lead-fr-sla.repository';
import { pickRoundRobinLeastOpen } from './lead-sla-reassign.util';
import type {
  FrOnTimeByAm,
  LeadOpsDeskSummary,
  LeadOpsRow,
  LeadOpsTab,
  LeadOpsWidgets,
} from './lead-sla-desk.types';

function iso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePreviousIds(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) =>
        typeof x === 'object' && x && 'staff_id' in x
          ? Number((x as { staff_id: number }).staff_id)
          : Number(x),
      )
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof raw === 'string') {
    try {
      return parsePreviousIds(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function mapRow(
  row: Record<string, unknown>,
  listKind: LeadOpsRow['list_kind'],
  now: Date,
): LeadOpsRow {
  const updated = asDate(row.updated_at) ?? asDate(row.assigned_at);
  const queueAge =
    listKind === 'queue' && updated
      ? (now.getTime() - updated.getTime()) / 3600_000
      : null;
  return {
    lead_id: Number(row.sqlite_lead_id),
    full_name: String(row.full_name ?? ''),
    company_name: String(row.company_name ?? ''),
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    owner_name: row.owner_name != null ? String(row.owner_name) : null,
    pipeline_stage: String(row.pipeline_stage ?? row.status ?? ''),
    contact_status: String(row.contact_status ?? ''),
    last_call_result: String(row.last_call_result ?? ''),
    attempts_since_assign: Number(row.attempts_since_assign ?? 0),
    fr1_due_at: iso(row.fr1_due_at),
    hold_until: iso(row.hold_until),
    reassign_count: Number(row.reassign_count ?? 0),
    is_hot: Boolean(row.is_hot),
    fr1_breached: Boolean(row.fr1_breached),
    hold_profile: String(row.hold_profile ?? ''),
    hold_reason: String(row.hold_reason ?? ''),
    sla_extend_count: Number(row.sla_extend_count ?? 0),
    meeting_at: iso(row.meeting_at),
    last_call_at: iso(row.last_call_at),
    assigned_at: iso(row.assigned_at),
    updated_at: iso(row.updated_at),
    queue_age_hours: queueAge != null ? Math.round(queueAge * 10) / 10 : null,
    list_kind: listKind,
  };
}

function pct(on: number, total: number): number | null {
  if (!(total > 0)) return null;
  return Math.round((on / total) * 1000) / 10;
}

@Injectable()
export class LeadSlaDeskService {
  constructor(
    private readonly repo: LeadFrSlaRepository,
    private readonly settings: LeadSlaSettingsService,
  ) {}

  async summary(now: Date = new Date()): Promise<LeadOpsDeskSummary> {
    const payload = await this.settings.getPublishedPayload();
    const eligible = payload.eligible_pipeline_stages;
    const holdHorizon = addWorkingHours(
      now,
      4,
      payload.working_hours,
      payload.holidays,
    );
    const meetLagCutoff = subtractWorkingDays(
      now,
      1,
      payload.working_hours,
      payload.holidays,
    );
    const noTouchCutoff = new Date(now.getTime() - 48 * 3600_000);

    const [fr1, hold, queue, meet, noTouch, dry] = await Promise.all([
      this.repo.listDeskFr1Breached(eligible, 200),
      this.repo.listDeskHoldDueSoon(holdHorizon.toISOString(), eligible, 200),
      this.repo.listDeskQueue(200),
      this.repo.listDeskMeetPendingLag(meetLagCutoff.toISOString(), eligible, 200),
      this.repo.listDeskNoTouch(noTouchCutoff.toISOString(), eligible, 200),
      payload.feature_flags.lead_sla_reassign_dry_run
        ? this.repo.listRecentDryRunWouldReassign(100)
        : Promise.resolve([]),
    ]);

    const queueAges = queue.map((r) => {
      const t = asDate(r.updated_at) ?? asDate(r.assigned_at);
      return t ? (now.getTime() - t.getTime()) / 3600_000 : 0;
    });
    const maxWait = payload.redistribute.assign_queue_max_wait_working_hours;
    const widgets: LeadOpsWidgets = {
      fr1_breached: fr1.length,
      hold_due_within_4wh: hold.length,
      redistribute_queue: queue.length,
      queue_max_age_hours: queueAges.length
        ? Math.round(Math.max(...queueAges) * 10) / 10
        : null,
      queue_alert_over_1wh: queueAges.filter((h) => h >= maxWait).length,
      meet_pending_no_meeting_over_1wd: meet.length,
      no_touch_over_48h: noTouch.length,
      dry_run_would_reassign: dry.length,
    };

    const todayStart = this.startOfSaigonDay(now);
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 3600_000);
    const [todayRows, weekRows] = await Promise.all([
      this.repo.frOnTimeByAm(todayStart.toISOString()),
      this.repo.frOnTimeByAm(weekStart.toISOString()),
    ]);
    const byId = new Map<number, FrOnTimeByAm>();
    for (const w of weekRows) {
      byId.set(w.owner_id, {
        owner_id: w.owner_id,
        owner_name: w.owner_name,
        today_on_time: 0,
        today_total: 0,
        today_pct: null,
        week_on_time: w.on_time,
        week_total: w.total,
        week_pct: pct(w.on_time, w.total),
      });
    }
    for (const t of todayRows) {
      const cur = byId.get(t.owner_id) ?? {
        owner_id: t.owner_id,
        owner_name: t.owner_name,
        today_on_time: 0,
        today_total: 0,
        today_pct: null,
        week_on_time: 0,
        week_total: 0,
        week_pct: null,
      };
      cur.today_on_time = t.on_time;
      cur.today_total = t.total;
      cur.today_pct = pct(t.on_time, t.total);
      byId.set(t.owner_id, cur);
    }

    return {
      widgets,
      fr_on_time_by_am: Array.from(byId.values()).sort(
        (a, b) => b.week_total - a.week_total || a.owner_name.localeCompare(b.owner_name),
      ),
      flags: {
        lead_sla_reassign_enabled: Boolean(
          payload.feature_flags.lead_sla_reassign_enabled,
        ),
        lead_sla_reassign_dry_run: Boolean(
          payload.feature_flags.lead_sla_reassign_dry_run,
        ),
      },
      tabs: {
        p0: {
          label: 'P0 · FR1 breach',
          count: widgets.fr1_breached,
          hint: 'Tách riêng hold-expiry (R3)',
        },
        p1: {
          label: 'P1 · Hold ≤4h LV',
          count: widgets.hold_due_within_4wh,
          hint: 'hold_until due / sắp đến',
        },
        p2: {
          label: 'P2 · Redistribute queue',
          count: widgets.redistribute_queue,
          hint: widgets.queue_max_age_hours != null
            ? `max age ${widgets.queue_max_age_hours}h`
            : 'queue rỗng',
        },
        p3: {
          label: 'P3 · 1a / no-touch / dry-run',
          count:
            widgets.meet_pending_no_meeting_over_1wd +
            widgets.no_touch_over_48h +
            widgets.dry_run_would_reassign,
          hint: '1a lag · no-touch 48h · would-reassign',
        },
      },
    };
  }

  async listTab(
    tab: LeadOpsTab,
    limit = 80,
    now: Date = new Date(),
  ): Promise<{ items: LeadOpsRow[]; tab: LeadOpsTab }> {
    const payload = await this.settings.getPublishedPayload();
    const eligible = payload.eligible_pipeline_stages;

    if (tab === 'p0') {
      const rows = await this.repo.listDeskFr1Breached(eligible, limit);
      return {
        tab,
        items: rows.map((r) => mapRow(r, 'fr1_breach', now)),
      };
    }
    if (tab === 'p1') {
      const holdHorizon = addWorkingHours(
        now,
        4,
        payload.working_hours,
        payload.holidays,
      );
      const rows = await this.repo.listDeskHoldDueSoon(
        holdHorizon.toISOString(),
        eligible,
        limit,
      );
      return {
        tab,
        items: rows.map((r) => mapRow(r, 'hold_expiry', now)),
      };
    }
    if (tab === 'p2') {
      const rows = await this.repo.listDeskQueue(limit);
      return {
        tab,
        items: rows.map((r) => mapRow(r, 'queue', now)),
      };
    }

    // p3: meet lag + no-touch + dry_run (dedupe by lead_id, prefer meet > no_touch > dry)
    const meetLagCutoff = subtractWorkingDays(
      now,
      1,
      payload.working_hours,
      payload.holidays,
    );
    const noTouchCutoff = new Date(now.getTime() - 48 * 3600_000);
    const [meet, noTouch, dry] = await Promise.all([
      this.repo.listDeskMeetPendingLag(
        meetLagCutoff.toISOString(),
        eligible,
        limit,
      ),
      this.repo.listDeskNoTouch(noTouchCutoff.toISOString(), eligible, limit),
      payload.feature_flags.lead_sla_reassign_dry_run
        ? this.repo.listRecentDryRunWouldReassign(limit)
        : Promise.resolve([]),
    ]);
    const seen = new Set<number>();
    const items: LeadOpsRow[] = [];
    for (const r of meet) {
      const id = Number(r.sqlite_lead_id);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(mapRow(r, 'meet_pending_lag', now));
    }
    for (const r of noTouch) {
      const id = Number(r.sqlite_lead_id);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(mapRow(r, 'no_touch', now));
    }
    for (const r of dry) {
      const id = Number(r.sqlite_lead_id);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(mapRow(r, 'dry_run', now));
    }
    return { tab, items: items.slice(0, limit) };
  }

  async listPool() {
    return this.repo.listPoolCandidates();
  }

  async reassign(
    leadId: number,
    body: { to_staff_id?: number | null; reason?: string },
    actor: string,
  ) {
    const row = await this.repo.getLeadDeskRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const payload = await this.settings.getPublishedPayload();
    const fromOwner = row.owner_id != null ? Number(row.owner_id) : null;
    if (fromOwner == null && String(row.contact_status) !== 'redistribute_queue') {
      throw new BadRequestException({ error: 'no_assignee' });
    }

    const previous = parsePreviousIds(row.previous_assignee_ids);
    let toStaff = body.to_staff_id != null ? Number(body.to_staff_id) : null;
    if (toStaff == null || !(toStaff > 0)) {
      const pool = await this.repo.listPoolCandidates();
      const blocked = fromOwner != null ? [...previous, fromOwner] : previous;
      toStaff = pickRoundRobinLeastOpen(pool, blocked, {
        maxOpen: payload.redistribute.max_open_attempting_per_am,
        cooldownDays: payload.case_1b.cooldown_days_same_am,
      });
    }
    if (toStaff == null) {
      throw new BadRequestException({ error: 'no_pool_candidate' });
    }

    if (fromOwner != null) {
      await this.repo.moveToRedistributeQueue(leadId, fromOwner, previous);
    }
    const fr1Due = computeFr1DueAt(
      new Date(),
      payload.fr1_hours,
      payload.working_hours,
      payload.holidays,
    );
    await this.repo.assignFromQueue(leadId, toStaff, fr1Due);
    await this.repo.clearFr1BreachOnReassign(leadId);
    await this.repo.insertReassignEvent({
      leadId,
      fromStaffId: fromOwner,
      toStaffId: toStaff,
      wouldToStaffId: toStaff,
      reason: String(body.reason || 'gdkd_manual_reassign').slice(0, 120),
      decision: 'reassigned',
      notes: `actor=${actor}`,
      holdUntil: asDate(row.hold_until),
      attemptCount: Number(row.attempts_since_assign ?? 0),
      jobRunId: `manual-${Date.now()}`,
      dryRun: false,
    });
    return { ok: true, lead_id: leadId, from_staff_id: fromOwner, to_staff_id: toStaff };
  }

  async extendHold(leadId: number, actor: string) {
    const row = await this.repo.getLeadDeskRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const payload = await this.settings.getPublishedPayload();
    const maxExt = payload.case_1b.max_extends;
    const base = asDate(row.hold_until) ?? new Date();
    const next = addWorkingDays(
      base,
      payload.case_1b.extend_working_days,
      payload.working_hours,
      payload.holidays,
    );
    const out = await this.repo.extendHoldUntil(leadId, next, maxExt);
    if (!out.ok) {
      throw new BadRequestException({
        error: out.error ?? 'extend_not_allowed',
        message: 'Chỉ 1b và tối đa 1 lần extend',
      });
    }
    await this.repo.insertReassignEvent({
      leadId,
      fromStaffId: row.owner_id != null ? Number(row.owner_id) : null,
      toStaffId: null,
      wouldToStaffId: null,
      reason: 'gdkd_extend_hold',
      decision: 'extended',
      notes: `actor=${actor}; until=${next.toISOString()}`,
      holdUntil: next,
      attemptCount: Number(row.attempts_since_assign ?? 0),
      jobRunId: `extend-${Date.now()}`,
      dryRun: false,
    });
    return { ok: true, hold_until: next.toISOString(), extend_count: out.extend_count };
  }

  async assignFromQueue(
    leadId: number,
    body: { to_staff_id: number },
    actor: string,
  ) {
    const row = await this.repo.getLeadDeskRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    if (String(row.contact_status).toLowerCase() !== 'redistribute_queue') {
      throw new BadRequestException({ error: 'not_in_queue' });
    }
    const toStaff = Number(body.to_staff_id);
    if (!(toStaff > 0)) throw new BadRequestException({ error: 'invalid_to_staff_id' });
    const payload = await this.settings.getPublishedPayload();
    const fr1Due = computeFr1DueAt(
      new Date(),
      payload.fr1_hours,
      payload.working_hours,
      payload.holidays,
    );
    await this.repo.assignFromQueue(leadId, toStaff, fr1Due);
    await this.repo.insertReassignEvent({
      leadId,
      fromStaffId: null,
      toStaffId: toStaff,
      wouldToStaffId: toStaff,
      reason: 'gdkd_assign_from_queue',
      decision: 'reassigned',
      notes: `actor=${actor}`,
      holdUntil: null,
      attemptCount: 0,
      jobRunId: `queue-${Date.now()}`,
      dryRun: false,
    });
    return { ok: true, lead_id: leadId, to_staff_id: toStaff };
  }

  async markInvalid(leadId: number, body: { notes?: string }, actor: string) {
    const row = await this.repo.getLeadDeskRow(leadId);
    if (!row) throw new NotFoundException({ error: 'lead_not_found' });
    const notes = String(body.notes || `gdkd_invalid:${actor}`).slice(0, 240);
    await this.repo.markInvalid(leadId, notes);
    await this.repo.insertReassignEvent({
      leadId,
      fromStaffId: row.owner_id != null ? Number(row.owner_id) : null,
      toStaffId: null,
      wouldToStaffId: null,
      reason: 'gdkd_mark_invalid',
      decision: 'invalid_path',
      notes,
      holdUntil: asDate(row.hold_until),
      attemptCount: Number(row.attempts_since_assign ?? 0),
      jobRunId: `invalid-${Date.now()}`,
      dryRun: false,
    });
    return { ok: true, lead_id: leadId };
  }

  private startOfSaigonDay(now: Date): Date {
    const offset = 7 * 3600_000;
    const local = new Date(now.getTime() + offset);
    const y = local.getUTCFullYear();
    const m = local.getUTCMonth();
    const d = local.getUTCDate();
    return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - offset);
  }
}
