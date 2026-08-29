import type { PoolClient } from 'pg';
import { ensureAgencyClientOnPromote } from './contract-promote-client-pg.util';

function mockClient(queries: Array<{ match: RegExp; rows: unknown[] }>): PoolClient {
  return {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      const text = String(sql).replace(/\s+/g, ' ');
      for (const spec of queries) {
        if (spec.match.test(text)) {
          return { rows: spec.rows, rowCount: spec.rows.length };
        }
      }
      throw new Error(`Unexpected query: ${text.slice(0, 120)} params=${JSON.stringify(params)}`);
    }),
  } as unknown as PoolClient;
}

describe('ensureAgencyClientOnPromote', () => {
  const baseInput = {
    contractId: 9,
    leadId: 5,
    lifecycleId: 12,
    contractAgencyClientId: '',
    leadAgencyClientId: '',
    leadMetaJson: '{"company":"ACME"}',
    leadFullName: 'Person',
    assignedAmStaffId: 1,
    leadOwnerStaffId: 2,
    actorEmail: 'gdkd@ptt.vn',
  };

  it('WS2-05 links preexisting contract agency_client_id', async () => {
    const clientId = '550e8400-e29b-41d4-a716-446655440001';
    const pg = mockClient([
      { match: /FROM clients WHERE id = \$1::uuid LIMIT 1/, rows: [{ '?column?': 1 }] },
      { match: /UPDATE crm_contracts SET agency_client_id/, rows: [] },
      { match: /UPDATE crm_leads SET agency_client_id/, rows: [] },
      { match: /INSERT INTO crm_contract_events/, rows: [] },
    ]);

    const out = await ensureAgencyClientOnPromote(pg, {
      ...baseInput,
      contractAgencyClientId: clientId,
    });

    expect(out).toEqual({
      agency_client_id: clientId,
      agency_client_link_mode: 'link_preexisting',
    });
  });

  it('WS2-01 creates client when no dedup match', async () => {
    const pg = mockClient([
      { match: /FROM clients WHERE id = \$1::uuid LIMIT 1/, rows: [] },
      { match: /SELECT id::text AS id FROM clients[\s\S]*lower\(trim\(name\)\)/, rows: [] },
      { match: /SELECT upper\(code\) AS code FROM clients/, rows: [] },
      { match: /SELECT NULLIF\(trim\(email\)/, rows: [{ email: 'am@ptt.vn' }] },
      { match: /INSERT INTO clients \(code, name/, rows: [{ id: '660e8400-e29b-41d4-a716-446655440002' }] },
      { match: /seed_client_onboarding/, rows: [] },
      { match: /UPDATE crm_contracts SET agency_client_id/, rows: [] },
      { match: /UPDATE crm_leads SET agency_client_id/, rows: [] },
      { match: /INSERT INTO crm_contract_events/, rows: [] },
    ]);

    const out = await ensureAgencyClientOnPromote(pg, baseInput);
    expect(out.agency_client_link_mode).toBe('created');
    expect(out.agency_client_id).toBe('660e8400-e29b-41d4-a716-446655440002');
  });

  it('WS2-03 links single dedup name match', async () => {
    const existing = '770e8400-e29b-41d4-a716-446655440003';
    const pg = mockClient([
      { match: /FROM clients WHERE id = \$1::uuid LIMIT 1/, rows: [] },
      { match: /SELECT id::text AS id FROM clients[\s\S]*lower\(trim\(name\)\)/, rows: [{ id: existing }] },
      { match: /UPDATE crm_contracts SET agency_client_id/, rows: [] },
      { match: /UPDATE crm_leads SET agency_client_id/, rows: [] },
      { match: /INSERT INTO crm_contract_events/, rows: [] },
    ]);

    const out = await ensureAgencyClientOnPromote(pg, baseInput);
    expect(out).toEqual({
      agency_client_id: existing,
      agency_client_link_mode: 'link_dedup_name',
    });
  });
});
