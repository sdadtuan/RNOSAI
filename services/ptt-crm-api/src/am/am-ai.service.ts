import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AmAccountsService } from './am-accounts.service';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { amThrow } from './am-http';
import { amScopeSql, resolveAmScope } from './am-scope.util';
import { isUuid } from './am-tasks.service';
import type { AmScope } from './am.types';

export const AM_AI_KINDS = ['summary', 'health', 'qbr', 'followup'] as const;
export type AmAiKind = (typeof AM_AI_KINDS)[number];
export const AM_AI_RATINGS = ['up', 'down'] as const;
export type AmAiRating = (typeof AM_AI_RATINGS)[number];

export type AmAiReq = {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export type AmAiDraftBody = {
  agency_client_id?: string;
  kind?: string;
  prompt?: string;
};

export type AmAiFeedbackBody = {
  draft_id?: string;
  kind?: string;
  rating?: string;
};

export type AmAiEvidence = {
  agency_client_id: string;
  kind: AmAiKind;
  account_name: string | null;
  health_score: number | null;
  band: string | null;
  open_tasks_count: number;
  ends_on: string | null;
  prompt: string | null;
};

export type AmAiDraftResult = {
  draft: string;
  evidence: AmAiEvidence;
  draft_id: string;
};

export type AmAiDb = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export function isAmAiEnabled(raw = process.env.AM_AI_ENABLED): boolean {
  return /^(1|true|yes|on)$/i.test(String(raw ?? '').trim());
}

@Injectable()
export class AmAiRepository implements OnModuleDestroy, AmAiDb {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> {
    return this.db.query(sql, params);
  }
}

@Injectable()
export class AmAiService {
  constructor(
    private readonly db: AmAiRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly audit: AmAuditRepository,
    @Optional() _accounts?: AmAccountsService,
  ) {}

  status(): { enabled: boolean } {
    return { enabled: isAmAiEnabled() };
  }

  async draft(req: AmAiReq, body: AmAiDraftBody, actorStaffId: number): Promise<AmAiDraftResult> {
    this.assertEnabled();
    const kind = parseKind(body.kind);
    const clientId = requireClientId(body.agency_client_id);
    const prompt = String(body.prompt ?? '').trim() || null;
    const actor = await this.resolveActor(req);
    const scoped = await this.assertInScope(actor, clientId);
    const evidence = await this.loadEvidence(clientId, kind, scoped.name, prompt);
    const draft = renderDraft(evidence);
    const draft_id = randomUUID();
    await this.audit.insert({
      actor_staff_id: actorStaffId > 0 ? actorStaffId : null,
      action: 'ai.draft',
      entity_type: 'ai_draft',
      entity_id: draft_id,
      payload_json: { agency_client_id: clientId, kind, draft_id, evidence, ai_evidence_json: evidence },
    });
    return { draft, evidence, draft_id };
  }

  async feedback(
    req: AmAiReq,
    body: AmAiFeedbackBody,
    actorStaffId: number,
  ): Promise<{ ok: true }> {
    this.assertEnabled();
    const kind = parseKind(body.kind);
    const rating = parseRating(body.rating);
    const draftId = optionalDraftId(body.draft_id);
    await this.audit.insert({
      actor_staff_id: actorStaffId > 0 ? actorStaffId : null,
      action: 'ai.feedback',
      entity_type: 'ai_draft',
      entity_id: draftId,
      payload_json: { kind, rating, draft_id: draftId },
    });
    return { ok: true };
  }

  private assertEnabled(): void {
    if (!isAmAiEnabled()) amThrow(404, { error: 'ai_disabled' });
  }

  private async assertInScope(
    actor: { staffId: number; scope: AmScope; teamIds: number[] },
    clientId: string,
  ): Promise<{ agency_client_id: string; name: string | null }> {
    const bound = bindScopeSql(
      amScopeSql({ scope: actor.scope, staffId: actor.staffId, teamIds: actor.teamIds }),
      3,
    );
    let row: Record<string, unknown> | undefined;
    try {
      const result = await this.db.query(
        `SELECT e.agency_client_id::text AS agency_client_id,
                NULLIF(TRIM(COALESCE(c.name, '')), '') AS name
           FROM crm_am_account_ext e
          INNER JOIN clients c ON c.id = e.agency_client_id
          WHERE e.tenant_id = $1
            AND e.agency_client_id = $2::uuid
            AND ${bound.sql}
          LIMIT 1`,
        [AM_TENANT_ID, clientId, ...bound.params],
      );
      row = result.rows[0];
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
    }
    if (!row) amThrow(404, { error: 'not_found' });
    return {
      agency_client_id: String(row.agency_client_id),
      name: row.name == null ? null : String(row.name),
    };
  }

  private async loadEvidence(
    clientId: string,
    kind: AmAiKind,
    accountName: string | null,
    prompt: string | null,
  ): Promise<AmAiEvidence> {
    const [health, openTasks, endsOn] = await Promise.all([
      this.loadHealth(clientId),
      this.loadOpenTasks(clientId),
      this.loadEndsOn(clientId),
    ]);
    return {
      agency_client_id: clientId,
      kind,
      account_name: accountName,
      health_score: health.score,
      band: health.band,
      open_tasks_count: openTasks,
      ends_on: endsOn,
      prompt,
    };
  }

  private async loadHealth(clientId: string): Promise<{ score: number | null; band: string | null }> {
    try {
      const result = await this.db.query(
        `SELECT h.score, h.band
           FROM crm_am_health_snapshots h
          WHERE h.tenant_id = $1
            AND h.agency_client_id = $2::uuid
          ORDER BY h.as_of DESC
          LIMIT 1`,
        [AM_TENANT_ID, clientId],
      );
      const row = result.rows[0];
      if (!row) return { score: null, band: null };
      const score = num(row.score);
      return { score, band: row.band == null || row.band === '' ? null : String(row.band) };
    } catch (err) {
      if (isMissingRelation(err)) return { score: null, band: null };
      throw err;
    }
  }

  private async loadOpenTasks(clientId: string): Promise<number> {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS open_tasks_count
           FROM crm_am_tasks t
          WHERE t.agency_client_id = $1::uuid
            AND t.status NOT IN ('closed', 'cancelled', 'resolved')`,
        [clientId],
      );
      return Number(result.rows[0]?.open_tasks_count ?? 0) || 0;
    } catch (err) {
      if (isMissingRelation(err)) return 0;
      throw err;
    }
  }

  private async loadEndsOn(clientId: string): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT ct.ends_on
           FROM crm_contracts ct
          WHERE TRIM(COALESCE(ct.agency_client_id, '')) = $1
          ORDER BY ct.ends_on NULLS LAST
          LIMIT 1`,
        [clientId],
      );
      return dayStr(result.rows[0]?.ends_on);
    } catch (err) {
      if (isMissingRelation(err)) return null;
      throw err;
    }
  }

  private async resolveActor(
    req: AmAiReq,
  ): Promise<{ staffId: number; scope: AmScope; teamIds: number[] }> {
    const internal = req.staffAuthVia === 'internal';
    const staffId = req.staffUser
      ? ((await this.staffAuth.resolveCrmStaffUserId(req.staffUser)) ?? 0)
      : 0;
    if (internal && !req.staffUser) {
      return { staffId, scope: resolveAmScope({ requested: 'all', hasViewAll: true, canTeam: true }), teamIds: [] };
    }
    if (!req.staffUser) {
      return { staffId, scope: 'me', teamIds: [] };
    }
    const me = await this.staffAuth.me(req.staffUser);
    const has = (action: string) => this.staffAuth.hasCap(me.caps, 'crm_am', action);
    const hasViewAll = has('view_all') || has('manage');
    const canTeam = hasViewAll || has('assign');
    const scope = resolveAmScope({ requested: undefined, hasViewAll, canTeam });
    const teamIds = scope === 'team' ? await this.loadTeamIds(staffId) : [];
    return { staffId, scope, teamIds };
  }

  private async loadTeamIds(staffId: number): Promise<number[]> {
    if (staffId <= 0) return [];
    try {
      const result = await this.db.query(
        `SELECT t.id
           FROM crm_staff cs
           JOIN staff_users u ON lower(trim(u.email)) = lower(trim(cs.email))
           JOIN staff_user_teams sut ON sut.user_id = u.id
           JOIN staff_teams t ON t.id = sut.team_id AND t.active IS TRUE
          WHERE cs.id = $1`,
        [staffId],
      );
      return result.rows
        .map((row) => Number(row.id))
        .filter((n) => Number.isFinite(n) && n > 0);
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}

function parseKind(raw: string | undefined): AmAiKind {
  const kind = String(raw ?? '').trim().toLowerCase();
  if (!(AM_AI_KINDS as readonly string[]).includes(kind)) {
    amThrow(400, { error: 'invalid_kind' });
  }
  return kind as AmAiKind;
}

function parseRating(raw: string | undefined): AmAiRating {
  const rating = String(raw ?? '').trim().toLowerCase();
  if (!(AM_AI_RATINGS as readonly string[]).includes(rating)) {
    amThrow(400, { error: 'invalid_rating' });
  }
  return rating as AmAiRating;
}

function requireClientId(raw: string | undefined): string {
  const clientId = String(raw ?? '').trim();
  if (!clientId || !isUuid(clientId)) amThrow(404, { error: 'not_found' });
  return clientId;
}

function optionalDraftId(raw: string | undefined): string | null {
  const id = String(raw ?? '').trim();
  if (!id) return null;
  return isUuid(id) ? id : id;
}

function renderDraft(evidence: AmAiEvidence): string {
  const name = evidence.account_name || 'khách';
  const score = evidence.health_score == null ? '—' : String(evidence.health_score);
  const band = evidence.band || '—';
  const open = String(evidence.open_tasks_count);
  const ends = evidence.ends_on || '—';
  let body = '';
  if (evidence.kind === 'summary') {
    body = `Tóm tắt ${name}: health ${score} (${band}), ${open} việc mở, HĐ đến ${ends}.`;
  } else if (evidence.kind === 'health') {
    body = `Giải thích health: điểm ${score}, band ${band}.`;
  } else if (evidence.kind === 'qbr') {
    body = `QBR: health ${score} (${band}), ${open} việc mở, HĐ đến ${ends}.`;
  } else {
    body = `Follow-up: ${open} việc mở, health ${band}.`;
  }
  if (evidence.prompt) body += `\nPrompt: ${evidence.prompt}`;
  return body;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dayStr(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function bindScopeSql(
  fragment: { sql: string; params: unknown[] },
  startAt: number,
): { sql: string; params: unknown[] } {
  let sql = fragment.sql;
  const params: unknown[] = [];
  let i = startAt;
  if (sql.includes('$teams')) {
    sql = sql.replaceAll('$teams', `$${i++}`);
    params.push(fragment.params[0]);
    if (sql.includes('$staff')) {
      sql = sql.replaceAll('$staff', `$${i++}`);
      params.push(fragment.params[1] ?? fragment.params[0]);
    }
    return { sql, params };
  }
  if (sql.includes('$staff')) {
    sql = sql.replaceAll('$staff', `$${i}`);
    params.push(fragment.params[0]);
  }
  return { sql, params };
}

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e.code === '42P01' || /does not exist/i.test(e.message ?? '');
}
