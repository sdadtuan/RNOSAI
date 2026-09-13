import { Inject, Injectable } from '@nestjs/common';
import { CP_TENANT_ID } from './cp-audit.repository';
import type {
  ImgGateInsert,
  ImgJobInsert,
  ImgJobRow,
  ImgJobStageRow,
  ImgProjectInsert,
  ImgProjectRow,
  ImgQualityInsert,
  ImgSopRow,
  ImgStageInsert,
} from './cp-image-sop.types';

export const CP_IMAGE_SOP_QUERY = 'CP_IMAGE_SOP_QUERY';

export type CpImageSopQueryPort = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

@Injectable()
export class CpImageSopRepository implements CpImageSopQueryPort {
  constructor(@Inject(CP_IMAGE_SOP_QUERY) private readonly db: CpImageSopQueryPort) {}

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  async listSops(tenantId: string = CP_TENANT_ID): Promise<ImgSopRow[]> {
    const result = await this.query(
      `SELECT r.id, r.code, r.name, r.category, r.status, r.risk_tier, r.data_class,
              v.version, v.id AS version_id,
              v.manifest_json->>'primary_intent' AS intent
         FROM img_sop_registry r
         LEFT JOIN LATERAL (
           SELECT id, version, manifest_json
             FROM img_sop_versions
            WHERE sop_id = r.id
            ORDER BY published_at DESC NULLS LAST, version DESC
            LIMIT 1
         ) v ON true
        WHERE r.tenant_id = $1
        ORDER BY r.code`,
      [tenantId],
    );
    return result.rows.map(mapSopRow);
  }

  async getSop(id: string): Promise<ImgSopRow | null> {
    const result = await this.query(
      `SELECT r.id, r.code, r.name, r.category, r.status, r.risk_tier, r.data_class,
              v.version, v.id AS version_id,
              v.manifest_json->>'primary_intent' AS intent
         FROM img_sop_registry r
         LEFT JOIN LATERAL (
           SELECT id, version, manifest_json
             FROM img_sop_versions
            WHERE sop_id = r.id
            ORDER BY published_at DESC NULLS LAST, version DESC
            LIMIT 1
         ) v ON true
        WHERE r.id = $1::uuid
        LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapSopRow(result.rows[0]) : null;
  }

  async insertProject(row: ImgProjectInsert): Promise<ImgProjectRow> {
    const result = await this.query(
      `INSERT INTO img_projects (
         tenant_id, cp_project_id, agency_client_id, service_lifecycle_id,
         sop_version_id, name, brief_json, created_by_staff_id
       ) VALUES ($1, $2::uuid, $3, $4::uuid, $5::uuid, $6, $7::jsonb, $8)
       RETURNING *`,
      [
        CP_TENANT_ID,
        row.cp_project_id ?? null,
        row.agency_client_id,
        row.service_lifecycle_id ?? null,
        row.sop_version_id ?? null,
        row.name,
        JSON.stringify(row.brief_json ?? {}),
        row.created_by_staff_id,
      ],
    );
    return mapProjectRow(result.rows[0]);
  }

  async listProjectsForBoard(scope: {
    staffId: number;
    scope: 'me' | 'team' | 'all';
  }): Promise<ImgProjectRow[]> {
    let sql = `SELECT * FROM img_projects WHERE tenant_id = $1`;
    const params: unknown[] = [CP_TENANT_ID];
    if (scope.scope === 'me') {
      params.push(scope.staffId);
      sql += ` AND created_by_staff_id = $${params.length}`;
    }
    sql += ` ORDER BY updated_at DESC`;
    const result = await this.query(sql, params);
    return result.rows.map(mapProjectRow);
  }

  async getProject(id: string): Promise<ImgProjectRow | null> {
    const result = await this.query(
      `SELECT * FROM img_projects WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
  }

  async insertJob(row: ImgJobInsert): Promise<ImgJobRow> {
    const result = await this.query(
      `INSERT INTO img_jobs (
         project_id, frame_id, provider, route_decision_json, state,
         estimate_credits, idempotency_key
       ) VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [
        row.project_id,
        row.frame_id ?? null,
        row.provider,
        JSON.stringify(row.route_decision_json ?? {}),
        row.state ?? 'DRAFT',
        row.estimate_credits ?? null,
        row.idempotency_key,
      ],
    );
    if (result.rows[0]) return mapJobRow(result.rows[0]);
    const existing = await this.query(
      `SELECT * FROM img_jobs WHERE idempotency_key = $1 LIMIT 1`,
      [row.idempotency_key],
    );
    return mapJobRow(existing.rows[0]);
  }

  async listJobs(): Promise<ImgJobRow[]> {
    const result = await this.query(
      `SELECT j.*, f.winner_asset_id, f.intent, f.format_pack_json
         FROM img_jobs j
         LEFT JOIN img_frames f ON f.id = j.frame_id
        ORDER BY j.created_at DESC`,
    );
    return result.rows.map(mapJobRow);
  }

  async getJob(id: string): Promise<ImgJobRow | null> {
    const result = await this.query(
      `SELECT j.*, f.winner_asset_id, f.intent, f.format_pack_json
         FROM img_jobs j
         LEFT JOIN img_frames f ON f.id = j.frame_id
        WHERE j.id = $1::uuid
        LIMIT 1`,
      [id],
    );
    return result.rows[0] ? mapJobRow(result.rows[0]) : null;
  }

  async insertStage(row: ImgStageInsert): Promise<ImgJobStageRow> {
    const result = await this.query(
      `INSERT INTO img_job_stages (
         job_id, stage, sort_order, capability, provider, state,
         cp_render_job_id, estimate_credits
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8)
       RETURNING *`,
      [
        row.job_id,
        row.stage,
        row.sort_order,
        row.capability,
        row.provider,
        row.state ?? 'PENDING',
        row.cp_render_job_id ?? null,
        row.estimate_credits ?? null,
      ],
    );
    return mapStageRow(result.rows[0]);
  }

  async updateJobWinner(jobId: string, assetId: string): Promise<void> {
    await this.query(
      `UPDATE img_frames
          SET winner_asset_id = $2::uuid
        WHERE id = (SELECT frame_id FROM img_jobs WHERE id = $1::uuid)`,
      [jobId, assetId],
    );
  }

  async updateFormatPack(frameId: string, pack: Record<string, unknown>): Promise<void> {
    await this.query(
      `UPDATE img_frames SET format_pack_json = $2::jsonb WHERE id = $1::uuid`,
      [frameId, JSON.stringify(pack)],
    );
  }

  async insertQuality(row: ImgQualityInsert): Promise<void> {
    await this.query(
      `INSERT INTO img_quality_results (asset_id, profile_key, scores_json, decision)
       VALUES ($1::uuid, $2, $3::jsonb, $4)`,
      [row.asset_id, row.profile_key, JSON.stringify(row.scores_json), row.decision],
    );
  }

  async insertGateLog(row: ImgGateInsert): Promise<void> {
    await this.query(
      `INSERT INTO img_gate_logs (project_id, gate_num, action, actor_staff_id, checklist_json)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`,
      [
        row.project_id,
        row.gate_num,
        row.action,
        row.actor_staff_id,
        JSON.stringify(row.checklist_json ?? {}),
      ],
    );
  }

  async updateProjectGate(
    projectId: string,
    gateNum: 1 | 2 | 3,
  ): Promise<void> {
    const col = gateNum === 1 ? 'g1_at' : gateNum === 2 ? 'g2_at' : 'g3_at';
    await this.query(
      `UPDATE img_projects SET ${col} = now(), updated_at = now() WHERE id = $1::uuid`,
      [projectId],
    );
  }

  async insertSop(input: {
    code: string;
    name: string;
    category: string;
    data_class: string;
    owner_staff_id: number;
  }): Promise<{ id: string }> {
    const result = await this.query(
      `INSERT INTO img_sop_registry (code, name, category, data_class, owner_staff_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, code) DO NOTHING
       RETURNING id`,
      [input.code, input.name, input.category, input.data_class, input.owner_staff_id],
    );
    if (result.rows[0]) return { id: String(result.rows[0].id) };
    const existing = await this.query(
      `SELECT id FROM img_sop_registry WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [CP_TENANT_ID, input.code],
    );
    return { id: String(existing.rows[0]?.id ?? '') };
  }

  async insertSopVersion(input: {
    sop_id: string;
    version: string;
    manifest_json: Record<string, unknown>;
    prompt_package_id?: string | null;
  }): Promise<{ version_id: string }> {
    const result = await this.query(
      `INSERT INTO img_sop_versions (sop_id, version, manifest_json, prompt_package_id)
       VALUES ($1::uuid, $2, $3::jsonb, $4::uuid)
       ON CONFLICT (sop_id, version) DO UPDATE
         SET manifest_json = EXCLUDED.manifest_json,
             prompt_package_id = EXCLUDED.prompt_package_id
       RETURNING id`,
      [
        input.sop_id,
        input.version,
        JSON.stringify(input.manifest_json),
        input.prompt_package_id ?? null,
      ],
    );
    return { version_id: String(result.rows[0].id) };
  }

  async insertFrame(input: {
    project_id: string;
    intent: string;
    aspect_ratio: string;
    label: string;
    variant_target: number;
    creative_genome_json?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const result = await this.query(
      `INSERT INTO img_frames (
         project_id, label, aspect_ratio, intent, variant_target, creative_genome_json
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        input.project_id,
        input.label,
        input.aspect_ratio,
        input.intent,
        input.variant_target,
        JSON.stringify(input.creative_genome_json ?? {}),
      ],
    );
    return { id: String(result.rows[0].id) };
  }

  async countApprovedAssets(from: Date, to: Date): Promise<number | null> {
    const result = await this.query(
      `SELECT COUNT(*)::int AS cnt
         FROM crm_cp_assets
        WHERE provenance LIKE 'image_sop%'
          AND status = 'approved'
          AND created_at >= $1 AND created_at < $2`,
      [from.toISOString(), to.toISOString()],
    );
    if (!result.rows[0]) return null;
    return Number(result.rows[0].cnt);
  }

  async sumLedgerImageSop(): Promise<number | null> {
    const result = await this.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS total
         FROM crm_cp_credit_ledger
        WHERE idempotency_key LIKE 'image_sop:%' OR cost_center LIKE 'image_sop:%'`,
    );
    if (!result.rows[0]) return null;
    return Number(result.rows[0].total);
  }

  async avgBriefToApprovedHours(): Promise<number | null> {
    const result = await this.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (g3_at - created_at)) / 3600.0) AS avg_hours
         FROM img_projects
        WHERE g3_at IS NOT NULL`,
    );
    const val = result.rows[0]?.avg_hours;
    if (val == null) return null;
    return Number(val);
  }

  async countExploredStages(): Promise<number | null> {
    const result = await this.query(
      `SELECT COUNT(*)::int AS cnt
         FROM img_job_stages
        WHERE stage = 'explore' AND state = 'COMPLETED'`,
    );
    if (!result.rows[0]) return null;
    return Number(result.rows[0].cnt);
  }

  async listImageAssets(): Promise<Array<{ id: string; filename: string; status: string }>> {
    const result = await this.query(
      `SELECT id, filename, status
         FROM crm_cp_assets
        WHERE provenance LIKE 'image_sop%'
        ORDER BY created_at DESC
        LIMIT 200`,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      filename: String(row.filename ?? '—'),
      status: String(row.status ?? 'unknown'),
    }));
  }

  async listBrandRules(kitId: string): Promise<Array<{ rule_key: string; enforcement: string }>> {
    const result = await this.query(
      `SELECT rule_key, enforcement
         FROM img_brand_rules
        WHERE brand_kit_id = $1::uuid
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY effective_at DESC`,
      [kitId],
    );
    return result.rows.map((row) => ({
      rule_key: String(row.rule_key),
      enforcement: String(row.enforcement),
    }));
  }

  async getBrandKit(kitId: string): Promise<{ id: string; name: string } | null> {
    const result = await this.query(
      `SELECT id, name FROM crm_cp_brand_kits WHERE id = $1::uuid LIMIT 1`,
      [kitId],
    );
    if (!result.rows[0]) return null;
    return { id: String(result.rows[0].id), name: String(result.rows[0].name) };
  }

  async listGovernanceAudit(): Promise<Array<{ at: string; title: string; detail: string }>> {
    const result = await this.query(
      `SELECT created_at, action, checklist_json
         FROM img_gate_logs
        ORDER BY created_at DESC
        LIMIT 100`,
    );
    const gateRows = result.rows.map((row) => ({
      at: String(row.created_at),
      title: `Gate log: ${String(row.action)}`,
      detail: JSON.stringify(row.checklist_json ?? {}),
    }));
    const audit = await this.query(
      `SELECT created_at, action, payload_json
         FROM crm_cp_audit
        WHERE entity_type = 'image_sop'
        ORDER BY created_at DESC
        LIMIT 50`,
    );
    const auditRows = audit.rows.map((row) => ({
      at: String(row.created_at),
      title: String(row.action),
      detail: JSON.stringify(row.payload_json ?? {}),
    }));
    return [...gateRows, ...auditRows].sort((a, b) => b.at.localeCompare(a.at));
  }

  async countMagnificConnections(): Promise<number> {
    const result = await this.query(
      `SELECT COUNT(*)::int AS cnt
         FROM crm_cp_provider_connections
        WHERE provider IN ('magnific_rest', 'magnific_mcp')
          AND status = 'active'`,
    );
    return Number(result.rows[0]?.cnt ?? 0);
  }

  async finopsByProvider(): Promise<Array<{ provider: string; credits: number | null }>> {
    const result = await this.query(
      `SELECT COALESCE(provider, 'unknown') AS provider, SUM(amount)::int AS credits
         FROM crm_cp_credit_ledger
        WHERE idempotency_key LIKE 'image_sop:%' OR cost_center LIKE 'image_sop:%'
        GROUP BY provider`,
    );
    return result.rows.map((row) => ({
      provider: String(row.provider),
      credits: row.credits == null ? null : Number(row.credits),
    }));
  }
}

function mapSopRow(row: Record<string, unknown>): ImgSopRow {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    category: String(row.category),
    status: String(row.status),
    risk_tier: String(row.risk_tier),
    data_class: String(row.data_class),
    version: row.version == null ? null : String(row.version),
    version_id: row.version_id == null ? null : String(row.version_id),
    intent: row.intent == null ? null : String(row.intent),
  };
}

function mapProjectRow(row: Record<string, unknown>): ImgProjectRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    cp_project_id: row.cp_project_id == null ? null : String(row.cp_project_id),
    agency_client_id: Number(row.agency_client_id),
    service_lifecycle_id:
      row.service_lifecycle_id == null ? null : String(row.service_lifecycle_id),
    sop_version_id: row.sop_version_id == null ? null : String(row.sop_version_id),
    name: String(row.name),
    status: String(row.status),
    brief_json: parseJson(row.brief_json),
    brand_kit_id: row.brand_kit_id == null ? null : String(row.brand_kit_id),
    g1_at: row.g1_at == null ? null : String(row.g1_at),
    g2_at: row.g2_at == null ? null : String(row.g2_at),
    g3_at: row.g3_at == null ? null : String(row.g3_at),
    created_by_staff_id: Number(row.created_by_staff_id),
    created_at: String(row.created_at),
  };
}

function mapJobRow(row: Record<string, unknown>): ImgJobRow {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    frame_id: row.frame_id == null ? null : String(row.frame_id),
    cp_render_job_id: row.cp_render_job_id == null ? null : String(row.cp_render_job_id),
    provider: String(row.provider),
    route_decision_json: parseJson(row.route_decision_json),
    state: String(row.state),
    estimate_credits: row.estimate_credits == null ? null : Number(row.estimate_credits),
    output_asset_id: row.output_asset_id == null ? null : String(row.output_asset_id),
    idempotency_key: row.idempotency_key == null ? null : String(row.idempotency_key),
    winner_asset_id: row.winner_asset_id == null ? null : String(row.winner_asset_id),
    intent: row.intent == null ? null : String(row.intent),
    format_pack_json: row.format_pack_json == null ? null : parseJson(row.format_pack_json),
  };
}

function mapStageRow(row: Record<string, unknown>): ImgJobStageRow {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    stage: String(row.stage),
    sort_order: Number(row.sort_order),
    capability: String(row.capability),
    provider: String(row.provider),
    state: String(row.state),
    cp_render_job_id: row.cp_render_job_id == null ? null : String(row.cp_render_job_id),
  };
}

function parseJson(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}
