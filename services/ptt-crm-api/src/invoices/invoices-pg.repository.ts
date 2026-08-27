import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import {
  billingTodayIso,
  billingTsNow,
  ensureBillingSchemaPg,
} from '../billing/billing-schema-pg.util';
import { AppConfigService } from '../config/app-config.service';
import { OrderLineRow } from '../orders/orders.types';
import {
  CreateInvoiceBody,
  InvoiceLineRow,
  InvoiceRow,
  InvoiceStatus,
  PatchInvoiceBody,
} from './invoices.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    id: Number(row.id),
    invoice_number: String(row.invoice_number ?? ''),
    order_id: row.order_id != null ? Number(row.order_id) : null,
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    lifecycle_id: row.lifecycle_id != null ? Number(row.lifecycle_id) : null,
    customer_id: Number(row.customer_id),
    status: String(row.status ?? 'draft') as InvoiceStatus,
    issued_on: String(row.issued_on ?? ''),
    due_on: String(row.due_on ?? ''),
    amount_vnd: Number(row.amount_vnd ?? 0),
    paid_vnd: Number(row.paid_vnd ?? 0),
    notes: String(row.notes ?? ''),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

function mapLine(row: Record<string, unknown>): InvoiceLineRow {
  return {
    id: Number(row.id),
    invoice_id: Number(row.invoice_id),
    product_slug: String(row.product_slug ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity ?? 1),
    unit_price_vnd: Number(row.unit_price_vnd ?? 0),
    amount_vnd: Number(row.amount_vnd ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

@Injectable()
export class InvoicesPgRepository implements OnModuleDestroy {
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
    overdue?: boolean;
    limit?: number;
  }): Promise<InvoiceRow[]> {
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
    if (filters.overdue) {
      params.push(billingTodayIso());
      clauses.push(
        `status IN ('issued', 'partial', 'overdue') AND due_on != '' AND due_on < $${params.length}`,
      );
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    const result = await this.db.query(
      `SELECT * FROM crm_invoices ${where} ORDER BY due_on ASC, id DESC LIMIT $${params.length}`,
      params,
    );
    return Promise.all(result.rows.map((row) => this.refreshOverdueStatus(mapInvoice(row))));
  }

  async getById(id: number, withLines = false): Promise<InvoiceRow | null> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT * FROM crm_invoices WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    const invoice = await this.refreshOverdueStatus(mapInvoice(result.rows[0]));
    if (withLines) invoice.lines = await this.listLines(id);
    return invoice;
  }

  async listLines(invoiceId: number): Promise<InvoiceLineRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, id',
      [invoiceId],
    );
    return result.rows.map(mapLine);
  }

  async lifecycleInvoiceAr(
    lifecycleId: number,
  ): Promise<{ ar_pending_vnd: number; ar_overdue_vnd: number }> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT amount_vnd, paid_vnd, due_on, status FROM crm_invoices
       WHERE lifecycle_id = $1 AND status IN ('issued', 'partial', 'overdue')`,
      [lifecycleId],
    );
    const today = billingTodayIso();
    let pending = 0;
    let overdue = 0;
    for (const row of result.rows) {
      const open = Math.max(0, Number(row.amount_vnd ?? 0) - Number(row.paid_vnd ?? 0));
      if (open <= 0) continue;
      pending += open;
      const due = String(row.due_on ?? '').slice(0, 10);
      if (due && due < today) overdue += open;
    }
    return { ar_pending_vnd: pending, ar_overdue_vnd: overdue };
  }

  async refreshOverdueStatus(invoice: InvoiceRow): Promise<InvoiceRow> {
    const today = billingTodayIso();
    if (
      ['issued', 'partial'].includes(invoice.status)
      && invoice.due_on
      && invoice.due_on < today
      && invoice.amount_vnd > invoice.paid_vnd
    ) {
      await this.db.query(
        `UPDATE crm_invoices
         SET status = 'overdue', updated_at = $1
         WHERE id = $2 AND status IN ('issued', 'partial')`,
        [billingTsNow(), invoice.id],
      );
      return { ...invoice, status: 'overdue' };
    }
    return invoice;
  }

  private async recalcTotal(invoiceId: number): Promise<number> {
    const result = await this.db.query(
      'SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM crm_invoice_lines WHERE invoice_id = $1',
      [invoiceId],
    );
    const total = Number(result.rows[0]?.total ?? 0);
    await this.db.query(
      'UPDATE crm_invoices SET amount_vnd = $1, updated_at = $2 WHERE id = $3',
      [total, billingTsNow(), invoiceId],
    );
    await this.syncPaidStatus(invoiceId);
    return total;
  }

  private async paymentsTableExists(): Promise<boolean> {
    const result = await this.db.query(
      "SELECT to_regclass('public.crm_svc_payments') AS table_name",
    );
    return result.rows[0]?.table_name != null;
  }

  async syncPaidStatus(invoiceId: number): Promise<InvoiceRow | null> {
    const invoice = await this.getById(invoiceId);
    if (!invoice) return null;
    let paid = 0;
    if (await this.paymentsTableExists()) {
      const result = await this.db.query(
        `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0) AS paid
         FROM crm_svc_payments WHERE invoice_id = $1`,
        [invoiceId],
      );
      paid = Number(result.rows[0]?.paid ?? 0);
    }
    let status = invoice.status;
    if (status !== 'void' && status !== 'draft') {
      if (paid >= invoice.amount_vnd && invoice.amount_vnd > 0) status = 'paid';
      else if (paid > 0) status = 'partial';
      else if (status === 'paid' || status === 'partial') status = 'issued';
    }
    await this.db.query(
      'UPDATE crm_invoices SET paid_vnd = $1, status = $2, updated_at = $3 WHERE id = $4',
      [paid, status, billingTsNow(), invoiceId],
    );
    return this.getById(invoiceId, true);
  }

  async create(body: CreateInvoiceBody): Promise<InvoiceRow> {
    await this.ensureSchema();
    const ts = billingTsNow();
    const result = await this.db.query(
      `INSERT INTO crm_invoices (
         invoice_number, order_id, contract_id, lifecycle_id, customer_id,
         status, issued_on, due_on, amount_vnd, paid_vnd, notes, created_at, updated_at
       ) VALUES ('', $1, $2, $3, $4, 'draft', $5, $6, $7, 0, $8, $9, $9)
       RETURNING id`,
      [
        body.order_id != null ? Number(body.order_id) : null,
        body.contract_id != null ? Number(body.contract_id) : null,
        body.lifecycle_id != null ? Number(body.lifecycle_id) : null,
        Number(body.customer_id),
        String(body.issued_on ?? '').slice(0, 10),
        String(body.due_on ?? '').slice(0, 10),
        Math.max(0, Number(body.amount_vnd ?? 0)),
        String(body.notes ?? '').slice(0, 4000),
        ts,
      ],
    );
    const id = Number(result.rows[0].id);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
    await this.db.query('UPDATE crm_invoices SET invoice_number = $1 WHERE id = $2', [
      invoiceNumber,
      id,
    ]);
    for (const line of body.lines ?? []) {
      await this.addLine(id, line);
    }
    if ((body.lines ?? []).length === 0 && body.amount_vnd == null) {
      await this.recalcTotal(id);
    }
    return (await this.getById(id, true))!;
  }

  async createFromOrder(
    order: {
      id: number;
      customer_id: number;
      contract_id: number | null;
      lifecycle_id: number | null;
      total_vnd: number;
      lines?: OrderLineRow[];
    },
    dueOn?: string,
  ): Promise<InvoiceRow> {
    return this.create({
      customer_id: order.customer_id,
      order_id: order.id,
      contract_id: order.contract_id,
      lifecycle_id: order.lifecycle_id,
      due_on: dueOn ?? '',
      amount_vnd: order.total_vnd,
      lines: (order.lines ?? []).map((line, index) => ({
        product_slug: line.product_slug,
        description: line.description,
        quantity: line.quantity,
        unit_price_vnd: line.unit_price_vnd,
        amount_vnd: line.amount_vnd,
        sort_order: index,
      })),
    });
  }

  async patch(id: number, body: PatchInvoiceBody): Promise<InvoiceRow | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    await this.db.query(
      `UPDATE crm_invoices
       SET status = $2, issued_on = $3, due_on = $4, notes = $5,
           contract_id = $6, lifecycle_id = $7, updated_at = $8
       WHERE id = $1`,
      [
        id,
        body.status ?? existing.status,
        body.issued_on != null ? String(body.issued_on).slice(0, 10) : existing.issued_on,
        body.due_on != null ? String(body.due_on).slice(0, 10) : existing.due_on,
        body.notes != null ? String(body.notes).slice(0, 4000) : existing.notes,
        body.contract_id !== undefined ? body.contract_id : existing.contract_id,
        body.lifecycle_id !== undefined ? body.lifecycle_id : existing.lifecycle_id,
        billingTsNow(),
      ],
    );
    return this.getById(id, true);
  }

  async issue(id: number, issuedOn?: string, dueOn?: string): Promise<InvoiceRow | null> {
    const existing = await this.getById(id);
    if (!existing || existing.status === 'void') return null;
    await this.db.query(
      `UPDATE crm_invoices
       SET status = 'issued', issued_on = $2, due_on = $3, updated_at = $4
       WHERE id = $1`,
      [
        id,
        String(issuedOn ?? billingTodayIso()).slice(0, 10),
        String(dueOn ?? existing.due_on ?? '').slice(0, 10),
        billingTsNow(),
      ],
    );
    return this.getById(id, true);
  }

  async voidInvoice(id: number): Promise<InvoiceRow | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    await this.db.query(
      "UPDATE crm_invoices SET status = 'void', updated_at = $2 WHERE id = $1",
      [id, billingTsNow()],
    );
    return this.getById(id, true);
  }

  async addLine(
    invoiceId: number,
    body: {
      product_slug?: string;
      description?: string;
      quantity?: number;
      unit_price_vnd?: number;
      amount_vnd?: number;
      sort_order?: number;
    },
  ): Promise<InvoiceLineRow> {
    await this.ensureSchema();
    const quantity = Math.max(1, Number(body.quantity ?? 1));
    const unitPrice = Math.max(0, Number(body.unit_price_vnd ?? 0));
    const amount = body.amount_vnd != null
      ? Math.max(0, Number(body.amount_vnd))
      : quantity * unitPrice;
    const result = await this.db.query(
      `INSERT INTO crm_invoice_lines (
         invoice_id, product_slug, description, quantity, unit_price_vnd, amount_vnd, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        invoiceId,
        String(body.product_slug ?? ''),
        String(body.description ?? body.product_slug ?? ''),
        quantity,
        unitPrice,
        amount,
        Number(body.sort_order ?? 0),
      ],
    );
    await this.recalcTotal(invoiceId);
    return mapLine(result.rows[0]);
  }
}
