import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { CeoTowerRepository } from './ceo-tower.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('CeoTowerRepository', () => {
  const query = jest.fn();
  let repo: CeoTowerRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new CeoTowerRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('loads 90-day candidates from leads/milestones/contracts via Pool', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await repo.loadCandidates(Date.UTC(2026, 8, 1));
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('FROM crm_leads');
    expect(sql).toContain('crm_lifecycle_milestones');
    expect(sql).toContain('crm_contracts');
    expect(sql).toContain('ends_on::text');
    expect(sql).toContain("INTERVAL '90 days'");
    expect(sql).toContain('crm_service_lifecycle');
  });

  it('signed_on in the past without ends_on → contractEndInDays null', async () => {
    query.mockResolvedValueOnce({
      rows: [dbRow({ signed_on: '2025-01-15', ends_on: null })],
    });
    const [row] = await repo.loadCandidates(Date.UTC(2026, 8, 1));
    expect(row.contractEndInDays).toBeNull();
  });

  it('ends_on within 30 days → contractEndInDays ≤ 30', async () => {
    query.mockResolvedValueOnce({
      rows: [dbRow({ signed_on: '2025-01-15', ends_on: '2026-09-20' })],
    });
    const [row] = await repo.loadCandidates(Date.UTC(2026, 8, 1));
    expect(row.contractEndInDays).toBeGreaterThanOrEqual(0);
    expect(row.contractEndInDays).toBeLessThanOrEqual(30);
  });

  it('ends_on as node-pg Date → finite contractEndInDays', async () => {
    query.mockResolvedValueOnce({
      rows: [dbRow({ signed_on: '2025-01-15', ends_on: new Date(2026, 8, 20) })],
    });
    const [row] = await repo.loadCandidates(Date.UTC(2026, 8, 1));
    expect(row.contractEndInDays).not.toBeNull();
    expect(Number.isFinite(row.contractEndInDays)).toBe(true);
  });
});

function dbRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lead_id: 10,
    status: 'won',
    source: 'manual',
    channel: 'agency',
    owner_id: 1,
    client_id: '',
    meta_json: {},
    created_at: new Date('2026-08-01T00:00:00Z'),
    updated_at: new Date('2026-08-15T00:00:00Z'),
    received_at: null,
    care_stages_done_json: {},
    has_presales: true,
    lifecycle_id: 100,
    lifecycle_stage: 'retain',
    lifecycle_status: 'active',
    lifecycle_updated_at: new Date('2026-08-15T00:00:00Z'),
    owner_name: 'AM An',
    position_code: 'KD-01',
    team_code: 'TEAM-SALES-AM',
    department_code: 'DEPT-SALES',
    b2_at: null,
    intake_go_at: null,
    promote_at: null,
    client_active_at: new Date('2026-08-10T00:00:00Z'),
    contract_id: 1,
    contract_status: 'active',
    amount_vnd: 5_000_000,
    contract_created_at: new Date('2026-07-01T00:00:00Z'),
    contract_updated_at: new Date('2026-07-01T00:00:00Z'),
    signed_on: '2025-01-15',
    ends_on: null,
    contract_client_id: null,
    approval_submitted_at: null,
    approval_status: null,
    solution_owner_staff_id: null,
    first_call_at: null,
    ops_alert_id: null,
    ops_alert_at: null,
    ...over,
  };
}

describe('CeoTowerRepository wiring', () => {
  it('does not copy Owner Weekly KPI SQL', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ceo-tower.repository.ts'), 'utf8');
    expect(source).not.toMatch(/computeK1|k1_b2_minutes|loadLifecycleKpis/);
    expect(source).not.toMatch(/daysUntil\(signedOn/);
    expect(source).toMatch(/ends_on/);
    expect(source).toMatch(/Pool/);
  });
});
