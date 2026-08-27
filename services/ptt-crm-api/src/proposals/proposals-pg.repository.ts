import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateProposalBody,
  ProposalRow,
  ProposalStatus,
  QuoteLineItemRow,
  QuoteLineInput,
} from './proposals.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

@Injectable()
export class ProposalsPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

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
    this.schemaReady = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_proposals (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES crm_customers(id) ON DELETE CASCADE,
        lead_id INTEGER NULL,
        presales_id INTEGER NULL,
        lifecycle_id INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
        service_slugs TEXT NOT NULL DEFAULT '[]',
        total_vnd BIGINT NOT NULL DEFAULT 0,
        timeline_months INTEGER NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        ai_output TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        valid_until TEXT NULL,
        price_adjustment_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_crm_proposals_customer ON crm_proposals (customer_id);
      CREATE INDEX IF NOT EXISTS idx_crm_proposals_lead ON crm_proposals (lead_id);

      CREATE TABLE IF NOT EXISTS crm_quote_line_item (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
        dv_code TEXT NOT NULL,
        sku_code TEXT NULL,
        package_tier TEXT NOT NULL,
        service_slug TEXT NOT NULL DEFAULT '',
        reference_price_min BIGINT NOT NULL DEFAULT 0,
        reference_price_max BIGINT NOT NULL DEFAULT 0,
        final_price_vnd BIGINT NOT NULL DEFAULT 0,
        scope_notes TEXT NOT NULL DEFAULT '',
        lifecycle_id INTEGER REFERENCES crm_service_lifecycle(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_crm_quote_line_proposal
        ON crm_quote_line_item (proposal_id);

      ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS lead_id INTEGER NULL;
      ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS presales_id INTEGER NULL;
      ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
      ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS valid_until TEXT NULL;
      ALTER TABLE crm_proposals
        ADD COLUMN IF NOT EXISTS price_adjustment_reason TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_quote_line_item ADD COLUMN IF NOT EXISTS sku_code TEXT NULL;
    `);
  }

  async listByCustomer(customerId: number): Promise<ProposalRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_proposals WHERE customer_id = $1 ORDER BY id DESC',
      [customerId],
    );
    return result.rows.map((row) => this.mapProposalRow(row));
  }

  async listByLeadId(leadId: number): Promise<ProposalRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_proposals WHERE lead_id = $1 ORDER BY id DESC',
      [leadId],
    );
    return result.rows.map((row) => this.mapProposalRow(row));
  }

  async getById(proposalId: number): Promise<ProposalRow | null> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT * FROM crm_proposals WHERE id = $1', [proposalId]);
    return result.rows[0] ? this.mapProposalRow(result.rows[0]) : null;
  }

  async getCustomerName(customerId: number): Promise<string> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT name, company FROM crm_customers WHERE id = $1 LIMIT 1',
      [customerId],
    );
    const row = result.rows[0] as { name?: string; company?: string } | undefined;
    return row ? String(row.company || row.name || '').trim() : '';
  }

  async listLines(proposalId: number): Promise<QuoteLineItemRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_quote_line_item WHERE proposal_id = $1 ORDER BY sort_order ASC, id ASC',
      [proposalId],
    );
    return result.rows.map((row) => this.mapLineRow(row));
  }

  async create(body: CreateProposalBody): Promise<{ id: number }> {
    await this.ensureSchema();
    const slugs = (body.service_slugs ?? []).map((slug) => String(slug).trim()).filter(Boolean);
    const leadId = Number(body.lead_id ?? 0);
    const presalesId = Number(body.presales_id ?? 0);
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_proposals (
         customer_id, lead_id, presales_id, lifecycle_id, service_slugs, total_vnd,
         timeline_months, notes, ai_output, status, valid_until,
         price_adjustment_reason, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}', 'draft', $9, '', $10, $10)
       RETURNING id`,
      [
        body.customer_id != null ? Number(body.customer_id) : null,
        Number.isFinite(leadId) && leadId > 0 ? leadId : null,
        Number.isFinite(presalesId) && presalesId > 0 ? presalesId : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        JSON.stringify(slugs),
        Math.max(0, Number(body.total_vnd ?? 0)),
        Math.max(1, Number(body.timeline_months ?? 1)),
        String(body.notes ?? '').slice(0, 2000),
        body.valid_until != null ? String(body.valid_until).slice(0, 10) : null,
        ts,
      ],
    );
    return { id: Number(result.rows[0].id) };
  }

  async replaceLines(
    proposalId: number,
    lines: Array<
      QuoteLineInput & {
        sku_code?: string | null;
        service_slug: string;
        reference_price_min: number;
        reference_price_max: number;
        final_price_vnd: number;
      }
    >,
    priceAdjustmentReason?: string,
  ): Promise<QuoteLineItemRow[]> {
    await this.ensureSchema();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM crm_quote_line_item WHERE proposal_id = $1', [proposalId]);
      const slugs: string[] = [];
      let total = 0;
      for (const [index, line] of lines.entries()) {
        slugs.push(line.service_slug);
        total += line.final_price_vnd;
        await client.query(
          `INSERT INTO crm_quote_line_item (
             proposal_id, dv_code, sku_code, package_tier, service_slug,
             reference_price_min, reference_price_max, final_price_vnd,
             scope_notes, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            proposalId,
            String(line.dv_code ?? '').toUpperCase(),
            line.sku_code != null ? String(line.sku_code).toUpperCase() : null,
            line.package_tier ?? 'standard',
            line.service_slug,
            line.reference_price_min,
            line.reference_price_max,
            line.final_price_vnd,
            String(line.scope_notes ?? '').slice(0, 2000),
            index,
          ],
        );
      }
      await client.query(
        `UPDATE crm_proposals
         SET service_slugs = $2, total_vnd = $3,
             price_adjustment_reason = $4, updated_at = $5
         WHERE id = $1`,
        [
          proposalId,
          JSON.stringify([...new Set(slugs)]),
          total,
          String(priceAdjustmentReason ?? '').slice(0, 2000),
          catalogTs(),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.listLines(proposalId);
  }

  async patchStatus(
    proposalId: number,
    status: ProposalStatus,
    priceAdjustmentReason?: string,
  ): Promise<ProposalRow | null> {
    await this.ensureSchema();
    const reason =
      priceAdjustmentReason != null ? String(priceAdjustmentReason).slice(0, 2000) : undefined;
    if (reason != null) {
      await this.db.query(
        `UPDATE crm_proposals
         SET status = $2, price_adjustment_reason = $3, updated_at = $4
         WHERE id = $1`,
        [proposalId, status, reason, catalogTs()],
      );
    } else {
      await this.db.query(
        'UPDATE crm_proposals SET status = $2, updated_at = $3 WHERE id = $1',
        [proposalId, status, catalogTs()],
      );
    }
    return this.getById(proposalId);
  }

  async setLineLifecycle(lineId: number, lifecycleId: number): Promise<void> {
    await this.ensureSchema();
    await this.db.query('UPDATE crm_quote_line_item SET lifecycle_id = $2 WHERE id = $1', [
      lineId,
      lifecycleId,
    ]);
  }

  async setProposalLifecycle(proposalId: number, lifecycleId: number): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      'UPDATE crm_proposals SET lifecycle_id = $2, updated_at = $3 WHERE id = $1',
      [proposalId, lifecycleId, catalogTs()],
    );
  }

  async setLifecycleSkuCode(lifecycleId: number, skuCode: string): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      'UPDATE crm_service_lifecycle SET sku_code = $2, updated_at = $3 WHERE id = $1',
      [lifecycleId, String(skuCode).toUpperCase(), catalogTs()],
    );
  }

  async activateLifecycle(lifecycleId: number, stage: string, notes: string): Promise<void> {
    await this.ensureSchema();
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_service_lifecycle
       SET status = 'active', stage = $2, notes = $3, stage_entered_at = $4, updated_at = $4
       WHERE id = $1`,
      [lifecycleId, stage, notes.slice(0, 2000), ts],
    );
  }

  async delete(proposalId: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.db.query('DELETE FROM crm_proposals WHERE id = $1 RETURNING id', [
      proposalId,
    ]);
    return result.rows.length > 0;
  }

  private mapLineRow(row: Record<string, unknown>): QuoteLineItemRow {
    return {
      id: Number(row.id),
      proposal_id: Number(row.proposal_id),
      dv_code: String(row.dv_code ?? ''),
      sku_code: row.sku_code != null ? String(row.sku_code) : null,
      package_tier: String(row.package_tier ?? ''),
      service_slug: String(row.service_slug ?? ''),
      reference_price_min: Number(row.reference_price_min ?? 0),
      reference_price_max: Number(row.reference_price_max ?? 0),
      final_price_vnd: Number(row.final_price_vnd ?? 0),
      scope_notes: String(row.scope_notes ?? ''),
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      sort_order: Number(row.sort_order ?? 0),
    };
  }

  private mapProposalRow(row: Record<string, unknown>): ProposalRow {
    let serviceSlugs: string[] = [];
    try {
      serviceSlugs = JSON.parse(String(row.service_slugs ?? '[]')) as string[];
    } catch {
      serviceSlugs = [];
    }
    let aiOutput: Record<string, unknown> = {};
    try {
      aiOutput = JSON.parse(String(row.ai_output ?? '{}')) as Record<string, unknown>;
    } catch {
      aiOutput = {};
    }
    const status = String(row.status ?? 'draft') as ProposalStatus;
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      lead_id: row.lead_id != null ? Number(row.lead_id) : null,
      presales_id: row.presales_id != null ? Number(row.presales_id) : null,
      lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
      service_slugs: serviceSlugs,
      total_vnd: Number(row.total_vnd ?? 0),
      timeline_months: Number(row.timeline_months ?? 1),
      notes: String(row.notes ?? ''),
      ai_output: aiOutput,
      generated: Object.values(aiOutput).some((value) => Boolean(value)),
      status: ['draft', 'sent', 'accepted', 'rejected'].includes(status) ? status : 'draft',
      valid_until: row.valid_until != null ? text(row.valid_until) : null,
      price_adjustment_reason: String(row.price_adjustment_reason ?? ''),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }
}
