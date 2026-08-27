import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { ProposalsPgRepository } from './proposals-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('Proposals Wave 1 wiring', () => {
  it('uses PostgreSQL across proposals, meeting prep, and deal room', () => {
    const proposalsService = fs.readFileSync(path.join(__dirname, 'proposals.service.ts'), 'utf8');
    const proposalsModule = fs.readFileSync(path.join(__dirname, 'proposals.module.ts'), 'utf8');
    const meetingPrep = fs.readFileSync(
      path.join(__dirname, '../lead-meeting-prep/lead-meeting-prep.service.ts'),
      'utf8',
    );
    const dealRoom = fs.readFileSync(
      path.join(__dirname, '../deal-room/deal-room.service.ts'),
      'utf8',
    );

    for (const source of [proposalsService, proposalsModule, meetingPrep, dealRoom]) {
      expect(source).not.toMatch(/ProposalsSqliteRepository|proposals-sqlite/);
    }
    expect(proposalsService).toMatch(/ProposalsPgRepository/);
    expect(proposalsModule).toMatch(/ProposalsPgRepository/);
    expect(meetingPrep).toMatch(/ProposalsPgRepository/);
    expect(dealRoom).toMatch(/ProposalsPgRepository/);
  });
});

describe('ProposalsPgRepository', () => {
  const query = jest.fn();
  let repo: ProposalsPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new ProposalsPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('creates the complete proposals and quote-line schema before listing', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          customer_id: 3,
          lead_id: 4,
          presales_id: null,
          lifecycle_id: null,
          service_slugs: '["video-sop"]',
          total_vnd: '12000000',
          timeline_months: 2,
          notes: '',
          ai_output: '{}',
          status: 'draft',
          valid_until: null,
          price_adjustment_reason: '',
          created_at: '2026-08-27T00:00:00.000Z',
          updated_at: '2026-08-27T00:00:00.000Z',
        }],
      });

    const rows = await repo.listByLeadId(4);

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_proposals');
    expect(schema).toContain('customer_id INTEGER');
    expect(schema).toContain('lead_id INTEGER');
    expect(schema).toContain('presales_id INTEGER');
    expect(schema).toContain('lifecycle_id INTEGER');
    expect(schema).toContain('service_slugs TEXT');
    expect(schema).toContain('total_vnd BIGINT');
    expect(schema).toContain('timeline_months INTEGER');
    expect(schema).toContain('notes TEXT');
    expect(schema).toContain('ai_output TEXT');
    expect(schema).toContain('status TEXT');
    expect(schema).toContain('valid_until TEXT');
    expect(schema).toContain('price_adjustment_reason TEXT');
    expect(schema).toContain('created_at TEXT');
    expect(schema).toContain('updated_at TEXT');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_quote_line_item');
    expect(schema).toContain('proposal_id INTEGER NOT NULL');
    expect(schema).toContain('dv_code TEXT');
    expect(schema).toContain('sku_code TEXT');
    expect(schema).toContain('package_tier TEXT');
    expect(schema).toContain('service_slug TEXT');
    expect(schema).toContain('reference_price_min BIGINT');
    expect(schema).toContain('reference_price_max BIGINT');
    expect(schema).toContain('final_price_vnd BIGINT');
    expect(schema).toContain('scope_notes TEXT');
    expect(schema).toContain('sort_order INTEGER');
    expect(query.mock.calls[1]).toEqual([
      'SELECT * FROM crm_proposals WHERE lead_id = $1 ORDER BY id DESC',
      [4],
    ]);
    expect(rows[0]).toMatchObject({
      id: 7,
      lead_id: 4,
      service_slugs: ['video-sop'],
      total_vnd: 12000000,
      status: 'draft',
    });
  });

  it('creates proposals with PostgreSQL parameters and returns the generated id', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 12 }] });

    const created = await repo.create({
      customer_id: 3,
      lead_id: 4,
      service_slugs: [' video-sop ', ''],
      total_vnd: 9000000,
      timeline_months: 2,
      notes: 'Phạm vi',
      valid_until: '2026-09-30-extra',
    });

    expect(query.mock.calls[1][0]).toContain('INSERT INTO crm_proposals');
    expect(query.mock.calls[1][0]).toContain('RETURNING id');
    expect(query.mock.calls[1][1].slice(0, 8)).toEqual([
      3,
      4,
      null,
      null,
      '["video-sop"]',
      9000000,
      2,
      'Phạm vi',
    ]);
    expect(query.mock.calls[1][1][8]).toBe('2026-09-30');
    expect(created).toEqual({ id: 12 });
  });
});
