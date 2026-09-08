import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { mapLineRow, mapProposalRow, ProposalsPgRepository } from './proposals-pg.repository';

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

describe('mapProposalRow / mapLineRow Quote OS GET', () => {
  const dealRoomRow = {
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
    status: 'mystery',
    valid_until: null,
    price_adjustment_reason: '',
    created_at: '2026-08-27T00:00:00.000Z',
    updated_at: '2026-08-27T00:00:00.000Z',
  };

  it('returns raw 14-status and QT header fields for quote_code rows', () => {
    const mapped = mapProposalRow({
      ...dealRoomRow,
      quote_code: 'QT-PTT-2026-000001',
      current_version_id: 'ver-1',
      row_version: 4,
      status: 'pending_approval',
      title: 'An Phát Q3',
      objective: 'Win retainer',
      audience: 'CFO',
      campaign_period: '2026-Q3',
      agency_client_id: '19d722af-0000-4000-8000-000000000002',
    });

    expect(mapped.status).toBe('pending_approval');
    expect(mapped.status).not.toBe('draft');
    expect(mapped).toMatchObject({
      title: 'An Phát Q3',
      objective: 'Win retainer',
      audience: 'CFO',
      campaign_period: '2026-Q3',
      agency_client_id: '19d722af-0000-4000-8000-000000000002',
      row_version: 4,
      current_version_id: 'ver-1',
      quote_code: 'QT-PTT-2026-000001',
    });
  });

  it('keeps Deal Room GET shape and maps unknown status to draft', () => {
    const mapped = mapProposalRow(dealRoomRow);
    expect(mapped.status).toBe('draft');
    expect(mapped).not.toHaveProperty('title');
    expect(mapped).not.toHaveProperty('objective');
    expect(mapped).not.toHaveProperty('audience');
    expect(mapped).not.toHaveProperty('campaign_period');
    expect(mapped).not.toHaveProperty('agency_client_id');
  });

  it('includes QT line fields and omits null cost_* instead of sending 0', () => {
    const mapped = mapLineRow(
      {
        id: 11,
        proposal_id: 9,
        dv_code: 'DV02',
        sku_code: 'DV02-TC',
        package_tier: 'standard',
        service_slug: 'content',
        reference_price_min: 20000000,
        reference_price_max: 30000000,
        final_price_vnd: 25000000,
        scope_notes: '',
        lifecycle_id: null,
        sort_order: 0,
        item_type: 'fee',
        qty: 2,
        media_amount_vnd: 0,
        client_visible: true,
        catalog_snapshot_json: { rate: { suggested_vnd: 25000000 } },
        cost_labor_vnd: null,
        cost_outsource_vnd: null,
        cost_other_vnd: null,
      },
      { quoteOs: true },
    );

    expect(mapped).toMatchObject({
      item_type: 'fee',
      media_vnd: 0,
      client_visible: true,
      qty: 2,
      package_tier: 'standard',
      catalog_snapshot_json: { rate: { suggested_vnd: 25000000 } },
    });
    expect(mapped).not.toHaveProperty('cost_labor_vnd');
    expect(mapped).not.toHaveProperty('cost_outsource_vnd');
    expect(mapped).not.toHaveProperty('cost_other_vnd');
    expect(JSON.stringify(mapped)).not.toMatch(/"cost_\w+_vnd":0/);
  });

  it('omits unknown item_type and media on Quote OS lines', () => {
    const mapped = mapLineRow(
      {
        id: 11,
        proposal_id: 9,
        dv_code: 'DV02',
        sku_code: null,
        package_tier: 'standard',
        service_slug: 'content',
        reference_price_min: 0,
        reference_price_max: 0,
        final_price_vnd: 0,
        scope_notes: '',
        lifecycle_id: null,
        sort_order: 0,
      },
      { quoteOs: true },
    );
    expect(mapped).not.toHaveProperty('item_type');
    expect(mapped).not.toHaveProperty('media_vnd');
    expect(mapped).not.toHaveProperty('cost_labor_vnd');
  });

  it('includes real cost_* on Quote OS lines', () => {
    const mapped = mapLineRow(
      {
        id: 11,
        proposal_id: 9,
        dv_code: 'DV02',
        sku_code: 'DV02-TC',
        package_tier: 'premium',
        service_slug: 'content',
        reference_price_min: 0,
        reference_price_max: 0,
        final_price_vnd: 25000000,
        scope_notes: '',
        lifecycle_id: null,
        sort_order: 0,
        item_type: 'fee',
        qty: 1,
        media_vnd: 40000000,
        client_visible: false,
        catalog_snapshot_json: '{}',
        cost_labor_vnd: 8000000,
      },
      { quoteOs: true },
    );
    expect(mapped.cost_labor_vnd).toBe(8000000);
    expect(mapped.media_vnd).toBe(40000000);
    expect(mapped.client_visible).toBe(false);
    expect(mapped).not.toHaveProperty('cost_outsource_vnd');
  });

  it('keeps Deal Room line GET shape without QT keys', () => {
    const mapped = mapLineRow({
      id: 11,
      proposal_id: 9,
      dv_code: 'DV02',
      sku_code: 'DV02-TC',
      package_tier: 'standard',
      service_slug: 'content',
      reference_price_min: 20000000,
      reference_price_max: 30000000,
      final_price_vnd: 25000000,
      scope_notes: '',
      lifecycle_id: null,
      sort_order: 0,
      item_type: 'fee',
      qty: 1,
      media_amount_vnd: 0,
      client_visible: true,
      catalog_snapshot_json: {},
      cost_labor_vnd: null,
    });
    expect(mapped).not.toHaveProperty('item_type');
    expect(mapped).not.toHaveProperty('media_vnd');
    expect(mapped).not.toHaveProperty('client_visible');
    expect(mapped).not.toHaveProperty('catalog_snapshot_json');
    expect(mapped).not.toHaveProperty('qty');
    expect(mapped).not.toHaveProperty('cost_labor_vnd');
    expect(mapped.package_tier).toBe('standard');
    expect(mapped.dv_code).toBe('DV02');
  });
});
