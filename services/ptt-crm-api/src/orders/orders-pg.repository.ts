import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import {
  billingTodayIso,
  billingTsNow,
  ensureBillingSchemaPg,
} from '../billing/billing-schema-pg.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateOrderBody,
  CreateOrderLineBody,
  OrderLineRow,
  OrderRow,
  OrderStatus,
  PatchOrderBody,
} from './orders.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapOrder(row: Record<string, unknown>): OrderRow {
  return {
    id: Number(row.id),
    reference_code: String(row.reference_code ?? ''),
    customer_id: Number(row.customer_id),
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    proposal_id: row.proposal_id != null ? Number(row.proposal_id) : null,
    lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
    lead_id: row.lead_id != null ? Number(row.lead_id) : null,
    status: String(row.status ?? 'draft') as OrderStatus,
    order_date: String(row.order_date ?? ''),
    total_vnd: Number(row.total_vnd ?? 0),
    billing_type: String(row.billing_type ?? 'one_off'),
    notes: String(row.notes ?? ''),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

function mapLine(row: Record<string, unknown>): OrderLineRow {
  return {
    id: Number(row.id),
    order_id: Number(row.order_id),
    product_slug: String(row.product_slug ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price_vnd: Number(row.unit_price_vnd ?? 0),
    amount_vnd: Number(row.amount_vnd ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

@Injectable()
export class OrdersPgRepository implements OnModuleDestroy {
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
      this.schemaReady = ensureBillingSchemaPg(this.db);
    }
    await this.schemaReady;
  }

  async list(filters: {
    customerId?: number;
    lifecycleId?: number;
    status?: string;
    limit?: number;
  }): Promise<OrderRow[]> {
    await this.ensureSchema();
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.customerId) {
      params.push(filters.customerId);
      clauses.push(`customer_id = $${params.length}`);
    }
    if (filters.lifecycleId) {
      params.push(filters.lifecycleId);
      clauses.push(`lifecycle_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    const result = await this.db.query(
      `SELECT * FROM crm_orders ${where} ORDER BY id DESC LIMIT $${params.length}`,
      params,
    );
    return result.rows.map(mapOrder);
  }

  async getById(id: number, withLines = false): Promise<OrderRow | null> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT * FROM crm_orders WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    const order = mapOrder(result.rows[0]);
    if (withLines) order.lines = await this.listLines(id);
    return order;
  }

  async listLines(orderId: number): Promise<OrderLineRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_order_lines WHERE order_id = $1 ORDER BY sort_order, id',
      [orderId],
    );
    return result.rows.map(mapLine);
  }

  async customerExists(customerId: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT id FROM crm_customers WHERE id = $1', [customerId]);
    return result.rows[0] != null;
  }

  private async optionalTableExists(name: 'crm_proposals'): Promise<boolean> {
    const result = await this.db.query('SELECT to_regclass($1) AS table_name', [`public.${name}`]);
    return result.rows[0]?.table_name != null;
  }

  async proposalExists(proposalId: number): Promise<boolean> {
    await this.ensureSchema();
    if (!(await this.optionalTableExists('crm_proposals'))) return false;
    const result = await this.db.query('SELECT id FROM crm_proposals WHERE id = $1', [proposalId]);
    return result.rows[0] != null;
  }

  async getProposal(proposalId: number): Promise<Record<string, unknown> | null> {
    await this.ensureSchema();
    if (!(await this.optionalTableExists('crm_proposals'))) return null;
    const result = await this.db.query('SELECT * FROM crm_proposals WHERE id = $1', [proposalId]);
    return result.rows[0] ?? null;
  }

  private async recalcTotal(orderId: number): Promise<number> {
    const result = await this.db.query(
      'SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM crm_order_lines WHERE order_id = $1',
      [orderId],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    await this.db.query(
      'UPDATE crm_orders SET total_vnd = $1, updated_at = $2 WHERE id = $3',
      [total, billingTsNow(), orderId],
    );
    return total;
  }

  async create(body: CreateOrderBody): Promise<OrderRow> {
    await this.ensureSchema();
    const ts = billingTsNow();
    const orderDate = String(body.order_date ?? billingTodayIso()).slice(0, 10);
    const result = await this.db.query(
      `INSERT INTO crm_orders (
         reference_code, customer_id, contract_id, proposal_id, lifecycle_id, lead_id,
         status, order_date, total_vnd, billing_type, notes, created_at, updated_at
       ) VALUES ('', $1, $2, $3, $4, $5, 'draft', $6, 0, $7, $8, $9, $9)
       RETURNING id`,
      [
        Number(body.customer_id),
        body.contract_id != null ? Number(body.contract_id) : null,
        body.proposal_id != null ? Number(body.proposal_id) : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        body.lead_id != null ? Number(body.lead_id) : null,
        orderDate,
        String(body.billing_type ?? 'one_off'),
        String(body.notes ?? '').slice(0, 4000),
        ts,
      ],
    );
    const id = Number(result.rows[0].id);
    const referenceCode = `SO-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
    await this.db.query('UPDATE crm_orders SET reference_code = $1 WHERE id = $2', [referenceCode, id]);
    for (const line of body.lines ?? []) {
      await this.addLine(id, line);
    }
    if ((body.lines ?? []).length === 0) {
      await this.recalcTotal(id);
    }
    return (await this.getById(id, true))!;
  }

  async createFromProposal(proposalId: number): Promise<OrderRow | null> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return null;
    let serviceSlugs: string[] = [];
    try {
      serviceSlugs = JSON.parse(String(proposal.service_slugs ?? '[]')) as string[];
    } catch {
      serviceSlugs = [];
    }
    const total = Number(proposal.total_vnd ?? 0);
    const perLine = serviceSlugs.length ? Math.round(total / serviceSlugs.length) : total;
    const order = await this.create({
      customer_id: Number(proposal.customer_id),
      proposal_id: proposalId,
      lifecycle_id: proposal.lifecycle_id != null ? Number(proposal.lifecycle_id) : null,
      billing_type: 'one_off',
      notes: String(proposal.notes ?? ''),
      lines: serviceSlugs.map((slug, index) => ({
        product_slug: slug,
        description: slug,
        quantity: 1,
        unit_price_vnd: perLine,
        amount_vnd: perLine,
        sort_order: index,
      })),
    });
    if (serviceSlugs.length === 0 && total > 0) {
      await this.addLine(order.id, {
        description: 'Proposal total',
        quantity: 1,
        unit_price_vnd: total,
        amount_vnd: total,
      });
    }
    return this.getById(order.id, true);
  }

  async patch(id: number, body: PatchOrderBody): Promise<OrderRow | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    await this.db.query(
      `UPDATE crm_orders
       SET status = $2, order_date = $3, billing_type = $4, notes = $5,
           contract_id = $6, lifecycle_id = $7, updated_at = $8
       WHERE id = $1`,
      [
        id,
        body.status ?? existing.status,
        body.order_date != null ? String(body.order_date).slice(0, 10) : existing.order_date,
        body.billing_type ?? existing.billing_type,
        body.notes != null ? String(body.notes).slice(0, 4000) : existing.notes,
        body.contract_id !== undefined ? body.contract_id : existing.contract_id,
        body.lifecycle_id !== undefined ? body.lifecycle_id : existing.lifecycle_id,
        billingTsNow(),
      ],
    );
    return this.getById(id, true);
  }

  async setStatus(id: number, status: OrderStatus): Promise<OrderRow | null> {
    return this.patch(id, { status });
  }

  async addLine(orderId: number, body: CreateOrderLineBody): Promise<OrderLineRow> {
    await this.ensureSchema();
    const quantity = Math.max(1, Number(body.quantity ?? 1));
    const unitPrice = Math.max(0, Number(body.unit_price_vnd ?? 0));
    const amount = body.amount_vnd != null
      ? Math.max(0, Number(body.amount_vnd))
      : quantity * unitPrice;
    const result = await this.db.query(
      `INSERT INTO crm_order_lines (
         order_id, product_slug, description, quantity, unit_price_vnd, amount_vnd, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        orderId,
        String(body.product_slug ?? ''),
        String(body.description ?? body.product_slug ?? ''),
        quantity,
        unitPrice,
        amount,
        Number(body.sort_order ?? 0),
      ],
    );
    await this.recalcTotal(orderId);
    return mapLine(result.rows[0]);
  }

  async deleteLine(lineId: number): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.db.query(
      'DELETE FROM crm_order_lines WHERE id = $1 RETURNING order_id',
      [lineId],
    );
    if (!result.rows[0]) return false;
    await this.recalcTotal(Number(result.rows[0].order_id));
    return true;
  }
}
