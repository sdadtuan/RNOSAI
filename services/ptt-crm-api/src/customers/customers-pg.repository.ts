import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateCustomerBody,
  CreateIssueBody,
  CreatePurchaseBody,
  CreateRelationBody,
  CUSTOMER_GENDER_LABELS,
  CUSTOMER_GENDERS,
  CUSTOMER_LEAD_SOURCE_LABELS,
  CUSTOMER_LEAD_SOURCES,
  CustomerBriefRow,
  CustomerDetailStats,
  CustomerIssueRow,
  CustomerPurchaseRow,
  CustomerRelationRow,
  CustomerRow,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
  normalizePurchaseStatus,
  normalizeRelationType,
  PatchCustomerBody,
  PatchIssueBody,
  PatchPurchaseBody,
  PatchRelationBody,
  PROFILE_PATCH_KEYS,
  PURCHASE_STATUS_LABELS,
  RELATION_TYPE_LABELS,
} from './customers.types';

const CUSTOMER_COLUMNS = `
  id, name, phone, email, address, company, lead_source, lead_source_note,
  date_of_birth, gender, id_number, occupation, interests, profile_notes, created_at
`;

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

@Injectable()
export class CustomersPgRepository implements OnModuleDestroy {
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
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lead_source VARCHAR(64) NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lead_source_note TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(32) NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(32) NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS id_number VARCHAR(32) NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS occupation VARCHAR(240) NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS interests TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS profile_notes TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS crm_customer_relations (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        relation_type VARCHAR(64) NOT NULL DEFAULT 'other',
        full_name VARCHAR(240) NOT NULL DEFAULT '',
        phone VARCHAR(64) NOT NULL DEFAULT '',
        email VARCHAR(240) NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_customer_purchases (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        order_date VARCHAR(32) NOT NULL DEFAULT '',
        product_name VARCHAR(400) NOT NULL DEFAULT '',
        amount_vnd BIGINT NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(64) NOT NULL DEFAULT 'completed',
        reference_code VARCHAR(120) NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        contract_id INTEGER REFERENCES crm_contracts(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_customer_issues (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES crm_cases(id),
        issue_type VARCHAR(64) NOT NULL DEFAULT 'phan_anh',
        priority VARCHAR(64) NOT NULL DEFAULT 'binh_thuong',
        status VARCHAR(64) NOT NULL DEFAULT 'moi',
        title VARCHAR(400) NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        resolution TEXT NOT NULL DEFAULT '',
        assigned_staff_id INTEGER REFERENCES crm_staff(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS crm_customer_brief_scans (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        meeting_purpose TEXT NOT NULL DEFAULT '',
        ai_output TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crm_cu_rel_customer
        ON crm_customer_relations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_crm_cu_purchase_customer
        ON crm_customer_purchases(customer_id);
      CREATE INDEX IF NOT EXISTS idx_crm_cu_issue_customer
        ON crm_customer_issues(customer_id);
      CREATE INDEX IF NOT EXISTS idx_crm_cu_issue_status
        ON crm_customer_issues(status);
      CREATE INDEX IF NOT EXISTS idx_brief_scans_customer
        ON crm_customer_brief_scans(customer_id);
    `);
  }

  async listCustomers(q?: string, limit = 200): Promise<CustomerRow[]> {
    await this.ensureSchema();
    const lim = Math.max(1, Math.min(limit, 500));
    const qRaw = String(q ?? '').trim();
    const params: unknown[] = [];
    let search = '';
    if (qRaw) {
      params.push(`%${qRaw}%`);
      search = `AND (
        COALESCE(TRIM(name), '') ILIKE $1
        OR COALESCE(TRIM(phone), '') ILIKE $1
        OR COALESCE(TRIM(email), '') ILIKE $1
        OR COALESCE(TRIM(address), '') ILIKE $1
        OR COALESCE(TRIM(company), '') ILIKE $1
      )`;
    }
    params.push(lim);
    const result = await this.db.query(
      `SELECT ${CUSTOMER_COLUMNS}
       FROM crm_customers
       WHERE COALESCE(is_placeholder, FALSE) IS FALSE
       ${search}
       ORDER BY id DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => this.mapCustomer(row));
  }

  async findLinkedLeadIds(customerId: number): Promise<number[]> {
    await this.ensureSchema();
    const customer = await this.getCustomerById(customerId);
    if (!customer) return [];

    const ids = new Set<number>();
    const placeholder = await this.db.query(
      `SELECT placeholder_lead_id FROM crm_customers WHERE id = $1 LIMIT 1`,
      [customerId],
    );
    const placeholderId = Number(placeholder.rows[0]?.placeholder_lead_id ?? 0);
    if (placeholderId > 0) ids.add(placeholderId);

    const phone = String(customer.phone ?? '').trim();
    if (phone) {
      const rows = await this.db.query(
        `SELECT sqlite_lead_id AS id FROM crm_leads
         WHERE TRIM(COALESCE(phone, '')) = $1
         ORDER BY sqlite_lead_id DESC LIMIT 20`,
        [phone],
      );
      for (const row of rows.rows) ids.add(Number(row.id));
    }

    const email = String(customer.email ?? '').trim().toLowerCase();
    if (email) {
      const rows = await this.db.query(
        `SELECT sqlite_lead_id AS id FROM crm_leads
         WHERE LOWER(TRIM(COALESCE(email, ''))) = $1
         ORDER BY sqlite_lead_id DESC LIMIT 20`,
        [email],
      );
      for (const row of rows.rows) ids.add(Number(row.id));
    }

    try {
      const lifecycle = await this.db.query(
        `SELECT lead_id FROM crm_service_lifecycle
         WHERE customer_id = $1 AND lead_id IS NOT NULL
         ORDER BY id DESC LIMIT 20`,
        [customerId],
      );
      for (const row of lifecycle.rows) {
        const id = Number(row.lead_id);
        if (id > 0) ids.add(id);
      }
    } catch {
      /* lifecycle table is optional on older PostgreSQL schemas */
    }
    return [...ids];
  }

  async getCustomerById(id: number): Promise<CustomerRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(`SELECT ${CUSTOMER_COLUMNS} FROM crm_customers WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapCustomer(result.rows[0]) : null;
  }

  async createCustomer(body: CreateCustomerBody): Promise<CustomerRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `INSERT INTO crm_customers (
         name, phone, email, address, company, lead_source, lead_source_note,
         date_of_birth, gender, id_number, occupation, interests, profile_notes, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz)
       RETURNING ${CUSTOMER_COLUMNS}`,
      [
        String(body.name ?? '').trim().slice(0, 240),
        String(body.phone ?? '').trim().slice(0, 64),
        String(body.email ?? '').trim().slice(0, 240),
        String(body.address ?? '').trim().slice(0, 500),
        String(body.company ?? '').trim().slice(0, 240),
        this.normalizeLeadSource(body.lead_source ?? ''),
        String(body.lead_source_note ?? '').trim().slice(0, 4000),
        String(body.date_of_birth ?? '').trim().slice(0, 32),
        this.normalizeGender(body.gender ?? ''),
        String(body.id_number ?? '').trim().slice(0, 32),
        String(body.occupation ?? '').trim().slice(0, 240),
        String(body.interests ?? '').trim().slice(0, 4000),
        String(body.profile_notes ?? '').trim().slice(0, 4000),
        catalogTs(),
      ],
    );
    return this.mapCustomer(result.rows[0]);
  }

  async patchCustomer(id: number, body: PatchCustomerBody): Promise<CustomerRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(`SELECT ${CUSTOMER_COLUMNS} FROM crm_customers WHERE id = $1`, [id]);
    const existing = result.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, string> = {};
    for (const key of PROFILE_PATCH_KEYS) merged[key] = String(existing[key] ?? '');
    for (const key of PROFILE_PATCH_KEYS) {
      if (!(key in body)) continue;
      const value = body[key];
      if (value == null) {
        merged[key] = '';
      } else if (typeof value === 'string') {
        const normalized = value.trim();
        if (key === 'phone') merged[key] = normalized.slice(0, 64);
        else if (key === 'address') merged[key] = normalized.slice(0, 500);
        else if (key === 'interests' || key === 'profile_notes' || key === 'lead_source_note') {
          merged[key] = normalized.slice(0, 4000);
        } else if (key === 'id_number' || key === 'date_of_birth') merged[key] = normalized.slice(0, 32);
        else if (key === 'lead_source') merged[key] = normalized ? this.normalizeLeadSource(normalized) : '';
        else if (key === 'gender') merged[key] = normalized ? this.normalizeGender(normalized) : '';
        else merged[key] = normalized.slice(0, 240);
      }
    }

    const updated = await this.db.query(
      `UPDATE crm_customers
       SET name = $2, phone = $3, email = $4, address = $5, company = $6,
           lead_source = $7, lead_source_note = $8, date_of_birth = $9, gender = $10,
           id_number = $11, occupation = $12, interests = $13, profile_notes = $14
       WHERE id = $1
       RETURNING ${CUSTOMER_COLUMNS}`,
      [
        id,
        merged.name,
        merged.phone,
        merged.email,
        merged.address,
        merged.company,
        merged.lead_source,
        merged.lead_source_note,
        merged.date_of_birth,
        merged.gender,
        merged.id_number,
        merged.occupation,
        merged.interests,
        merged.profile_notes,
      ],
    );
    return updated.rows[0] ? this.mapCustomer(updated.rows[0]) : null;
  }

  async fetchRelations(customerId: number): Promise<CustomerRelationRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_customer_relations WHERE customer_id = $1 ORDER BY id ASC`,
      [customerId],
    );
    return result.rows.map((row) => this.mapRelationRow(row));
  }

  async fetchPurchases(customerId: number): Promise<CustomerPurchaseRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_customer_purchases
       WHERE customer_id = $1
       ORDER BY CASE
                  WHEN BTRIM(order_date) = '' THEN TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')
                  WHEN order_date ~ '^\\d{4}-\\d{2}-\\d{2}' THEN order_date
                  ELSE NULL
                END DESC NULLS LAST,
                id DESC`,
      [customerId],
    );
    return result.rows.map((row) => this.mapPurchaseRow(row));
  }

  async fetchIssues(customerId: number): Promise<CustomerIssueRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT i.*, st.name AS assigned_staff_name
       FROM crm_customer_issues i
       LEFT JOIN crm_staff st ON st.id = i.assigned_staff_id
       WHERE i.customer_id = $1
       ORDER BY CASE i.status WHEN 'moi' THEN 0 WHEN 'dang_xu_ly' THEN 1 WHEN 'cho_khach' THEN 2 ELSE 9 END,
                i.id DESC`,
      [customerId],
    );
    return result.rows.map((row) => this.mapIssueRow(row));
  }

  computeStats(
    relations: CustomerRelationRow[],
    purchases: CustomerPurchaseRow[],
    issues: CustomerIssueRow[],
  ): CustomerDetailStats {
    return {
      relations_total: relations.length,
      purchases_total: purchases.length,
      issues_total: issues.length,
      issues_open: issues.filter((issue) => !['da_xu_ly', 'dong'].includes(String(issue.status ?? ''))).length,
    };
  }

  async createRelation(customerId: number, body: CreateRelationBody): Promise<CustomerRelationRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `INSERT INTO crm_customer_relations (
         customer_id, relation_type, full_name, phone, email, notes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz)
       RETURNING *`,
      [
        customerId,
        normalizeRelationType(body.relation_type),
        String(body.full_name ?? '').trim().slice(0, 240),
        String(body.phone ?? '').trim().slice(0, 64),
        String(body.email ?? '').trim().slice(0, 240),
        String(body.notes ?? '').trim().slice(0, 2000),
        catalogTs(),
      ],
    );
    return this.mapRelationRow(result.rows[0]);
  }

  async patchRelation(
    customerId: number,
    relationId: number,
    body: PatchRelationBody,
  ): Promise<CustomerRelationRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_customer_relations WHERE id = $1 AND customer_id = $2`,
      [relationId, customerId],
    );
    const existing = result.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;
    const merged: Record<string, string> = {
      relation_type: String(existing.relation_type ?? ''),
      full_name: String(existing.full_name ?? ''),
      phone: String(existing.phone ?? ''),
      email: String(existing.email ?? ''),
      notes: String(existing.notes ?? ''),
    };
    if ('relation_type' in body) merged.relation_type = normalizeRelationType(body.relation_type);
    for (const key of ['full_name', 'phone', 'email', 'notes'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'notes' ? 0 : 240);
      }
    }
    const updated = await this.db.query(
      `UPDATE crm_customer_relations
       SET relation_type = $2, full_name = $3, phone = $4, email = $5, notes = $6,
           updated_at = $7::timestamptz
       WHERE id = $1
       RETURNING *`,
      [
        relationId,
        merged.relation_type,
        merged.full_name,
        merged.phone,
        merged.email,
        merged.notes,
        catalogTs(),
      ],
    );
    return updated.rows[0] ? this.mapRelationRow(updated.rows[0]) : null;
  }

  async deleteRelation(customerId: number, relationId: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.db.query(
      `DELETE FROM crm_customer_relations WHERE id = $1 AND customer_id = $2`,
      [relationId, customerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createPurchase(customerId: number, body: CreatePurchaseBody): Promise<CustomerPurchaseRow> {
    await this.ensureSchema();
    const amount = Math.max(0, Number(body.amount_vnd ?? 0));
    const quantity = Math.max(1, Number(body.quantity ?? 1));
    const rawContractId = body.contract_id != null && body.contract_id !== 0 ? Number(body.contract_id) : NaN;
    const contractId = Number.isFinite(rawContractId) ? rawContractId : null;
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_customer_purchases (
         customer_id, order_date, product_name, amount_vnd, quantity, status,
         reference_code, notes, contract_id, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $10::timestamptz)
       RETURNING *`,
      [
        customerId,
        String(body.order_date ?? ts.slice(0, 10)).trim().slice(0, 32),
        String(body.product_name ?? '').trim().slice(0, 400),
        Number.isFinite(amount) ? amount : 0,
        Number.isFinite(quantity) ? quantity : 1,
        normalizePurchaseStatus(body.status),
        String(body.reference_code ?? '').trim().slice(0, 120),
        String(body.notes ?? '').trim().slice(0, 2000),
        contractId,
        ts,
      ],
    );
    return this.mapPurchaseRow(result.rows[0]);
  }

  async patchPurchase(
    customerId: number,
    purchaseId: number,
    body: PatchPurchaseBody,
  ): Promise<CustomerPurchaseRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_customer_purchases WHERE id = $1 AND customer_id = $2`,
      [purchaseId, customerId],
    );
    const existing = result.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;
    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['product_name', 'order_date', 'reference_code', 'notes'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'product_name' ? 0 : 2000);
      }
    }
    if ('status' in body) merged.status = normalizePurchaseStatus(body.status);
    if ('amount_vnd' in body) {
      const amount = Math.max(0, Number(body.amount_vnd ?? 0));
      if (Number.isFinite(amount)) merged.amount_vnd = amount;
    }
    if ('quantity' in body) {
      const quantity = Math.max(1, Number(body.quantity ?? 1));
      if (Number.isFinite(quantity)) merged.quantity = quantity;
    }
    const updated = await this.db.query(
      `UPDATE crm_customer_purchases
       SET order_date = $2, product_name = $3, amount_vnd = $4, quantity = $5, status = $6,
           reference_code = $7, notes = $8, updated_at = $9::timestamptz
       WHERE id = $1
       RETURNING *`,
      [
        purchaseId,
        String(merged.order_date ?? ''),
        String(merged.product_name ?? ''),
        Number(merged.amount_vnd ?? 0),
        Number(merged.quantity ?? 1),
        String(merged.status ?? ''),
        String(merged.reference_code ?? ''),
        String(merged.notes ?? ''),
        catalogTs(),
      ],
    );
    return updated.rows[0] ? this.mapPurchaseRow(updated.rows[0]) : null;
  }

  async deletePurchase(customerId: number, purchaseId: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.db.query(
      `DELETE FROM crm_customer_purchases WHERE id = $1 AND customer_id = $2`,
      [purchaseId, customerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createIssue(customerId: number, body: CreateIssueBody): Promise<CustomerIssueRow> {
    await this.ensureSchema();
    const rawCaseId = body.case_id != null && body.case_id !== 0 ? Number(body.case_id) : NaN;
    const rawStaffId =
      body.assigned_staff_id != null && body.assigned_staff_id !== 0 ? Number(body.assigned_staff_id) : NaN;
    const result = await this.db.query(
      `INSERT INTO crm_customer_issues (
         customer_id, case_id, issue_type, priority, status, title, description,
         resolution, assigned_staff_id, created_at, updated_at, resolved_at
       ) VALUES ($1, $2, $3, $4, 'moi', $5, $6, '', $7, $8::timestamptz, $8::timestamptz, NULL)
       RETURNING *`,
      [
        customerId,
        Number.isFinite(rawCaseId) ? rawCaseId : null,
        normalizeIssueType(body.issue_type),
        normalizeIssuePriority(body.priority),
        String(body.title ?? '').trim().slice(0, 400),
        String(body.description ?? '').trim().slice(0, 8000),
        Number.isFinite(rawStaffId) ? rawStaffId : null,
        catalogTs(),
      ],
    );
    return this.fetchIssueById(Number(result.rows[0].id));
  }

  async patchIssue(
    customerId: number,
    issueId: number,
    body: PatchIssueBody,
  ): Promise<CustomerIssueRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_customer_issues WHERE id = $1 AND customer_id = $2`,
      [issueId, customerId],
    );
    const existing = result.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;
    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['title', 'description', 'resolution'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'title' ? 0 : 8000);
      }
    }
    if ('issue_type' in body) merged.issue_type = normalizeIssueType(body.issue_type);
    if ('priority' in body) merged.priority = normalizeIssuePriority(body.priority);
    if ('status' in body) merged.status = normalizeIssueStatus(body.status);
    if ('assigned_staff_id' in body) {
      const raw = body.assigned_staff_id;
      const staffId = raw == null || raw === 0 ? NaN : Number(raw);
      merged.assigned_staff_id = Number.isFinite(staffId) ? staffId : null;
    }
    const status = String(merged.status ?? '');
    let resolvedAt = text(merged.resolved_at);
    if (['da_xu_ly', 'dong'].includes(status) && !resolvedAt) resolvedAt = catalogTs();
    else if (!['da_xu_ly', 'dong'].includes(status)) resolvedAt = '';
    await this.db.query(
      `UPDATE crm_customer_issues
       SET issue_type = $2, priority = $3, status = $4, title = $5, description = $6,
           resolution = $7, assigned_staff_id = $8, updated_at = $9::timestamptz,
           resolved_at = NULLIF($10, '')::timestamptz
       WHERE id = $1`,
      [
        issueId,
        String(merged.issue_type ?? ''),
        String(merged.priority ?? ''),
        status,
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.resolution ?? ''),
        merged.assigned_staff_id != null ? Number(merged.assigned_staff_id) : null,
        catalogTs(),
        resolvedAt,
      ],
    );
    return this.fetchIssueById(issueId);
  }

  async getLatestBrief(customerId: number): Promise<CustomerBriefRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT id, customer_id, meeting_purpose, ai_output, created_at
       FROM crm_customer_brief_scans
       WHERE customer_id = $1
       ORDER BY id DESC LIMIT 1`,
      [customerId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row
      ? {
          id: Number(row.id),
          customer_id: Number(row.customer_id),
          meeting_purpose: String(row.meeting_purpose ?? ''),
          ai_output: String(row.ai_output ?? ''),
          created_at: text(row.created_at),
        }
      : null;
  }

  private async fetchIssueById(issueId: number): Promise<CustomerIssueRow> {
    const result = await this.db.query(
      `SELECT i.*, st.name AS assigned_staff_name
       FROM crm_customer_issues i
       LEFT JOIN crm_staff st ON st.id = i.assigned_staff_id
       WHERE i.id = $1`,
      [issueId],
    );
    return this.mapIssueRow(result.rows[0]);
  }

  private mapRelationRow(row: Record<string, unknown>): CustomerRelationRow {
    const relationType = String(row.relation_type ?? '');
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      relation_type: relationType,
      relation_type_label: RELATION_TYPE_LABELS[relationType] ?? relationType,
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      notes: String(row.notes ?? ''),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }

  private mapPurchaseRow(row: Record<string, unknown>): CustomerPurchaseRow {
    const status = String(row.status ?? '');
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      order_date: String(row.order_date ?? ''),
      product_name: String(row.product_name ?? ''),
      amount_vnd: Number(row.amount_vnd ?? 0),
      quantity: Number(row.quantity ?? 1),
      status,
      status_label: PURCHASE_STATUS_LABELS[status] ?? status,
      reference_code: String(row.reference_code ?? ''),
      notes: String(row.notes ?? ''),
      contract_id: row.contract_id != null ? Number(row.contract_id) : null,
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
    };
  }

  private mapIssueRow(row: Record<string, unknown>): CustomerIssueRow {
    const issueType = String(row.issue_type ?? '');
    const status = String(row.status ?? '');
    const priority = String(row.priority ?? '');
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      case_id: row.case_id != null ? Number(row.case_id) : null,
      issue_type: issueType,
      issue_type_label: ISSUE_TYPE_LABELS[issueType] ?? issueType,
      priority,
      priority_label: ISSUE_PRIORITY_LABELS[priority] ?? priority,
      status,
      status_label: ISSUE_STATUS_LABELS[status] ?? status,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      resolution: String(row.resolution ?? ''),
      assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_staff_name: String(row.assigned_staff_name ?? ''),
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
      resolved_at: text(row.resolved_at),
    };
  }

  private mapCustomer(row: Record<string, unknown>): CustomerRow {
    const leadSource = String(row.lead_source ?? '');
    const gender = String(row.gender ?? '');
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      address: String(row.address ?? ''),
      company: String(row.company ?? ''),
      lead_source: leadSource,
      lead_source_label: leadSource ? (CUSTOMER_LEAD_SOURCE_LABELS[leadSource] ?? leadSource) : '',
      lead_source_note: String(row.lead_source_note ?? ''),
      date_of_birth: String(row.date_of_birth ?? ''),
      gender,
      gender_label: gender ? (CUSTOMER_GENDER_LABELS[gender] ?? gender) : '',
      id_number: String(row.id_number ?? ''),
      occupation: String(row.occupation ?? ''),
      interests: String(row.interests ?? ''),
      profile_notes: String(row.profile_notes ?? ''),
      created_at: text(row.created_at),
    };
  }

  private normalizeLeadSource(raw: string): string {
    const code = String(raw ?? '').trim().toLowerCase();
    if ((CUSTOMER_LEAD_SOURCES as readonly string[]).includes(code)) return code;
    return code ? 'other' : '';
  }

  private normalizeGender(raw: string): string {
    const code = String(raw ?? '').trim().toLowerCase();
    return (CUSTOMER_GENDERS as readonly string[]).includes(code) ? code : '';
  }
}
