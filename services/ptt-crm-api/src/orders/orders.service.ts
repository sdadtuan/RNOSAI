import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrdersPgRepository } from './orders-pg.repository';
import { CreateOrderBody, CreateOrderLineBody, PatchOrderBody } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersPgRepository) {}

  async list(query: { customer_id?: string; lifecycle_id?: string; status?: string; limit?: string }) {
    return {
      orders: await this.repo.list({
        customerId: query.customer_id ? Number(query.customer_id) : undefined,
        lifecycleId: query.lifecycle_id ? Number(query.lifecycle_id) : undefined,
        status: query.status?.trim() || undefined,
        limit: query.limit ? Number(query.limit) : 50,
      }),
    };
  }

  async detail(id: number) {
    const order = await this.repo.getById(id, true);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async create(body: CreateOrderBody) {
    const customerId = Number(body.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'customer_id_required' });
    }
    if (!(await this.repo.customerExists(customerId))) {
      throw new NotFoundException({ error: 'customer_not_found', customer_id: customerId });
    }
    const order = await this.repo.create(body);
    return { order };
  }

  async convertFromProposal(proposalId: number) {
    if (!Number.isFinite(proposalId) || proposalId <= 0) {
      throw new BadRequestException({ error: 'proposal_id_required' });
    }
    const order = await this.repo.createFromProposal(proposalId);
    if (!order) throw new NotFoundException({ error: 'proposal_not_found', proposal_id: proposalId });
    return { order };
  }

  async patch(id: number, body: PatchOrderBody) {
    const order = await this.repo.patch(id, body);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async confirm(id: number) {
    const order = await this.repo.setStatus(id, 'confirmed');
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async cancel(id: number) {
    const order = await this.repo.setStatus(id, 'cancelled');
    if (!order) throw new NotFoundException({ error: 'order_not_found', id });
    return { order };
  }

  async addLine(orderId: number, body: CreateOrderLineBody) {
    const order = await this.repo.getById(orderId);
    if (!order) throw new NotFoundException({ error: 'order_not_found', id: orderId });
    if (order.status === 'cancelled') {
      throw new BadRequestException({ error: 'order_cancelled' });
    }
    const line = await this.repo.addLine(orderId, body);
    return { order: await this.repo.getById(orderId, true), line };
  }

  async deleteLine(lineId: number) {
    const ok = await this.repo.deleteLine(lineId);
    if (!ok) throw new NotFoundException({ error: 'order_line_not_found', id: lineId });
    return { ok: true };
  }
}
