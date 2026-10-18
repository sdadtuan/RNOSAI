import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { B2bManualReassignService } from '../b2b-projects/b2b-manual-reassign.service';
import type { ManualSplitChoice } from '../b2b-projects/b2b-manual-reassign.util';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
import { isAccountManagerPosition } from '../b2b-projects/b2b-director.util';
import { computeKanbanFirstContactSla, computeKanbanPriority, kanbanCardSettingsFromPayload } from '../leads/kanban-card.util';
import { maskLeadPhoneAndEmail } from '../staff-permissions/field-level.serializer';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { AeTeamRepository, type AeLeadRow } from './ae-team.repository';
import { careHistoryEventLabel, careHistoryReason } from './ae-care-history.util';
import { buildAePerformanceBoard, resolveAePerformanceMode, type AePerformanceLead } from './ae-performance.util';
import { rankAeMembers, rankingToCsv, type AeRankRow } from './ae-team-rank.util';
import {
  aeTeamColumnId,
  aeTeamRankWeights,
  aeTeamSuggestWeights,
  buildAeMemberStats,
  canSeeOwnRank,
  rankingPreset,
  aeTeamSettingsFromPayload,
  callResultFromContent,
  classifyAeIntervention,
  isAeHoldingStatus,
  leadNeed,
  reassignAuditRows,
  resolveAeTeamPeriod,
  scopeFromAccess,
  sortAeInterventions,
  suggestAeReceivers,
  type AeTeamLeadFact,
} from './ae-team.util';

function money(meta: Record<string, unknown>): number | null {
  for (const key of ['deal_value_vnd', 'expected_value']) {
    const n = Number(meta[key]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function fact(row: AeLeadRow): AeTeamLeadFact {
  return {
    id: row.id,
    status: row.status,
    receivedAt: row.received_at ?? row.created_at,
    updatedAt: row.updated_at,
    firstCallAt: row.first_call_at,
    lastCallAt: row.last_call_at,
    nextCallAt: row.next_call_at,
    hasCall: Boolean(row.last_call_at || row.first_call_at),
    source: row.source,
    channel: row.channel,
    need: leadNeed(row.meta_json),
    valueVnd: money(row.meta_json),
    callAttemptCount: row.call_attempt_count,
    lastCallResult: row.last_call_result,
  };
}

function monthKey(date: Date): string {
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  return `${local.getUTCFullYear()}-${m}`;
}

function inRange(value: string | null, period: { from: Date; to: Date }): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= period.from.getTime() && time <= period.to.getTime();
}

@Injectable()
export class AeTeamService {
  constructor(
    private readonly repo: AeTeamRepository,
    private readonly settings: LeadSlaSettingsService,
    private readonly staffAuth: StaffAuthService,
    private readonly reassignService: B2bManualReassignService,
    private readonly notifications: StaffNotificationsRepository,
  ) {}

  async summary(actor: StaffJwtPayload, query: { preset?: string; from?: string; to?: string }) {
    const scope = await this.scope(actor);
    const { period, rows } = await this.memberStats(
      scope.mode === 'all',
      scope.mode === 'teams' ? scope.teamIds : [],
      query,
    );
    rows.sort((a, b) => b.sla_breach - a.sla_breach || a.name.localeCompare(b.name, 'vi'));
    const open = rows.reduce((sum, row) => sum + row.open_leads, 0);
    const attention = rows.reduce((sum, row) => sum + row.attention, 0);
    const revenue = rows.reduce((sum, row) => sum + (row.revenue_vnd ?? 0), 0);
    const quota = rows.reduce((sum, row) => sum + (row.quota_vnd ?? 0), 0);
    const closed = rows.reduce((sum, row) => sum + (row.within_sla_pct == null ? 0 : 1), 0);
    const slaAvg = closed
      ? Math.round(rows.reduce((sum, row) => sum + (row.within_sla_pct ?? 0), 0) / closed)
      : null;
    return {
      period: { preset: period.preset, from: period.from.toISOString(), to: period.to.toISOString() },
      totals: {
        open_leads: open,
        within_sla_pct: slaAvg,
        attention,
        revenue_vnd: rows.some((row) => row.revenue_vnd != null) ? revenue : null,
        quota_vnd: rows.some((row) => row.quota_vnd != null) ? quota : null,
      },
      members: rows,
    };
  }

  private async performanceAudience(actor: StaffJwtPayload) {
    await this.repo.ensure();
    const me = await this.staffAuth.me(actor);
    const accountManager = isAccountManagerPosition(me.position_code);
    const memberTeams = accountManager ? await this.repo.memberTeamIds(actor.sub) : [];
    const leadTeams = await this.repo.leadTeamIds(actor.sub);
    const teamIds = [...new Set([...memberTeams, ...leadTeams])];
    const resolved = resolveAePerformanceMode({
      positionCode: me.position_code,
      accountManager,
      viewAllCap: hasCap(me.caps, 'crm_ae_team', 'view_all'),
      teamIds,
    });
    if (resolved.mode === 'deny') {
      throw new ForbiddenException({
        ok: false,
        error: { code: 'ae_performance_forbidden', message: 'Bạn không có quyền xem hiệu suất AE.' },
      });
    }
    const staffId = resolved.mode === 'team' || resolved.mode === 'self'
      ? await this.staffAuth.resolveCrmStaffUserId(actor)
      : null;
    const owners = await this.repo.listPerformanceOwners({
      mode: resolved.mode,
      teamIds: resolved.mode === 'team' ? teamIds : [],
      managerStaffId: resolved.mode === 'team' ? staffId : null,
      selfStaffId: resolved.mode === 'self' ? staffId : null,
    });
    return { ...resolved, owners };
  }

  async performance(actor: StaffJwtPayload, projectId?: string) {
    const audience = await this.performanceAudience(actor);
    const owners = audience.owners;
    const leads = await this.repo.listLeads(owners.map((owner) => owner.staff_id));
    const codes = await this.repo.listProjectCodes(
      [...new Set(leads.map((lead) => lead.b2b_project_id).filter((id): id is string => UUID_RE.test(id ?? '')))],
    );
    const payload = await this.settings.getPublishedPayload();
    const kanban = kanbanCardSettingsFromPayload(payload);
    const now = new Date();
    const facts = leads.map((lead) => this.performanceFact(lead, codes, kanban, now));
    const selected = projectId ? facts.filter((lead) => lead.projectId === projectId) : facts;
    const board = buildAePerformanceBoard(
      owners.map((owner) => ({ staffId: owner.staff_id, name: owner.name, code: owner.code })),
      selected,
    );
    const projects = buildAePerformanceBoard(
      owners.map((owner) => ({ staffId: owner.staff_id, name: owner.name, code: owner.code })),
      facts,
    ).projects;
    return {
      scope: audience.mode,
      note: audience.note,
      project_id: projectId || null,
      ...board,
      projects,
    };
  }

  async careHistory(actor: StaffJwtPayload) {
    const audience = await this.performanceAudience(actor);
    const rows = await this.repo.listCareHistory(audience.owners.map((owner) => owner.staff_id));
    const notes: Record<string, string> = {
      all: 'Toàn bộ lead AE đã từng được gán hoặc bị thu hồi.',
      team: 'Lead của AE trong team: đã gán, đang giữ, bị thu hồi.',
      project: 'Lead của AE đang tham gia dự án: đã gán, đang giữ, bị thu hồi.',
      self: 'Lead bạn đã từng chăm sóc: đã gán, đang giữ, bị thu hồi.',
    };
    return {
      scope: audience.mode,
      note: notes[audience.mode] ?? notes.self,
      rows: rows.map((row) => ({
        id: row.id,
        lead_id: row.lead_id,
        lead_name: row.lead_name,
        status: row.status,
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        staff_code: row.staff_code,
        event: row.event,
        event_label: careHistoryEventLabel(row.event),
        reason: careHistoryReason(row.reason),
        at: row.at,
      })),
    };
  }

  async ranking(actor: StaffJwtPayload, grain?: string) {
    const preset = rankingPreset(grain);
    const data = await this.summary(actor, { preset });
    const payload = await this.settings.getPublishedPayload();
    return {
      grain: preset === 'today' ? 'day' : preset,
      rows: this.rankRows(data.members, payload),
    };
  }

  async rankingCsv(actor: StaffJwtPayload, grain?: string): Promise<string> {
    const data = await this.ranking(actor, grain);
    return rankingToCsv(data.rows);
  }

  async meRank(actor: StaffJwtPayload, grain?: string) {
    const payload = await this.settings.getPublishedPayload();
    const settings = aeTeamSettingsFromPayload(payload);
    const staffId = await this.staffAuth.resolveCrmStaffUserId(actor);
    const preset = rankingPreset(grain);
    let rows: AeRankRow[];
    try {
      rows = (await this.ranking(actor, grain)).rows;
    } catch (err) {
      if (!(err instanceof ForbiddenException) || !canSeeOwnRank(false, settings.show_rank_to_ae)) throw err;
      const teamIds = await this.repo.memberTeamIds(actor.sub);
      if (!teamIds.length || staffId == null) {
        throw new NotFoundException({ ok: false, error: { code: 'ae_not_ranked', message: 'Bạn chưa có hạng trong đội.' } });
      }
      rows = this.rankRows((await this.memberStats(false, teamIds, { preset })).rows, payload);
    }
    const mine = rows.find((row) => row.staff_id === staffId);
    if (!mine) {
      throw new NotFoundException({ ok: false, error: { code: 'ae_not_ranked', message: 'Bạn chưa có hạng trong đội.' } });
    }
    return {
      rank: mine.rank,
      staff_id: mine.staff_id,
      name: mine.name,
      score: mine.score,
      total: rows.length,
      grain: preset === 'today' ? 'day' : preset,
    };
  }

  private rankRows(members: Array<{ staff_id: number; name: string; within_sla_pct: number | null; answer_pct: number | null; quote_to_won_pct: number | null; attainment_pct: number | null }>, payload: unknown): AeRankRow[] {
    return rankAeMembers(members.map((member) => ({
      staffId: member.staff_id,
      name: member.name,
      slaPct: member.within_sla_pct,
      callPct: member.answer_pct,
      conversionPct: member.quote_to_won_pct,
      revenuePct: member.attainment_pct,
    })), aeTeamRankWeights(payload));
  }

  private async memberStats(viewAll: boolean, teamIds: number[], query: { preset?: string; from?: string; to?: string }) {
    const now = new Date();
    const period = resolveAeTeamPeriod(query.preset, query.from, query.to, now);
    const payload = await this.settings.getPublishedPayload();
    const kanban = kanbanCardSettingsFromPayload(payload);
    const thresholds = aeTeamSettingsFromPayload(payload);
    const members = await this.repo.listMembers({ viewAll, teamIds, month: monthKey(now) });
    const ownerIds = members.map((member) => member.staff_id);
    const leads = await this.repo.listLeads(ownerIds);
    const calls = await this.repo.listCalls(ownerIds, period.from, period.to);
    const rows = members.map((member) => {
      const stats = buildAeMemberStats({
        leads: leads.filter((lead) => lead.owner_id === member.staff_id).map(fact),
        calls: calls.filter((call) => call.owner_id === member.staff_id),
        kanban,
        thresholds,
        now,
        period,
        quotaVnd: member.quota_vnd,
      });
      return { staff_id: member.staff_id, name: member.name, accepting: member.accepting, ...stats };
    });
    return { period, rows };
  }

  async member(actor: StaffJwtPayload, staffId: number, query: { preset?: string; from?: string; to?: string }) {
    const data = await this.summary(actor, query);
    const row = data.members.find((member) => member.staff_id === staffId);
    if (!row) throw this.denied();
    const timeline = await this.repo.timeline(staffId);
    const leads = await this.repo.listLeads([staffId]);
    const calls = await this.repo.listCalls([staffId], new Date(Date.now() - 30 * 86_400_000), new Date());
    const payload = await this.settings.getPublishedPayload();
    return {
      member: row,
      timeline,
      series: this.series(leads, calls, kanbanCardSettingsFromPayload(payload)),
    };
  }

  async leads(actor: StaffJwtPayload, staffId: number, viewerStaffId: number | null) {
    await this.member(actor, staffId, { preset: 'today' });
    const leads = await this.repo.listLeads([staffId]);
    const payload = await this.settings.getPublishedPayload();
    const kanban = kanbanCardSettingsFromPayload(payload);
    return leads.map((lead) => {
      const statsLead = fact(lead);
      const visible = viewerStaffId != null && viewerStaffId === lead.owner_id;
      const masked = visible ? lead : maskLeadPhoneAndEmail(lead);
      const built = buildAeMemberStats({
        leads: [statsLead],
        calls: [],
        kanban,
        thresholds: aeTeamSettingsFromPayload(payload),
        now: new Date(),
        period: resolveAeTeamPeriod('today', undefined, undefined, new Date()),
        quotaVnd: null,
      });
      return {
        id: lead.id,
        full_name: lead.full_name,
        phone: masked.phone,
        email: masked.email,
        status: lead.status,
        source: lead.source,
        channel: lead.channel,
        client_id: lead.client_id,
        owner_id: lead.owner_id,
        b2b_project_id: lead.b2b_project_id,
        created_at: lead.created_at ?? '',
        received_at: lead.received_at ?? lead.created_at ?? '',
        is_duplicate: false,
        lead_flow_kind: 'b2b_prospect',
        expected_value: money(lead.meta_json),
        stale: built.stale > 0,
        sla_state: built.sla_breach > 0 ? 'breach' : built.sla_warning > 0 ? 'warning' : 'ok',
        next_call_at: lead.next_call_at,
      };
    });
  }

  private series(
    leads: AeLeadRow[],
    calls: Array<{ at: string; content: string }>,
    kanban: ReturnType<typeof kanbanCardSettingsFromPayload>,
  ): Array<{ day: string; within_sla_pct: number | null; calls: number; conversion_pct: number | null }> {
    const days: Array<{ day: string; within_sla_pct: number | null; calls: number; conversion_pct: number | null }> = [];
    const now = new Date();
    for (let offset = 29; offset >= 0; offset -= 1) {
      const day = new Date(now.getTime() - offset * 86_400_000);
      const period = resolveAeTeamPeriod('custom', ictDate(day), ictDate(day), now);
      const dayCalls = calls.filter((call) => {
        const at = new Date(call.at);
        return at >= period.from && at <= period.to;
      });
      const stats = buildAeMemberStats({
        leads: leads.map(fact),
        calls: dayCalls,
        kanban,
        thresholds: aeTeamSettingsFromPayload({}),
        now,
        period,
        quotaVnd: null,
      });
      days.push({
        day: ictDate(day),
        within_sla_pct: stats.within_sla_pct,
        calls: dayCalls.length,
        conversion_pct: stats.lead_to_quote_pct,
      });
    }
    return days;
  }

  async interventions(actor: StaffJwtPayload) {
    const scope = await this.scope(actor);
    const now = new Date();
    const payload = await this.settings.getPublishedPayload();
    const kanban = kanbanCardSettingsFromPayload(payload);
    const thresholds = aeTeamSettingsFromPayload(payload);
    const members = await this.repo.listMembers({
      viewAll: scope.mode === 'all',
      teamIds: scope.mode === 'teams' ? scope.teamIds : [],
      month: monthKey(now),
    });
    const leads = await this.repo.listLeads(members.map((member) => member.staff_id));
    const calls = await this.repo.listCallContents(leads.map((lead) => lead.id));
    const names = new Map(members.map((member) => [member.staff_id, member.name]));
    const items = leads.flatMap((lead) => {
      const results = (calls.get(lead.id) ?? [])
        .map((content) => callResultFromContent(content))
        .filter((code): code is string => Boolean(code));
      const hit = classifyAeIntervention({ ...fact(lead), callResults: results }, kanban, thresholds, now);
      if (!hit) return [];
      return [{
        lead_id: lead.id,
        name: lead.full_name,
        owner_id: lead.owner_id,
        owner_name: names.get(lead.owner_id) ?? '',
        status: lead.status,
        b2b_project_id: lead.b2b_project_id,
        requires_split: Boolean(lead.b2b_project_id),
        ...hit,
      }];
    });
    return { items: sortAeInterventions(items) };
  }

  async remind(actor: StaffJwtPayload, body: { lead_ids?: number[]; note?: string }) {
    const note = String(body.note ?? '').trim();
    if (!note) throw this.bad('note_required', 'Cần nội dung nhắc.');
    const ids = this.leadIds(body.lead_ids);
    const members = await this.memberIndex(actor);
    let sent = 0;
    for (const id of ids) {
      const lead = await this.leadInTeam(id, members);
      await this.repo.insertActivity(id, 'ae_remind', note, actor.email);
      await this.bell(lead.owner_id, {
        kind: 'ae_remind',
        title: 'Nhắc lead',
        body: note,
        link_href: `/crm/leads/${id}`,
      });
      sent += 1;
    }
    return { sent };
  }

  async instruct(actor: StaffJwtPayload, body: { lead_id?: number; note?: string }) {
    const note = String(body.note ?? '').trim();
    if (!note) throw this.bad('note_required', 'Cần nội dung chỉ đạo.');
    const leadId = Number(body.lead_id);
    if (!Number.isFinite(leadId) || leadId <= 0) throw this.bad('lead_required', 'Cần chọn lead.');
    const members = await this.memberIndex(actor);
    const lead = await this.leadInTeam(leadId, members);
    const id = await this.repo.insertActivity(leadId, 'am_instruction', note, actor.email);
    await this.bell(lead.owner_id, {
      kind: 'am_instruction',
      title: 'Ghi chú chỉ đạo',
      body: note,
      link_href: `/crm/leads/${leadId}`,
    });
    return { id };
  }

  async markInstructionRead(actor: StaffJwtPayload, activityId: number) {
    await this.repo.ensure();
    const row = await this.repo.instructionOwner(activityId);
    if (!row) throw new NotFoundException({ ok: false, error: { code: 'instruction_not_found', message: 'Không thấy ghi chú.' } });
    const viewer = await this.staffAuth.resolveCrmStaffUserId(actor);
    let allowed = viewer != null && viewer === row.owner_id;
    if (!allowed) {
      try {
        const members = await this.memberIndex(actor);
        allowed = members.has(row.owner_id);
      } catch {
        allowed = false;
      }
    }
    if (!allowed) throw this.denied();
    await this.repo.markInstructionRead(activityId, row.owner_id);
    return { read: true };
  }

  async setIntake(actor: StaffJwtPayload, body: { staff_id?: number; accepting?: boolean; note?: string }) {
    const staffId = Number(body.staff_id);
    const members = await this.memberIndex(actor);
    if (!members.has(staffId)) {
      throw new NotFoundException({ ok: false, error: { code: 'ae_not_in_team', message: 'AE không thuộc đội này.' } });
    }
    const viewer = await this.staffAuth.resolveCrmStaffUserId(actor);
    await this.repo.setIntake(staffId, Boolean(body.accepting), String(body.note ?? ''), viewer);
    return { staff_id: staffId, accepting: Boolean(body.accepting) };
  }

  async suggest(actor: StaffJwtPayload, leadId: number, query: { preset?: string; from?: string; to?: string }) {
    const scope = await this.scope(actor);
    const now = new Date();
    const period = resolveAeTeamPeriod(query.preset, query.from, query.to, now);
    const payload = await this.settings.getPublishedPayload();
    const members = await this.repo.listMembers({
      viewAll: scope.mode === 'all',
      teamIds: scope.mode === 'teams' ? scope.teamIds : [],
      month: monthKey(now),
    });
    const lead = await this.leadInTeam(leadId, new Map(members.map((member) => [member.staff_id, member.name])));
    const leads = await this.repo.listLeads(members.map((member) => member.staff_id));
    const enabled = lead.b2b_project_id ? await this.repo.assignEnabledStaffIds(lead.b2b_project_id) : null;
    const rows = suggestAeReceivers({
      weights: aeTeamSuggestWeights(payload),
      excludeStaffId: lead.owner_id,
      rows: members.map((member) => {
        const owned = leads.filter((item) => item.owner_id === member.staff_id);
        const received = owned.filter((item) => inRange(item.received_at ?? item.created_at, period));
        const won = received.filter((item) => aeTeamColumnId(item.status) === 'won').length;
        return {
          staffId: member.staff_id,
          name: member.name,
          accepting: member.accepting,
          assignEnabled: enabled ? enabled.has(member.staff_id) : true,
          openLeads: owned.filter((item) => isAeHoldingStatus(item.status)).length,
          winRate: received.length ? won / received.length : null,
        };
      }),
    });
    return { lead_id: leadId, suggestions: rows };
  }

  async reassign(
    actor: StaffJwtPayload,
    body: { lead_ids?: number[]; to_staff_id?: number; reason?: string; split?: ManualSplitChoice },
  ) {
    const reason = String(body.reason ?? '').trim();
    if (!reason) throw this.bad('reason_required', 'Cần lý do chuyển.');
    const ids = this.leadIds(body.lead_ids);
    const toStaffId = Number(body.to_staff_id);
    const members = await this.memberIndex(actor);
    if (!members.has(toStaffId)) {
      throw new NotFoundException({ ok: false, error: { code: 'ae_not_in_team', message: 'AE nhận không thuộc đội này.' } });
    }
    const planned: Array<{ id: number; fromOwnerId: number; projectId: string | null; flow: string | null; needsSplit: boolean }> = [];
    for (const id of ids) {
      const lead = await this.leadInTeam(id, members);
      if (lead.owner_id === toStaffId) continue;
      const needsSplit = this.reassignService.requiresSplitChoice({
        b2b_project_id: lead.b2b_project_id,
        lead_flow_kind: lead.lead_flow_kind,
      });
      if (needsSplit && !body.split) throw this.bad('split_required', 'Lead đang trong dự án B2B. Cần chọn cách chia hoa hồng.');
      planned.push({
        id,
        fromOwnerId: lead.owner_id,
        projectId: lead.b2b_project_id,
        flow: lead.lead_flow_kind,
        needsSplit,
      });
    }
    const audit = reassignAuditRows({
      leads: planned.map((lead) => ({ id: lead.id, fromOwnerId: lead.fromOwnerId })),
      toStaffId,
      reason,
      assignedBy: actor.email,
    });
    for (let index = 0; index < planned.length; index += 1) {
      const lead = planned[index];
      if (lead.needsSplit && lead.projectId) {
        await this.reassignService.applyManualOwnerChange({
          leadId: lead.id,
          projectId: lead.projectId,
          fromOwnerId: lead.fromOwnerId,
          toOwnerId: toStaffId,
          split: body.split as ManualSplitChoice,
          reason,
        });
      } else {
        await this.repo.updateOwner(lead.id, toStaffId);
      }
      await this.repo.insertAssignmentLog(audit[index]);
    }
    return { moved: audit.length };
  }

  private performanceFact(
    row: AeLeadRow,
    codes: Map<string, string>,
    kanban: ReturnType<typeof kanbanCardSettingsFromPayload>,
    now: Date,
  ): AePerformanceLead {
    const receivedAt = parseStamp(row.received_at) ?? parseStamp(row.created_at);
    const status = row.status.trim().toLowerCase();
    const stillNew = status === 'moi' || status === 'new' || status === 'intake';
    const columnSince = stillNew ? receivedAt : parseStamp(row.updated_at) ?? receivedAt;
    const sla = computeKanbanFirstContactSla({
      status: row.status,
      receivedAt,
      columnSince,
      hasCall: Boolean(row.last_call_at || row.first_call_at),
      now,
      settings: kanban,
    });
    const score = Number(row.meta_json?.lead_score);
    return {
      ownerId: row.owner_id,
      status: row.status,
      projectId: row.b2b_project_id,
      projectCode: row.b2b_project_id ? codes.get(row.b2b_project_id) ?? null : null,
      hot: computeKanbanPriority({
        source: row.source,
        channel: row.channel,
        need: leadNeed(row.meta_json),
        receivedAt,
        now,
        settings: kanban,
      }) === 'hot',
      slaBreach: sla.state === 'breach',
      score: Number.isFinite(score) ? score : null,
    };
  }

  private leadIds(ids: number[] | undefined): number[] {
    const clean = [...new Set((ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (!clean.length) throw this.bad('lead_ids_required', 'Cần chọn ít nhất một lead.');
    return clean;
  }

  private async memberIndex(actor: StaffJwtPayload): Promise<Map<number, string>> {
    const scope = await this.scope(actor);
    const members = await this.repo.listMembers({
      viewAll: scope.mode === 'all',
      teamIds: scope.mode === 'teams' ? scope.teamIds : [],
      month: monthKey(new Date()),
    });
    return new Map(members.map((member) => [member.staff_id, member.name]));
  }

  private async leadInTeam(leadId: number, members: Map<number, string>) {
    const lead = await this.repo.getLeadForMove(leadId);
    if (!lead || !members.has(lead.owner_id)) {
      throw new NotFoundException({ ok: false, error: { code: 'lead_not_in_team', message: 'Lead không thuộc đội này.' } });
    }
    return lead;
  }

  private async bell(staffId: number, input: { kind: string; title: string; body: string; link_href: string }) {
    const userId = await this.repo.staffUserId(staffId);
    if (!userId) return;
    await this.notifications.create({ user_id: userId, ...input });
  }

  private bad(code: string, message: string): BadRequestException {
    return new BadRequestException({ ok: false, error: { code, message } });
  }

  private async scope(actor: StaffJwtPayload): Promise<{ mode: 'all' } | { mode: 'teams'; teamIds: number[] }> {
    await this.repo.ensure();
    const me = await this.staffAuth.me(actor);
    const viewAll = hasCap(me.caps, 'crm_ae_team', 'view_all');
    const teamIds = viewAll ? [] : await this.repo.leadTeamIds(actor.sub);
    const scope = scopeFromAccess(viewAll, teamIds);
    if (scope.mode === 'deny') throw this.denied();
    return scope;
  }

  private denied(): ForbiddenException {
    return new ForbiddenException({
      ok: false,
      error: { code: 'ae_team_forbidden', message: 'Bạn không có quyền xem đội AE này.' },
    });
  }
}

function hasCap(caps: StaffSectionCap[], section: string, action: string): boolean {
  return caps.some((cap) => cap.section === section && cap.action === action);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseStamp(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function ictDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}
