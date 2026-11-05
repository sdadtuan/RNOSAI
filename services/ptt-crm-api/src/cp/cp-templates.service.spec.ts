import { CpTemplatesService, CP_TEMPLATE_REQUIRED_VARS } from './cp-templates.service';

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const DRAFT_ID = '33333333-3333-4333-8333-333333333333';
const KIT_ID = '44444444-4444-4444-8444-444444444444';
const SCOPE = { scope: 'all' as const, staffId: 9, teamIds: [] };

const REQUIRED_VARS = [
  'project_name',
  'price_from',
  'location',
  'cta',
  'hotline',
];

class TemplateQuery {
  rows: Record<string, unknown>[] = [];
  lastSql = '';
  lastParams: unknown[] = [];

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    if (sql.includes('INSERT INTO crm_cp_templates')) {
      const row = {
        id: TEMPLATE_ID,
        tenant_id: 'PTT',
        name: params[1],
        version: 1,
        variables_json: JSON.parse(String(params[2])),
        rules_json: JSON.parse(String(params[3])),
        brand_kit_id: params[4],
        status: 'draft',
      };
      this.rows.push(row);
      return { rows: [row] };
    }
    if (sql.includes('UPDATE crm_cp_templates') && sql.includes("status = 'published'")) {
      const current = this.rows.find((row) => row.id === params[1] || row.id === params[0]);
      if (!current) return { rows: [] };
      current.status = 'published';
      return { rows: [current] };
    }
    if (sql.includes('FROM crm_cp_templates')) {
      if (sql.includes('WHERE') && sql.includes('id')) {
        return { rows: this.rows.filter((row) => row.id === params[1] || row.id === params[0]) };
      }
      return { rows: this.rows };
    }
    return { rows: [] };
  }
}

describe('CpTemplatesService', () => {
  it('requires the five template variables plus optional custom ones', () => {
    expect(CP_TEMPLATE_REQUIRED_VARS).toEqual(REQUIRED_VARS);
  });

  it('rejects a create that omits a required variable', async () => {
    const templates = new CpTemplatesService(new TemplateQuery(), {
      upsertDraft: jest.fn(),
    } as never);

    await expect(
      templates.create({
        name: 'SKU Reels',
        variables: ['project_name', 'cta'],
      }),
    ).rejects.toMatchObject({
      response: { error: 'template_variables_required' },
    });
  });

  it('creates a draft template and publishes it', async () => {
    const db = new TemplateQuery();
    const templates = new CpTemplatesService(db, { upsertDraft: jest.fn() } as never);

    const created = await templates.create({
      name: 'SKU Reels',
      variables: [...REQUIRED_VARS, 'persona'],
      brand_kit_id: KIT_ID,
      rules_json: { unit_credits: 1 },
    });
    expect(created.status).toBe('draft');
    expect(created.variables_json).toEqual([...REQUIRED_VARS, 'persona']);

    const published = await templates.publish(TEMPLATE_ID);
    expect(published.status).toBe('published');
  });

  it('uses a published template to create a video draft in template mode', async () => {
    const db = new TemplateQuery();
    db.rows = [{
      id: TEMPLATE_ID,
      tenant_id: 'PTT',
      name: 'SKU Reels',
      version: 4,
      variables_json: REQUIRED_VARS,
      rules_json: {},
      brand_kit_id: KIT_ID,
      status: 'published',
    }];
    const videos = {
      upsertDraft: jest.fn().mockResolvedValue({
        id: DRAFT_ID,
        input_mode: 'template',
        project_id: PROJECT_ID,
        name: 'SKU Reels',
      }),
    };
    const templates = new CpTemplatesService(db, videos as never);

    const draft = await templates.use(TEMPLATE_ID, { project_id: PROJECT_ID }, SCOPE);

    expect(draft.input_mode).toBe('template');
    expect(videos.upsertDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_ID,
        input_mode: 'template',
        config_json: expect.objectContaining({ template_id: TEMPLATE_ID }),
      }),
      SCOPE,
    );
  });

  it('does not use a draft template', async () => {
    const db = new TemplateQuery();
    db.rows = [{
      id: TEMPLATE_ID,
      tenant_id: 'PTT',
      name: 'TVC',
      variables_json: REQUIRED_VARS,
      status: 'draft',
    }];
    const templates = new CpTemplatesService(db, { upsertDraft: jest.fn() } as never);

    await expect(
      templates.use(TEMPLATE_ID, { project_id: PROJECT_ID }, SCOPE),
    ).rejects.toMatchObject({
      response: { error: 'template_not_published' },
    });
  });
});
