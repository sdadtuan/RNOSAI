import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { TicketsPgRepository } from './tickets-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('TicketsModule Wave 1', () => {
  it('wires tickets exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'tickets.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'tickets.module.ts'), 'utf8');

    expect(service).not.toMatch(/TicketsSqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/TicketsSqliteRepository|DatabaseSync|sqlitePath/);
    expect(service).toMatch(/TicketsPgRepository/);
    expect(module).toMatch(/TicketsPgRepository/);
  });
});

describe('TicketsPgRepository', () => {
  const query = jest.fn();
  let repo: TicketsPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new TicketsPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('creates ticket tables before listing and uses PostgreSQL search', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ n: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repo.list({ q: 'khẩn', limit: 999 });

    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS crm_tickets');
    expect(query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS crm_ticket_messages');
    expect(query.mock.calls[0][0]).toContain('is_internal BOOLEAN NOT NULL DEFAULT TRUE');
    expect(query.mock.calls[1][0]).toContain('ILIKE');
    expect(query.mock.calls[1][1]).toEqual(['%khẩn%']);
    expect(query.mock.calls[2][1]).toEqual(['%khẩn%', 300, 0]);
    expect(result).toEqual({ tickets: [], total: 0 });
  });

  it('maps PostgreSQL message booleans to the API boolean type', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 3,
            ticket_id: 8,
            author_staff_id: null,
            author_staff_name: null,
            body: 'Trao đổi nội bộ',
            is_internal: false,
            created_at: new Date('2026-08-27T00:00:00.000Z'),
          },
        ],
      });

    const messages = await repo.listMessages(8);

    expect(messages[0]).toEqual({
      id: 3,
      ticket_id: 8,
      author_staff_id: null,
      author_staff_name: 'Hệ thống',
      body: 'Trao đổi nội bộ',
      is_internal: false,
      created_at: '2026-08-27T00:00:00.000Z',
    });
  });

  it('applies ticket field limits when patching', async () => {
    const existing = {
      id: 8,
      customer_id: 7,
      ticket_type: 'phan_anh',
      status: 'moi',
      priority: 'binh_thuong',
      channel: 'khac',
      title: 'Cũ',
      description: '',
      resolution: '',
      assigned_staff_id: null,
      resolved_at: null,
    };
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existing] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...existing, title: 'a'.repeat(400), description: 'Mới' }] });

    await repo.patch(8, { title: 'a'.repeat(401), description: ' Mới ' });

    expect(query.mock.calls[2][1][5]).toBe('a'.repeat(400));
    expect(query.mock.calls[2][1][6]).toBe('Mới');
  });
});
