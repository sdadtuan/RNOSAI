import { Injectable } from '@nestjs/common';
import { TicketsSqliteRepository } from './tickets-sqlite.repository';
import type { CreateTicketBody, ListTicketsQuery, PatchTicketBody, TicketRow } from './tickets.types';

@Injectable()
export class TicketsService {
  constructor(private readonly repo: TicketsSqliteRepository) {}

  list(query: ListTicketsQuery) {
    return this.repo.list(query);
  }

  create(body: CreateTicketBody): TicketRow {
    return this.repo.create(body);
  }

  patch(id: number, body: PatchTicketBody): TicketRow {
    return this.repo.patch(id, body);
  }
}
