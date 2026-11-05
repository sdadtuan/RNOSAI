import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrdersPgRepository } from '../orders/orders-pg.repository';
import { InvoicesPgRepository } from './invoices-pg.repository';
import { CreateInvoiceBody, IssueInvoiceBody, PatchInvoiceBody } from './invoices.types';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repo: InvoicesPgRepository,
    private readonly orders: OrdersPgRepository,
  ) {}

  async list(query: {
    customer_id?: string;
    lifecycle_id?: string;
    status?: string;
    overdue?: string;
    limit?: string;
  }) {
    return {
      invoices: await this.repo.list({
        customerId: query.customer_id ? Number(query.customer_id) : undefined,
        lifecycleId: query.lifecycle_id ? Number(query.lifecycle_id) : undefined,
        status: query.status?.trim() || undefined,
        overdue: query.overdue === '1' || query.overdue === 'true',
        limit: query.limit ? Number(query.limit) : 50,
      }),
    };
  }

  async detail(id: number) {
    const invoice = await this.repo.getById(id, true);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async create(body: CreateInvoiceBody) {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'customer_id_required' });
    }
    const invoice = await this.repo.create(body);
    return { invoice };
  }

  async createFromOrder(orderId: number, body: IssueInvoiceBody = {}) {
    const order = await this.orders.getById(orderId, true);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id: orderId });
    if (order.status === 'cancelled') {
      throw new BadRequestException({ error: 'order_cancelled' });
    }
    const invoice = await this.repo.createFromOrder(order, body.due_on);
    if (body.issued_on || body.due_on) {
      await this.repo.issue(invoice.id, body.issued_on, body.due_on ?? invoice.due_on);
    }
    return { invoice: await this.repo.getById(invoice.id, true) };
  }

  async patch(id: number, body: PatchInvoiceBody) {
    const invoice = await this.repo.patch(id, body);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async issue(id: number, body: IssueInvoiceBody = {}) {
    const invoice = await this.repo.issue(id, body.issued_on, body.due_on);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async void(id: number) {
    const invoice = await this.repo.voidInvoice(id);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }

  async syncPaid(id: number) {
    const invoice = await this.repo.syncPaidStatus(id);
    if (!invoice) throw new NotFoundException({ error: 'invoice_not_found', id });
    return { invoice };
  }
}
