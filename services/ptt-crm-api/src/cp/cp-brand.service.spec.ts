import { CpBrandService } from './cp-brand.service';

const kitId = '19d722af-0000-4000-8000-000000000011';
const clientId = '19d722af-0000-4000-8000-000000000012';
const projectId = '19d722af-0000-4000-8000-000000000013';

describe('CpBrandService', () => {
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  const versions: Record<string, unknown>[] = [];
  const queryImplementation: QueryFn = async (sql: string, params: unknown[] = []) => {
    if (/SELECT k\.\* FROM crm_cp_brand_kits k/i.test(sql)) {
      return {
        rows: [{ id: kitId, tenant_id: 'PTT', scope_type: 'tenant' }],
        rowCount: 1,
      };
    }
    if (/INSERT INTO crm_cp_brand_kit_versions/i.test(sql)) {
      const row = {
        id: `${kitId}-${versions.length + 1}`,
        kit_id: kitId,
        n: versions.length + 1,
        payload_json: JSON.parse(String(params[1])),
      };
      versions.push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (/FROM crm_cp_brand_kit_versions/i.test(sql)) {
      const row = versions.find((item) => item.n === params[1]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  };
  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(queryImplementation),
  };
  const transaction = jest.fn(
    async (work: (tx: { query: jest.MockedFunction<QueryFn> }) => Promise<unknown>) =>
      work(repo),
  );
  const scope = { scope: 'me' as const, staffId: 7 };
  let svc: CpBrandService;

  beforeEach(() => {
    versions.length = 0;
    jest.clearAllMocks();
    repo.query.mockImplementation(queryImplementation);
    svc = new CpBrandService({ ...repo, transaction } as never);
  });

  it('edits create a new version', async () => {
    const a = await svc.saveVersion(kitId, { palette: ['#0F2747'] });
    const b = await svc.saveVersion(kitId, { palette: ['#C9A227'] });
    expect(a.n).toBe(1);
    expect(b.n).toBe(2);
    expect((await svc.getVersion(kitId, 1)).payload_json.palette).toEqual(['#0F2747']);
  });

  it.each(['workspace', '', 'CLIENT'])('rejects invalid scope_type %p', async (scopeType) => {
    await expect(svc.createKit({ scope_type: scopeType, name: 'Kit' })).rejects.toMatchObject({
      status: 400,
      response: { error: 'invalid_scope_type' },
    });
  });

  it('requires an existing client for client scope', async () => {
    await expect(svc.createKit({ scope_type: 'client', name: 'Kit' })).rejects.toMatchObject({
      response: { error: 'agency_client_id_required' },
    });

    await expect(
      svc.createKit({ scope_type: 'client', agency_client_id: clientId, name: 'Kit' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { error: 'client_not_found' },
    });
  });

  it('returns 404 when a project kit target is missing or out of scope', async () => {
    await expect(
      svc.createKit({ scope_type: 'project', project_id: projectId, name: 'Kit' }, scope),
    ).rejects.toMatchObject({
      status: 404,
      response: { error: 'not_found' },
    });
  });

  it('stores tenant kits with nullable client and project references', async () => {
    repo.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (/INSERT INTO crm_cp_brand_kits/i.test(sql)) {
        return {
          rows: [
            {
              id: kitId,
              tenant_id: params[0],
              scope_type: params[1],
              agency_client_id: params[2],
              project_id: params[3],
              name: params[4],
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      svc.createKit({
        scope_type: 'tenant',
        agency_client_id: clientId,
        project_id: projectId,
        name: ' PTT Default ',
      }),
    ).resolves.toMatchObject({
      tenant_id: 'PTT',
      scope_type: 'tenant',
      agency_client_id: null,
      project_id: null,
      name: 'PTT Default',
    });
  });

  it('lists only PTT kits allowed by the resolved scope', async () => {
    await svc.listKits(scope);

    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('k.tenant_id = $1');
    expect(sql).toContain("k.scope_type = 'tenant'");
    expect(sql).toContain('crm_cp_project_members');
    expect(params).toEqual(['PTT', 7]);
  });

  it('returns 404 for a missing or out-of-scope kit version', async () => {
    repo.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(svc.getVersion(kitId, 1, scope)).rejects.toMatchObject({
      status: 404,
      response: { error: 'not_found' },
    });
  });

  it('serializes version inserts by locking the kit row', async () => {
    await svc.saveVersion(kitId, { palette: [] }, scope);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(repo.query.mock.calls.some(([sql]) => /FOR UPDATE/i.test(sql))).toBe(true);
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE[\s\S]*payload_json/i.test(sql))).toBe(
      false,
    );
  });

  it('restore copies vN payload into a new n+1 and never updates vN', async () => {
    const v1 = await svc.saveVersion(kitId, { palette: ['#0F2747'] });
    await svc.saveVersion(kitId, { palette: ['#C9A227'] });

    const restored = await svc.restoreVersion(kitId, v1.n, scope);

    expect(restored.n).toBe(3);
    expect(restored.payload_json).toEqual({ palette: ['#0F2747'] });
    expect((await svc.getVersion(kitId, 1)).payload_json).toEqual({ palette: ['#0F2747'] });
    expect((await svc.getVersion(kitId, 2)).payload_json).toEqual({ palette: ['#C9A227'] });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE[\s\S]*crm_cp_brand_kit_versions/i.test(sql))).toBe(
      false,
    );
  });

  it('evaluateRules picks the highest matching enforcement and collects actions', async () => {
    const versionId = '19d722af-0000-4000-8000-000000000021';
    repo.query.mockImplementation(async (sql: string) => {
      if (/FROM crm_cp_brand_rules/i.test(sql)) {
        return {
          rows: [
            {
              enforcement: 'warning',
              action_json: { palette_lock: true },
              condition_json: { output_type: 'video' },
            },
            {
              enforcement: 'block_publish',
              action_json: { disclaimer: true },
              condition_json: { channel: 'paid' },
            },
            {
              enforcement: 'block_render',
              action_json: { logo: 'safe-area' },
              condition_json: { ratio: '9:16' },
            },
            {
              enforcement: 'block_render',
              action_json: { watermark: true },
              condition_json: { channel: 'unused' },
            },
          ],
          rowCount: 4,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      svc.evaluateRules(versionId, { output_type: 'video', channel: 'paid', ratio: '9:16' }),
    ).resolves.toEqual({
      enforcement: 'block_render',
      actions: [{ palette_lock: true }, { disclaimer: true }, { logo: 'safe-area' }],
    });
  });

  it('preview returns four ratios and labels contrast and clipping', async () => {
    repo.query.mockImplementation(async (sql: string) => {
      if (/SELECT k\.\* FROM crm_cp_brand_kits k/i.test(sql)) {
        return {
          rows: [{ id: kitId, tenant_id: 'PTT', scope_type: 'tenant' }],
          rowCount: 1,
        };
      }
      if (/FROM crm_cp_brand_kit_versions/i.test(sql)) {
        return {
          rows: [{
            id: `${kitId}-1`,
            kit_id: kitId,
            n: 1,
            payload_json: { palette: ['#ffffff', '#ffffff'] },
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const preview = await svc.preview(kitId, {
      overlay: 'x'.repeat(43),
      foreground: '#ffffff',
      background: '#ffffff',
    }, scope);

    expect(preview.items.map((item) => item.ratio)).toEqual(['9:16', '1:1', '4:5', '16:9']);
    expect(preview.items.every((item) => item.warnings.includes('contrast'))).toBe(true);
    expect(preview.items.every((item) => item.warnings.includes('clipping'))).toBe(true);
  });
});
