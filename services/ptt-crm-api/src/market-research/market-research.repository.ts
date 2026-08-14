import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { InsightStatus, ProductType, ProjectStatus } from './market-research.constants';
import type {
  CreateEvidenceInput,
  CreateInsightInput,
  CreateProjectInput,
  CreateQuestionInput,
  CreateSourceInput,
  InsertReviewInput,
  ListProjectsFilters,
  PatchEvidenceInput,
  PatchInsightInput,
  PatchProjectInput,
  PatchQuestionInput,
  ResearchAiRunRow,
  ResearchEvidenceRow,
  ResearchInsightRow,
  ResearchProjectRow,
  ResearchQuestionRow,
  ResearchSourceRow,
} from './market-research.types';

function parseJsonCol<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

const PROJECT_SELECT = `
  SELECT p.id,
         p.client_id,
         c.name AS client_name,
         p.lifecycle_id,
         p.title,
         p.product_type,
         p.dv12_tier,
         p.decision_statement,
         p.geo,
         p.languages,
         p.risk_class,
         p.status,
         p.owner_user_id,
         p.data_residency,
         p.related_sales_market_id,
         p.created_by,
         p.updated_by,
         p.created_at::text AS created_at,
         p.updated_at::text AS updated_at,
         (SELECT COUNT(*)::int FROM crm_research_questions q WHERE q.project_id = p.id) AS rq_count,
         (SELECT COUNT(*)::int FROM crm_research_insights i
           WHERE i.project_id = p.id
             AND i.status IN ('analyst_verified','peer_reviewed','approved_internal','approved_client_facing','published')
         ) AS verified_insight_count
  FROM crm_research_projects p
  LEFT JOIN clients c ON c.id::text = p.client_id
`;

@Injectable()
export class MarketResearchRepository implements OnModuleDestroy {
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

  private mapProject(row: Record<string, unknown>): ResearchProjectRow {
    return {
      id: Number(row.id),
      client_id: String(row.client_id),
      client_name: row.client_name != null ? String(row.client_name) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      title: String(row.title),
      product_type: row.product_type as ProductType,
      dv12_tier: row.dv12_tier as ResearchProjectRow['dv12_tier'],
      decision_statement: String(row.decision_statement),
      geo: parseJsonCol<string[]>(row.geo, []),
      languages: parseJsonCol<string[]>(row.languages, ['vi']),
      risk_class: row.risk_class as ResearchProjectRow['risk_class'],
      status: row.status as ProjectStatus,
      owner_user_id: row.owner_user_id != null ? Number(row.owner_user_id) : null,
      data_residency: row.data_residency != null ? String(row.data_residency) : null,
      related_sales_market_id:
        row.related_sales_market_id != null ? Number(row.related_sales_market_id) : null,
      created_by: row.created_by != null ? String(row.created_by) : null,
      updated_by: row.updated_by != null ? String(row.updated_by) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      rq_count: Number(row.rq_count ?? 0),
      verified_insight_count: Number(row.verified_insight_count ?? 0),
    };
  }

  private mapQuestion(row: Record<string, unknown>): ResearchQuestionRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      sort_order: Number(row.sort_order ?? 0),
      question_vi: String(row.question_vi),
      question_en: row.question_en != null ? String(row.question_en) : null,
      analysis_frame: row.analysis_frame != null ? String(row.analysis_frame) : null,
      created_at: String(row.created_at),
    };
  }

  async listProjects(
    filters: ListProjectsFilters,
    allowedClientIds?: string[],
  ): Promise<ResearchProjectRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (filters.client_id?.trim()) add('p.client_id = ?', filters.client_id.trim());
    if (filters.status?.trim()) add('p.status = ?', filters.status.trim());
    if (filters.product_type?.trim()) add('p.product_type = ?', filters.product_type.trim());
    if (filters.q?.trim()) add('p.title ILIKE ?', `%${filters.q.trim()}%`);
    if (allowedClientIds) {
      params.push(allowedClientIds);
      where.push(`p.client_id = ANY($${params.length}::text[])`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.db.query(
      `${PROJECT_SELECT} ${clause} ORDER BY p.updated_at DESC LIMIT 200`,
      params,
    );
    return result.rows.map((row) => this.mapProject(row));
  }

  async getProject(id: number): Promise<ResearchProjectRow | null> {
    const result = await this.db.query(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapProject(row) : null;
  }

  async getProjectClientId(id: number): Promise<string | null> {
    const result = await this.db.query(
      `SELECT client_id FROM crm_research_projects WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? String(row.client_id) : null;
  }

  async listQuestions(projectId: number): Promise<ResearchQuestionRow[]> {
    const result = await this.db.query(
      `SELECT id, project_id, sort_order, question_vi, question_en, analysis_frame,
              created_at::text AS created_at
       FROM crm_research_questions
       WHERE project_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapQuestion(row));
  }

  async createProject(input: CreateProjectInput, actor: string): Promise<ResearchProjectRow> {
    const client = await this.db.connect();
    let id: number;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO crm_research_projects (
           client_id, title, product_type, dv12_tier, decision_statement,
           geo, languages, risk_class, lifecycle_id, status, created_by, updated_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'intake', $10, $10
         ) RETURNING id`,
        [
          input.client_id.trim(),
          input.title.trim(),
          input.product_type,
          ['CB', 'TC', 'CS'].includes(String(input.dv12_tier ?? '')) ? input.dv12_tier : 'CB',
          input.decision_statement.trim(),
          JSON.stringify(input.geo?.length ? input.geo : ['VN']),
          JSON.stringify(input.languages?.length ? input.languages : ['vi']),
          ['low', 'medium', 'high'].includes(String(input.risk_class ?? ''))
            ? input.risk_class
            : 'low',
          input.lifecycle_id ?? null,
          actor,
        ],
      );
      id = Number(inserted.rows[0].id);
      for (const [idx, q] of input.questions.entries()) {
        await client.query(
          `INSERT INTO crm_research_questions (project_id, sort_order, question_vi, question_en, analysis_frame)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            q.sort_order ?? idx + 1,
            q.question_vi.trim(),
            q.question_en?.trim() || null,
            q.analysis_frame?.trim() || null,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    const row = await this.getProject(id);
    if (!row) throw new Error(`createProject failed for id ${id}`);
    return row;
  }

  async patchProject(
    id: number,
    input: PatchProjectInput,
    actor: string,
  ): Promise<ResearchProjectRow | null> {
    const sets: string[] = ['updated_at = now()', 'updated_by = $1'];
    const params: unknown[] = [actor];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.title != null) add('title', input.title.trim());
    if (input.decision_statement != null) add('decision_statement', input.decision_statement.trim());
    if (input.geo != null) {
      params.push(JSON.stringify(input.geo));
      sets.push(`geo = $${params.length}::jsonb`);
    }
    if (input.languages != null) {
      params.push(JSON.stringify(input.languages));
      sets.push(`languages = $${params.length}::jsonb`);
    }
    if (input.risk_class != null) add('risk_class', input.risk_class);
    if (input.dv12_tier != null) add('dv12_tier', input.dv12_tier);
    if (input.status != null) add('status', input.status);
    params.push(id);
    await this.db.query(
      `UPDATE crm_research_projects SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    return this.getProject(id);
  }

  async addQuestion(projectId: number, input: CreateQuestionInput): Promise<ResearchQuestionRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_questions (project_id, sort_order, question_vi, question_en, analysis_frame)
       VALUES (
         $1,
         COALESCE($2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM crm_research_questions WHERE project_id = $1)),
         $3, $4, $5
       )
       RETURNING id, project_id, sort_order, question_vi, question_en, analysis_frame,
                 created_at::text AS created_at`,
      [
        projectId,
        input.sort_order ?? null,
        input.question_vi.trim(),
        input.question_en?.trim() || null,
        input.analysis_frame?.trim() || null,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapQuestion(result.rows[0]);
  }

  async getQuestion(id: number): Promise<ResearchQuestionRow | null> {
    const result = await this.db.query(
      `SELECT id, project_id, sort_order, question_vi, question_en, analysis_frame,
              created_at::text AS created_at
       FROM crm_research_questions WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapQuestion(row) : null;
  }

  async patchQuestion(id: number, input: PatchQuestionInput): Promise<ResearchQuestionRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.question_vi != null) add('question_vi', input.question_vi.trim());
    if (input.question_en !== undefined) add('question_en', input.question_en?.trim() || null);
    if (input.analysis_frame !== undefined) {
      add('analysis_frame', input.analysis_frame?.trim() || null);
    }
    if (input.sort_order != null) add('sort_order', input.sort_order);
    if (!sets.length) return this.getQuestion(id);
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_questions SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, project_id, sort_order, question_vi, question_en, analysis_frame,
                 created_at::text AS created_at`,
      params,
    );
    const row = result.rows[0];
    if (row) {
      await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
        row.project_id,
      ]);
    }
    return row ? this.mapQuestion(row) : null;
  }

  async countEvidenceForQuestion(questionId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_research_evidence WHERE question_id = $1`,
      [questionId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async deleteQuestion(id: number): Promise<void> {
    const existing = await this.getQuestion(id);
    await this.db.query(`DELETE FROM crm_research_questions WHERE id = $1`, [id]);
    if (existing) {
      await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
        existing.project_id,
      ]);
    }
  }

  private mapSource(row: Record<string, unknown>): ResearchSourceRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      question_id: row.question_id != null ? Number(row.question_id) : null,
      source_type: String(row.source_type),
      title: String(row.title),
      publisher: row.publisher != null ? String(row.publisher) : null,
      url: row.url != null ? String(row.url) : null,
      published_at: row.published_at != null ? String(row.published_at) : null,
      accessed_at: row.accessed_at != null ? String(row.accessed_at) : null,
      geo: row.geo != null ? String(row.geo) : null,
      license_note: row.license_note != null ? String(row.license_note) : null,
      reliability_tier: String(row.reliability_tier ?? 'unknown'),
      snapshot_uri: row.snapshot_uri != null ? String(row.snapshot_uri) : null,
      content_hash: row.content_hash != null ? String(row.content_hash) : null,
      ai_generated: Boolean(row.ai_generated),
      keep: row.keep == null ? null : Boolean(row.keep),
      superseded_by: row.superseded_by != null ? Number(row.superseded_by) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapEvidence(row: Record<string, unknown>): ResearchEvidenceRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      source_id: row.source_id != null ? Number(row.source_id) : null,
      study_id: row.study_id != null ? Number(row.study_id) : null,
      question_id: row.question_id != null ? Number(row.question_id) : null,
      locator: String(row.locator),
      excerpt: row.excerpt != null ? String(row.excerpt) : null,
      value_num: row.value_num != null ? Number(row.value_num) : null,
      unit: row.unit != null ? String(row.unit) : null,
      value_base: row.value_base != null ? String(row.value_base) : null,
      period_note: row.period_note != null ? String(row.period_note) : null,
      geography: row.geography != null ? String(row.geography) : null,
      captured_at: String(row.captured_at),
      pii_class: String(row.pii_class ?? 'none'),
      qc_status: String(row.qc_status ?? 'pending'),
      checksum: row.checksum != null ? String(row.checksum) : null,
      created_by: row.created_by != null ? String(row.created_by) : null,
      superseded_by: row.superseded_by != null ? Number(row.superseded_by) : null,
      created_at: String(row.created_at),
    };
  }

  private readonly sourceSelect = `
    SELECT id, project_id, question_id, source_type, title, publisher, url,
           published_at::text AS published_at, accessed_at::text AS accessed_at,
           geo, license_note, reliability_tier, snapshot_uri, content_hash,
           ai_generated, keep, superseded_by,
           created_at::text AS created_at, updated_at::text AS updated_at
    FROM crm_research_sources
  `;

  private readonly evidenceSelect = `
    SELECT id, project_id, source_id, study_id, question_id, locator, excerpt,
           value_num, unit, value_base, period_note, geography,
           captured_at::text AS captured_at, pii_class, qc_status, checksum,
           created_by, superseded_by, created_at::text AS created_at
    FROM crm_research_evidence
  `;

  async listSources(projectId: number): Promise<ResearchSourceRow[]> {
    const result = await this.db.query(
      `${this.sourceSelect} WHERE project_id = $1 ORDER BY id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapSource(row));
  }

  async getSource(id: number): Promise<ResearchSourceRow | null> {
    const result = await this.db.query(`${this.sourceSelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapSource(row) : null;
  }

  async createSource(projectId: number, input: CreateSourceInput): Promise<ResearchSourceRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_sources (
         project_id, question_id, source_type, title, publisher, url,
         published_at, accessed_at, geo, license_note, reliability_tier, ai_generated
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
       RETURNING id, project_id, question_id, source_type, title, publisher, url,
                 published_at::text AS published_at, accessed_at::text AS accessed_at,
                 geo, license_note, reliability_tier, snapshot_uri, content_hash,
                 ai_generated, keep, superseded_by,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [
        projectId,
        input.question_id ?? null,
        String(input.source_type ?? 'web').trim() || 'web',
        input.title.trim(),
        input.publisher?.trim() || null,
        input.url?.trim() || null,
        input.published_at?.trim() || null,
        input.accessed_at?.trim() || null,
        input.geo?.trim() || null,
        input.license_note?.trim() || null,
        String(input.reliability_tier ?? 'unknown').trim() || 'unknown',
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapSource(result.rows[0]);
  }

  async patchSourceKeep(id: number, keep: boolean): Promise<ResearchSourceRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_sources SET keep = $1, updated_at = now() WHERE id = $2
       RETURNING id, project_id, question_id, source_type, title, publisher, url,
                 published_at::text AS published_at, accessed_at::text AS accessed_at,
                 geo, license_note, reliability_tier, snapshot_uri, content_hash,
                 ai_generated, keep, superseded_by,
                 created_at::text AS created_at, updated_at::text AS updated_at`,
      [keep, id],
    );
    const row = result.rows[0];
    return row ? this.mapSource(row) : null;
  }

  async listEvidence(projectId: number): Promise<ResearchEvidenceRow[]> {
    const result = await this.db.query(
      `${this.evidenceSelect} WHERE project_id = $1 ORDER BY id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapEvidence(row));
  }

  async getEvidence(id: number): Promise<ResearchEvidenceRow | null> {
    const result = await this.db.query(`${this.evidenceSelect} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapEvidence(row) : null;
  }

  async createEvidence(
    projectId: number,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<ResearchEvidenceRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_evidence (
         project_id, source_id, study_id, question_id, locator, excerpt,
         value_num, unit, value_base, period_note, geography, pii_class, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                 value_num, unit, value_base, period_note, geography,
                 captured_at::text AS captured_at, pii_class, qc_status, checksum,
                 created_by, superseded_by, created_at::text AS created_at`,
      [
        projectId,
        input.source_id ?? null,
        input.study_id ?? null,
        input.question_id ?? null,
        String(input.locator ?? '').trim(),
        input.excerpt?.trim() || null,
        input.value_num ?? null,
        input.unit?.trim() || null,
        input.value_base?.trim() || null,
        input.period_note?.trim() || null,
        input.geography?.trim() || null,
        input.pii_class?.trim() || 'none',
        actor,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    return this.mapEvidence(result.rows[0]);
  }

  async patchEvidence(id: number, input: PatchEvidenceInput): Promise<ResearchEvidenceRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.locator != null) add('locator', input.locator.trim());
    if (input.excerpt !== undefined) add('excerpt', input.excerpt?.trim() || null);
    if (input.value_num !== undefined) add('value_num', input.value_num);
    if (input.unit !== undefined) add('unit', input.unit?.trim() || null);
    if (input.value_base !== undefined) add('value_base', input.value_base?.trim() || null);
    if (input.period_note !== undefined) add('period_note', input.period_note?.trim() || null);
    if (input.geography !== undefined) add('geography', input.geography?.trim() || null);
    if (input.pii_class !== undefined) add('pii_class', input.pii_class?.trim() || 'none');
    if (input.question_id !== undefined) add('question_id', input.question_id);
    if (!sets.length) return this.getEvidence(id);
    params.push(id);
    const result = await this.db.query(
      `UPDATE crm_research_evidence SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                 value_num, unit, value_base, period_note, geography,
                 captured_at::text AS captured_at, pii_class, qc_status, checksum,
                 created_by, superseded_by, created_at::text AS created_at`,
      params,
    );
    const row = result.rows[0];
    return row ? this.mapEvidence(row) : null;
  }

  async verifyEvidence(id: number, checksum: string): Promise<ResearchEvidenceRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_evidence
       SET qc_status = 'verified', checksum = $1
       WHERE id = $2
       RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                 value_num, unit, value_base, period_note, geography,
                 captured_at::text AS captured_at, pii_class, qc_status, checksum,
                 created_by, superseded_by, created_at::text AS created_at`,
      [checksum, id],
    );
    const row = result.rows[0];
    return row ? this.mapEvidence(row) : null;
  }

  async supersedeEvidence(
    existing: ResearchEvidenceRow,
    input: CreateEvidenceInput,
    actor: string,
  ): Promise<{ old: ResearchEvidenceRow; evidence: ResearchEvidenceRow }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO crm_research_evidence (
           project_id, source_id, study_id, question_id, locator, excerpt,
           value_num, unit, value_base, period_note, geography, pii_class, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                   value_num, unit, value_base, period_note, geography,
                   captured_at::text AS captured_at, pii_class, qc_status, checksum,
                   created_by, superseded_by, created_at::text AS created_at`,
        [
          existing.project_id,
          input.source_id ?? null,
          input.study_id ?? null,
          input.question_id ?? null,
          String(input.locator ?? '').trim(),
          input.excerpt?.trim() || null,
          input.value_num ?? null,
          input.unit?.trim() || null,
          input.value_base?.trim() || null,
          input.period_note?.trim() || null,
          input.geography?.trim() || null,
          input.pii_class?.trim() || 'none',
          actor,
        ],
      );
      const created = this.mapEvidence(inserted.rows[0]);
      const updated = await client.query(
        `UPDATE crm_research_evidence
         SET qc_status = 'superseded', superseded_by = $1
         WHERE id = $2
         RETURNING id, project_id, source_id, study_id, question_id, locator, excerpt,
                   value_num, unit, value_base, period_note, geography,
                   captured_at::text AS captured_at, pii_class, qc_status, checksum,
                   created_by, superseded_by, created_at::text AS created_at`,
        [created.id, existing.id],
      );
      await client.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
        existing.project_id,
      ]);
      await client.query('COMMIT');
      return { old: this.mapEvidence(updated.rows[0]), evidence: created };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private readonly insightSelect = `
    SELECT i.id, i.project_id, i.statement, i.observation, i.interpretation, i.implication,
           i.recommendation, i.audience, i.status, i.confidence_rationale, i.confidence_json,
           i.ai_generated, i.created_by,
           i.valid_from::text AS valid_from, i.valid_to::text AS valid_to,
           i.created_at::text AS created_at, i.updated_at::text AS updated_at,
           COALESCE((
             SELECT json_agg(ie.evidence_id ORDER BY ie.evidence_id)
             FROM crm_research_insight_evidence ie
             WHERE ie.insight_id = i.id
           ), '[]'::json) AS evidence_ids
    FROM crm_research_insights i
  `;

  private mapInsight(row: Record<string, unknown>): ResearchInsightRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      statement: String(row.statement),
      observation: row.observation != null ? String(row.observation) : null,
      interpretation: row.interpretation != null ? String(row.interpretation) : null,
      implication: row.implication != null ? String(row.implication) : null,
      recommendation: row.recommendation != null ? String(row.recommendation) : null,
      audience: row.audience != null ? String(row.audience) : null,
      status: row.status as InsightStatus,
      confidence_rationale: row.confidence_rationale != null ? String(row.confidence_rationale) : null,
      confidence_json: row.confidence_json != null ? parseJsonCol(row.confidence_json, null) : null,
      ai_generated: Boolean(row.ai_generated),
      created_by: row.created_by != null ? String(row.created_by) : null,
      valid_from: row.valid_from != null ? String(row.valid_from) : null,
      valid_to: row.valid_to != null ? String(row.valid_to) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      evidence_ids: parseJsonCol<number[]>(row.evidence_ids, []).map(Number),
    };
  }

  async listInsights(projectId: number): Promise<ResearchInsightRow[]> {
    const result = await this.db.query(
      `${this.insightSelect} WHERE i.project_id = $1 ORDER BY i.id ASC`,
      [projectId],
    );
    return result.rows.map((row) => this.mapInsight(row));
  }

  async getInsight(id: number): Promise<ResearchInsightRow | null> {
    const result = await this.db.query(`${this.insightSelect} WHERE i.id = $1`, [id]);
    const row = result.rows[0];
    return row ? this.mapInsight(row) : null;
  }

  async createInsight(
    projectId: number,
    input: CreateInsightInput,
    actor: string,
  ): Promise<ResearchInsightRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_insights (
         project_id, statement, observation, interpretation, implication, recommendation,
         audience, status, confidence_rationale, created_by, valid_from, valid_to
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11)
       RETURNING id`,
      [
        projectId,
        input.statement.trim(),
        input.observation?.trim() || null,
        input.interpretation?.trim() || null,
        input.implication?.trim() || null,
        input.recommendation?.trim() || null,
        input.audience?.trim() || null,
        input.confidence_rationale?.trim() || null,
        actor,
        input.valid_from?.trim() || null,
        input.valid_to?.trim() || null,
      ],
    );
    await this.db.query(`UPDATE crm_research_projects SET updated_at = now() WHERE id = $1`, [
      projectId,
    ]);
    const row = await this.getInsight(Number(result.rows[0].id));
    if (!row) throw new Error(`createInsight failed for project ${projectId}`);
    return row;
  }

  async patchInsight(id: number, input: PatchInsightInput): Promise<ResearchInsightRow | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (input.statement != null) add('statement', input.statement.trim());
    if (input.observation !== undefined) add('observation', input.observation?.trim() || null);
    if (input.interpretation !== undefined) {
      add('interpretation', input.interpretation?.trim() || null);
    }
    if (input.implication !== undefined) add('implication', input.implication?.trim() || null);
    if (input.recommendation !== undefined) {
      add('recommendation', input.recommendation?.trim() || null);
    }
    if (input.audience !== undefined) add('audience', input.audience?.trim() || null);
    if (input.confidence_rationale !== undefined) {
      add('confidence_rationale', input.confidence_rationale?.trim() || null);
    }
    if (input.valid_from !== undefined) add('valid_from', input.valid_from?.trim() || null);
    if (input.valid_to !== undefined) add('valid_to', input.valid_to?.trim() || null);
    if (sets.length === 1) return this.getInsight(id);
    params.push(id);
    await this.db.query(
      `UPDATE crm_research_insights SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );
    return this.getInsight(id);
  }

  async replaceInsightEvidence(insightId: number, evidenceIds: number[]): Promise<void> {
    await this.db.query(`DELETE FROM crm_research_insight_evidence WHERE insight_id = $1`, [
      insightId,
    ]);
    for (const evidenceId of evidenceIds) {
      await this.db.query(
        `INSERT INTO crm_research_insight_evidence (insight_id, evidence_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [insightId, evidenceId],
      );
    }
  }

  async countVerifiedEvidenceForInsight(insightId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_research_insight_evidence ie
       JOIN crm_research_evidence e ON e.id = ie.evidence_id
       WHERE ie.insight_id = $1 AND e.qc_status = 'verified'`,
      [insightId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async updateInsightStatus(id: number, status: InsightStatus): Promise<ResearchInsightRow | null> {
    await this.db.query(
      `UPDATE crm_research_insights SET status = $1, updated_at = now() WHERE id = $2`,
      [status, id],
    );
    return this.getInsight(id);
  }

  private readonly aiRunSelect = `
    SELECT id, project_id, question_id, job_type, provider, model, status,
           credits_used, error_message, actor,
           created_at::text AS created_at, finished_at::text AS finished_at
    FROM crm_research_ai_runs
  `;

  private mapAiRun(row: Record<string, unknown>): ResearchAiRunRow {
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      question_id: row.question_id != null ? Number(row.question_id) : null,
      job_type: String(row.job_type),
      provider: String(row.provider),
      model: row.model != null ? String(row.model) : null,
      status: String(row.status),
      credits_used: Number(row.credits_used ?? 0),
      error_message: row.error_message != null ? String(row.error_message) : null,
      actor: row.actor != null ? String(row.actor) : null,
      created_at: String(row.created_at),
      finished_at: row.finished_at != null ? String(row.finished_at) : null,
    };
  }

  async findInFlightDeskRun(
    projectId: number,
    questionId: number,
  ): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect}
       WHERE project_id = $1 AND question_id = $2
         AND job_type = 'desk_tavily'
         AND status IN ('pending', 'running')
       ORDER BY id DESC LIMIT 1`,
      [projectId, questionId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async insertAiRun(input: {
    projectId: number;
    questionId: number;
    jobType: string;
    provider: string;
    actor: string;
  }): Promise<ResearchAiRunRow> {
    const result = await this.db.query(
      `INSERT INTO crm_research_ai_runs (
         project_id, question_id, job_type, provider, status, actor
       ) VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING id, project_id, question_id, job_type, provider, model, status,
                 credits_used, error_message, actor,
                 created_at::text AS created_at, finished_at::text AS finished_at`,
      [input.projectId, input.questionId, input.jobType, input.provider, input.actor],
    );
    return this.mapAiRun(result.rows[0]);
  }

  async failAiRun(runId: number, error: string): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `UPDATE crm_research_ai_runs
       SET status = 'failed', error_message = $1, finished_at = now()
       WHERE id = $2
       RETURNING id, project_id, question_id, job_type, provider, model, status,
                 credits_used, error_message, actor,
                 created_at::text AS created_at, finished_at::text AS finished_at`,
      [error, runId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async getAiRun(projectId: number, runId: number): Promise<ResearchAiRunRow | null> {
    const result = await this.db.query(
      `${this.aiRunSelect} WHERE id = $1 AND project_id = $2`,
      [runId, projectId],
    );
    const row = result.rows[0];
    return row ? this.mapAiRun(row) : null;
  }

  async listRecentAiRuns(projectId: number, limit = 20): Promise<ResearchAiRunRow[]> {
    const result = await this.db.query(
      `${this.aiRunSelect} WHERE project_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [projectId, limit],
    );
    return result.rows.map((row) => this.mapAiRun(row));
  }

  async sumTavilyCredits(projectId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(credits_used), 0)::int AS n
       FROM crm_research_ai_runs
       WHERE project_id = $1 AND job_type = 'desk_tavily'`,
      [projectId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async insertReview(input: InsertReviewInput): Promise<{ id: number }> {
    const result = await this.db.query(
      `INSERT INTO crm_research_reviews (
         project_id, object_type, object_id, reviewer, role, decision, comments
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.project_id,
        input.object_type,
        input.object_id,
        input.reviewer,
        input.role,
        input.decision,
        input.comments ?? null,
      ],
    );
    return { id: Number(result.rows[0].id) };
  }
}
