import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { CasesPgRepository } from './cases-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('CasesModule Wave 1', () => {
  it('wires cases exclusively to PostgreSQL', () => {
    const service = fs.readFileSync(path.join(__dirname, 'cases.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'cases.module.ts'), 'utf8');
    const nba = fs.readFileSync(path.join(__dirname, '../ai-intelligence/ai-nba.service.ts'), 'utf8');

    expect(service).not.toMatch(/CasesSqliteRepository|DatabaseSync|sqlitePath/);
    expect(module).not.toMatch(/CasesSqliteRepository|DatabaseSync|sqlitePath/);
    expect(nba).not.toMatch(/CasesSqliteRepository/);
    expect(service).toMatch(/CasesPgRepository/);
    expect(module).toMatch(/CasesPgRepository/);
    expect(nba).toMatch(/CasesPgRepository/);
  });
});

describe('CasesPgRepository', () => {
  const query = jest.fn();
  let repo: CasesPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new CasesPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('preserves the existing case contract and creates satellite tables before listing', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            customer_id: 7,
            title: 'Hồ sơ A',
            description: '',
            channel: 'email',
            priority: 'cao',
            status: 'dang_xu_ly',
            pipeline_stage: 'chot',
            assigned_to: '',
            assigned_staff_id: 4,
            assigned_at: new Date('2026-08-27T01:00:00.000Z'),
            campaign_id: null,
            created_at: new Date('2026-08-27T00:00:00.000Z'),
            updated_at: new Date('2026-08-27T02:00:00.000Z'),
            customer_name: 'Khách A',
            customer_phone: '0901',
            customer_email: 'a@example.com',
            customer_address: '',
            customer_company: '',
            staff_display_name: 'Nhân viên A',
          },
        ],
      });

    const rows = await repo.listCases(4);

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_cases');
    expect(schema).toContain('id BIGSERIAL PRIMARY KEY');
    expect(schema).toContain('ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS pipeline_stage');
    expect(schema).toContain('ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS deal_value_vnd');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_case_events');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_care_reports');
    expect(query.mock.calls[1][0]).toContain('c.assigned_staff_id = $1');
    expect(query.mock.calls[1][1]).toEqual([4]);
    expect(rows[0]).toMatchObject({
      id: 9,
      assigned_to: 'Nhân viên A',
      assigned_at: '2026-08-27T01:00:00.000Z',
      updated_at: '2026-08-27T02:00:00.000Z',
    });
  });

  it('updates a case with normalized values and PostgreSQL parameters', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 9,
          title: 'Cũ',
          description: '',
          channel: 'khac',
          priority: 'binh_thuong',
          status: 'tiep_nhan',
          assigned_to: '',
          assigned_staff_id: null,
          assigned_at: null,
          pipeline_stage: 'moi',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ name: 'Nhân viên A' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await repo.patchCase(9, {
      title: ` ${'a'.repeat(900)} `,
      status: 'dang_xu_ly',
      priority: 'invalid',
      assigned_staff_id: 4,
    });

    expect(query.mock.calls[3][0]).toContain('UPDATE crm_cases');
    expect(query.mock.calls[3][1][1]).toBe('a'.repeat(800));
    expect(query.mock.calls[3][1][4]).toBe('binh_thuong');
    expect(query.mock.calls[3][1][6]).toBe('Nhân viên A');
    expect(query.mock.calls[3][1][7]).toBe(4);
  });

  it('creates care reports using the assigned staff when no active override exists', async () => {
    const caseRow = {
      id: 9,
      customer_id: 7,
      title: 'Hồ sơ A',
      assigned_staff_id: 4,
      assigned_to: 'Nhân viên A',
      staff_display_name: 'Nhân viên A',
    };
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [caseRow] })
      .mockResolvedValueOnce({ rows: [{ id: 31 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 31,
          case_id: 9,
          staff_id: 4,
          staff_name: 'Nhân viên A',
          contact_type: 'goi_dien',
          care_status: 'da_lien_he_thanh_cong',
          summary: 'Đã gọi',
          next_action: '',
          created_at: new Date('2026-08-27T03:00:00.000Z'),
        }],
      });

    const row = await repo.createCareReport(9, { summary: ' Đã gọi ' });

    expect(query.mock.calls[2][1].slice(0, 7)).toEqual([
      9,
      4,
      'Nhân viên A',
      'goi_dien',
      'da_lien_he_thanh_cong',
      'Đã gọi',
      '',
    ]);
    expect(row).toMatchObject({
      id: 31,
      staff_id: 4,
      contact_type_label: 'Gọi điện',
      created_at: '2026-08-27T03:00:00.000Z',
    });
  });
});
