import { CpReHandoffService } from './cp-re-handoff.service';

const RE_PROJECT_ID = 42;
const CP_PROJECT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const BATCH_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

describe('CpReHandoffService', () => {
  it('creates CP project with re_project tag and enqueues batch', async () => {
    const db = {
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('to_regclass')) return { rows: [{ reg: 'crm_re_projects' }] };
        if (sql.includes('FROM crm_re_projects')) {
          return {
            rows: [{
              id: RE_PROJECT_ID,
              code: 'PEAK',
              name: 'The Peak',
              location_address: 'Q7',
              district: 'Quận 7',
              city: 'TP.HCM',
            }],
          };
        }
        if (sql.includes('FROM crm_re_project_products')) {
          return {
            rows: [{
              id: 901,
              project_id: RE_PROJECT_ID,
              unit_code: 'A-01',
              net_price_vnd: 3_000_000_000,
              list_price_vnd: 3_200_000_000,
              status: 'available',
            }],
          };
        }
        if (sql.includes('tags @>')) return { rows: [] };
        if (sql.includes('FROM clients')) return { rows: [{ id: CLIENT_ID }] };
        return { rows: [] };
      }),
    };
    const projects = {
      create: jest.fn().mockResolvedValue({ id: CP_PROJECT_ID, name: 'The Peak · Creative Pack' }),
    };
    const playbooks = {
      run: jest.fn().mockResolvedValue({ batch_id: BATCH_ID, playbook_id: 'bds_social_916' }),
    };
    const svc = new CpReHandoffService(db, projects as never, playbooks as never);

    const result = await svc.handoff(RE_PROJECT_ID, {}, { scope: 'all', staffId: 9 });

    expect(result.cp_project_id).toBe(CP_PROJECT_ID);
    expect(result.batch_id).toBe(BATCH_ID);
    expect(result.href).toContain(BATCH_ID);
    expect(projects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: expect.arrayContaining([`re_project:${RE_PROJECT_ID}`]),
        agency_client_id: CLIENT_ID,
      }),
      9,
    );
    expect(playbooks.run).toHaveBeenCalledWith(
      'bds_social_916',
      expect.objectContaining({
        project_id: CP_PROJECT_ID,
        re_project_id: RE_PROJECT_ID,
      }),
      expect.objectContaining({ staffId: 9 }),
      9,
    );
  });

  it('reuses existing CP project when re_project tag exists', async () => {
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('to_regclass')) return { rows: [{ reg: 'crm_re_projects' }] };
        if (sql.includes('FROM crm_re_projects')) {
          return { rows: [{ id: RE_PROJECT_ID, code: 'PEAK', name: 'The Peak', district: 'Q7', city: 'HCM' }] };
        }
        if (sql.includes('FROM crm_re_project_products')) {
          return {
            rows: [{
              id: 901,
              project_id: RE_PROJECT_ID,
              unit_code: 'A-01',
              net_price_vnd: 2_000_000_000,
              status: 'available',
            }],
          };
        }
        if (sql.includes('tags @>')) return { rows: [{ id: CP_PROJECT_ID, name: 'Existing' }] };
        return { rows: [] };
      }),
    };
    const projects = { create: jest.fn() };
    const playbooks = {
      run: jest.fn().mockResolvedValue({ batch_id: BATCH_ID }),
    };
    const svc = new CpReHandoffService(db, projects as never, playbooks as never);

    await svc.handoff(RE_PROJECT_ID, {}, { scope: 'all', staffId: 9 });

    expect(projects.create).not.toHaveBeenCalled();
    expect(playbooks.run).toHaveBeenCalledWith(
      'bds_social_916',
      expect.objectContaining({ project_id: CP_PROJECT_ID }),
      expect.anything(),
      9,
    );
  });
});
