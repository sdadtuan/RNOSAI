import { CpContentOsHandoffService } from './cp-content-os-handoff.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const scope = { scope: 'me' as const, staffId: 9, teamIds: [3] };

function makeSvc(opts: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  createProject?: jest.Mock;
  upsertDraft?: jest.Mock;
}) {
  const projects = {
    create: opts.createProject ?? jest.fn().mockResolvedValue({ id: PROJECT_ID }),
  };
  const videos = {
    upsertDraft: opts.upsertDraft ?? jest.fn().mockResolvedValue({ id: DRAFT_ID }),
  };
  const svc = new CpContentOsHandoffService(
    { query: opts.query } as never,
    projects as never,
    videos as never,
  );
  return { svc, projects, videos };
}

describe('CpContentOsHandoffService', () => {
  it('reuses a CP project for the lifecycle and upserts a draft', async () => {
    const calls: string[] = [];
    const query = async (sql: string) => {
      calls.push(sql);
      if (sql.includes('crm_cp_projects') && sql.includes('lifecycle_id')) {
        return {
          rows: [{ id: PROJECT_ID, agency_client_id: CLIENT_ID, lifecycle_id: '7' }],
        };
      }
      return { rows: [] };
    };
    const { svc, projects, videos } = makeSvc({ query });

    await expect(
      svc.handoff(
        { lifecycle_id: 7, item_id: 42, name: 'Reel Peak', prompt: 'hook The Peak' },
        scope,
      ),
    ).resolves.toEqual({
      draft_id: DRAFT_ID,
      href: `/crm/creative-os/video/${DRAFT_ID}`,
    });

    expect(projects.create).not.toHaveBeenCalled();
    expect(videos.upsertDraft).toHaveBeenCalledWith(
      {
        project_id: PROJECT_ID,
        name: 'Reel Peak',
        prompt: 'hook The Peak',
        input_mode: 'prompt',
      },
      scope,
    );
    expect(calls.every((sql) => !/crm_vd/i.test(sql))).toBe(true);
  });

  it('creates a draft CP project from the content item when none exists', async () => {
    const query = async (sql: string) => {
      if (sql.includes('crm_cp_projects') && sql.includes('lifecycle_id')) {
        return { rows: [] };
      }
      if (sql.includes('crm_service_lifecycle') && sql.includes('agency_client_id')) {
        return { rows: [{ agency_client_id: CLIENT_ID }] };
      }
      if (sql.includes('cmkt_content_items')) {
        return { rows: [{ title: 'Q3 launch reel' }] };
      }
      return { rows: [] };
    };
    const createProject = jest.fn().mockResolvedValue({ id: PROJECT_ID });
    const { svc, videos } = makeSvc({ query, createProject });

    await expect(
      svc.handoff({ lifecycle_id: 7, item_id: 42 }, scope),
    ).resolves.toEqual({
      draft_id: DRAFT_ID,
      href: `/crm/creative-os/video/${DRAFT_ID}`,
    });

    expect(createProject).toHaveBeenCalledWith(
      {
        name: 'Q3 launch reel',
        agency_client_id: CLIENT_ID,
        owner_staff_id: 9,
        lifecycle_id: '7',
        status: 'draft',
      },
      9,
    );
    expect(videos.upsertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_ID,
        name: 'Q3 launch reel',
        input_mode: 'prompt',
      }),
      scope,
    );
  });

  it('rejects a missing lifecycle_id', async () => {
    const { svc } = makeSvc({
      query: async () => ({ rows: [] }),
    });

    await expect(svc.handoff({}, scope)).rejects.toMatchObject({
      status: 400,
      response: { error: 'lifecycle_id_required' },
    });
  });

  it('rejects create when the lifecycle has no agency client', async () => {
    const query = async (sql: string) => {
      if (sql.includes('crm_cp_projects')) return { rows: [] };
      if (sql.includes('agency_client_id')) return { rows: [{ agency_client_id: '' }] };
      return { rows: [] };
    };
    const { svc, projects } = makeSvc({ query });

    await expect(svc.handoff({ lifecycle_id: 7 }, scope)).rejects.toMatchObject({
      status: 400,
      response: { error: 'agency_client_id_required' },
    });
    expect(projects.create).not.toHaveBeenCalled();
  });
});
