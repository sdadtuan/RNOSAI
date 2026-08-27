import { Injectable } from '@nestjs/common';
import { TicketsPgRepository } from './tickets-pg.repository';
import type {
  CreateTicketBody,
  CreateTicketMessageBody,
  ListTicketsQuery,
  PatchTicketBody,
} from './tickets.types';

@Injectable()
export class TicketsService {
  constructor(private readonly repo: TicketsPgRepository) {}

  list(query: ListTicketsQuery) {
    return this.repo.list(query);
  }

  getById(id: number) {
    return this.repo.getById(id);
  }

  create(body: CreateTicketBody) {
    return this.repo.create(body);
  }

  patch(id: number, body: PatchTicketBody) {
    return this.repo.patch(id, body);
  }

  listMessages(ticketId: number) {
    return this.repo.listMessages(ticketId);
  }

  addMessage(ticketId: number, body: CreateTicketMessageBody) {
    return this.repo.addMessage(ticketId, body);
  }
}
