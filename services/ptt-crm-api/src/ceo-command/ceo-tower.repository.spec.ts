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
    expect(sql).toContain("INTERVAL '90 days'");
    expect(sql).toContain('crm_service_lifecycle');
  });
});

describe('CeoTowerRepository wiring', () => {
  it('does not copy Owner Weekly KPI SQL', () => {
    const source = fs.readFileSync(path.join(__dirname, 'ceo-tower.repository.ts'), 'utf8');
    expect(source).not.toMatch(/computeK1|k1_b2_minutes|loadLifecycleKpis/);
    expect(source).toMatch(/Pool/);
  });
});
