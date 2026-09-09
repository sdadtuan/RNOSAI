import { leadRowToV1, pgRowToV1 } from './lead-v1.mapper';
import { LeadRow, PgLeadRow } from './leads.types';

describe('leadRowToV1', () => {
  it('matches Python contract for canonical row', () => {
    const row: LeadRow = {
      id: 1,
      full_name: 'Lead A',
      phone: '0901111111',
      email: '',
      status: 'new',
      source: 'facebook',
      owner_id: null,
      created_at: '2026-07-17',
      is_duplicate: 0,
      meta_json: JSON.stringify({
        agency_client_id: '550e8400-e29b-41d4-a716-446655440000',
        channel: 'meta',
        facebook_leadgen_id: 'fb-1',
      }),
    };

    expect(leadRowToV1(row)).toEqual({
      id: 1,
      full_name: 'Lead A',
      phone: '0901111111',
      email: '',
      status: 'new',
      source: 'facebook',
      channel: 'meta',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      campaign_id: null,
      external_lead_id: 'fb-1',
      owner_id: null,
      created_at: '2026-07-17',
      received_at: '2026-07-17',
      is_duplicate: false,
      expected_value: null,
      margin_pct: null,
      review_queue: { active: false },
      company_name: '',
      company_address: '',
      logo_asset_id: null,
    });
  });

  it('maps company_name from meta when column is empty and never uses full_name', () => {
    const row: LeadRow = {
      id: 5,
      full_name: 'Tuan Truong',
      phone: '0901',
      email: '',
      status: 'new',
      source: 'facebook',
      owner_id: null,
      created_at: '2026-09-09',
      is_duplicate: 0,
      meta_json: JSON.stringify({ company_name: '360 Auto Detailing' }),
    };
    const out = leadRowToV1(row);
    expect(out.company_name).toBe('360 Auto Detailing');
    expect(out.full_name).toBe('Tuan Truong');
  });
});

describe('pgRowToV1', () => {
  it('matches Python pg_row_to_v1 date-only formatting', () => {
    const row: PgLeadRow = {
      sqlite_lead_id: 1,
      full_name: 'Lead A',
      phone: '0901111111',
      email: '',
      status: 'new',
      source: 'facebook',
      owner_id: null,
      is_duplicate: false,
      agency_client_id: '550e8400-e29b-41d4-a716-446655440000',
      channel: 'meta',
      external_lead_id: 'fb-1',
      campaign_id: null,
      received_at: new Date('2026-07-17T00:00:00.000Z'),
      created_at: new Date('2026-07-17T00:00:00.000Z'),
    };

    expect(pgRowToV1(row)).toEqual({
      id: 1,
      full_name: 'Lead A',
      phone: '0901111111',
      email: '',
      status: 'new',
      source: 'facebook',
      channel: 'meta',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      campaign_id: null,
      external_lead_id: 'fb-1',
      owner_id: null,
      created_at: '2026-07-17',
      received_at: '2026-07-17',
      is_duplicate: false,
      assign_confidence: null,
      assign_strategy: null,
      b2b_project_id: null,
      expected_value: null,
      lead_flow_kind: 'spa_operational',
      margin_pct: null,
      owner_company_id: null,
      review_queue: { active: false },
      company_name: '',
      company_address: '',
      logo_asset_id: null,
    });
  });

  it('maps company party columns from PG row', () => {
    const row: PgLeadRow = {
      sqlite_lead_id: 5,
      full_name: 'Tuan Truong',
      phone: '0901',
      email: 'am@360auto.vn',
      status: 'new',
      source: 'facebook',
      owner_id: null,
      is_duplicate: false,
      agency_client_id: null,
      channel: 'meta',
      external_lead_id: null,
      campaign_id: null,
      received_at: new Date('2026-09-09T00:00:00.000Z'),
      created_at: new Date('2026-09-09T00:00:00.000Z'),
      company_name: '360 Auto Detailing',
      company_address: '12 Nguyễn Huệ',
      logo_asset_id: 'logo-1',
    };
    const out = pgRowToV1(row);
    expect(out.company_name).toBe('360 Auto Detailing');
    expect(out.company_address).toBe('12 Nguyễn Huệ');
    expect(out.logo_asset_id).toBe('logo-1');
    expect(out.full_name).toBe('Tuan Truong');
  });

  it('sets in_call when human session is ringing', () => {
    const row: PgLeadRow = {
      sqlite_lead_id: 2,
      full_name: 'B2B',
      phone: '090',
      email: '',
      status: 'moi',
      source: 'facebook',
      owner_id: 1,
      is_duplicate: false,
      agency_client_id: null,
      channel: 'meta',
      external_lead_id: null,
      campaign_id: null,
      received_at: new Date('2026-08-19T08:00:00.000Z'),
      created_at: new Date('2026-08-19T08:00:00.000Z'),
      b2b_project_id: 'p1',
      meta_json: { lead_flow_kind: 'b2b_prospect', lead_score: 80 },
      project_code: 'demo',
      lead_score: 80,
      b2b_call_state: 'ringing',
      b2b_has_call: true,
      b2b_call_answered: false,
      b2b_assigned_at: new Date('2026-08-19T08:00:00.000Z'),
    };
    const out = pgRowToV1(row);
    expect(out.in_call).toBe(true);
    expect(out.ai_band).toBe('hot');
    expect(out.project_code).toBe('demo');
  });
});
