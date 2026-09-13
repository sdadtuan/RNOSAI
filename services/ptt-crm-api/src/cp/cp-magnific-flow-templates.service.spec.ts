import {
  CpMagnificFlowTemplatesService,
  fieldsFromBindings,
  type CpFlowTemplatesQueryPort,
} from './cp-magnific-flow-templates.service';
import { CpMagnificFlowCacheService } from './cp-magnific-flow-cache.repository';
import type { MagnificFlowBindings } from './cp-magnific-flow-bind.util';

const SOCIAL_916_BINDINGS: MagnificFlowBindings = {
  execution_kind: 'flow',
  flow_sqid: 'uqzQLDr2Aw',
  input_bindings: {
    image_prompt: { source: 'prompt_field', key: 'image_prompt', required: true },
    motion_prompt: { source: 'prompt_field', key: 'motion_prompt', required: true },
  },
  estimate_credits: 5,
};

class TemplatesMemory implements CpFlowTemplatesQueryPort {
  rows: Record<string, unknown>[] = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('crm_cp_provider_template_map') && sql.includes('t.id = $2')) {
      const found = this.rows.find((row) => String(row.template_id) === String(params[1]));
      return { rows: found ? [found] : [] };
    }
    if (sql.includes("bindings_json->>'execution_kind' = 'flow'")) {
      return { rows: this.rows.filter((row) => row.listable !== false) };
    }
    return { rows: [] };
  }
}

function makeService(opts?: {
  db?: TemplatesMemory;
  cache?: Partial<CpMagnificFlowCacheService>;
}) {
  const db = opts?.db ?? new TemplatesMemory();
  const cache = {
    getOrFetch: jest.fn(async (sqid: string) => ({
      sqid,
      name: 'Social 9:16',
      inputs: [],
      total_cost: 5,
    })),
    get: jest.fn(async () => ({
      sqid: 'uqzQLDr2Aw',
      name: 'Social 9:16',
      inputs_schema_json: [],
      total_cost: 5,
      fetched_at: new Date(),
      expires_at: new Date(Date.now() + 60_000),
    })),
    ...opts?.cache,
  } as unknown as CpMagnificFlowCacheService;
  return { service: new CpMagnificFlowTemplatesService(db, cache), db, cache };
}

describe('fieldsFromBindings', () => {
  it('maps social 916 prompt fields', () => {
    expect(fieldsFromBindings(SOCIAL_916_BINDINGS)).toEqual([
      { key: 'image_prompt', label: 'Prompt ảnh', kind: 'text' },
      { key: 'motion_prompt', label: 'Prompt chuyển động', kind: 'text' },
    ]);
  });
});

describe('CpMagnificFlowTemplatesService', () => {
  it('lists flow templates from map rows', async () => {
    const db = new TemplatesMemory();
    db.rows.push({
      template_id: '11111111-1111-4111-8111-111111111111',
      name: 'Social 9:16',
      flow_sqid: 'uqzQLDr2Aw',
      bindings_json: SOCIAL_916_BINDINGS,
      listable: true,
    });
    const { service } = makeService({ db });
    const items = await service.listForProject();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      template_id: '11111111-1111-4111-8111-111111111111',
      flow_sqid: 'uqzQLDr2Aw',
      estimate_credits: 5,
    });
  });

  it('rejects missing map row with flow_template_invalid', async () => {
    const { service } = makeService();
    await expect(
      service.validateDraft({
        template_id: '11111111-1111-4111-8111-111111111111',
        inputs: {},
      }),
    ).rejects.toMatchObject({ error: 'flow_template_invalid', gate: 'GT-MF02' });
  });

  it('rejects missing required prompt with flow_input_missing', async () => {
    const db = new TemplatesMemory();
    db.rows.push({
      template_id: '11111111-1111-4111-8111-111111111111',
      external_ref: 'uqzQLDr2Aw',
      bindings_json: SOCIAL_916_BINDINGS,
    });
    const { service } = makeService({ db });
    await expect(
      service.validateDraft({
        template_id: '11111111-1111-4111-8111-111111111111',
        inputs: { image_prompt: 'only image' },
      }),
    ).rejects.toMatchObject({ error: 'flow_input_missing', gate: 'GT-MF03' });
  });

  it('uses cache total_cost for estimate when present', async () => {
    const db = new TemplatesMemory();
    db.rows.push({
      template_id: '11111111-1111-4111-8111-111111111111',
      external_ref: 'uqzQLDr2Aw',
      bindings_json: SOCIAL_916_BINDINGS,
    });
    const { service } = makeService({ db });
    const validated = await service.validateDraft({
      template_id: '11111111-1111-4111-8111-111111111111',
      inputs: {
        image_prompt: 'hero',
        motion_prompt: 'slow push',
      },
    });
    expect(validated.flow_inputs).toMatchObject({
      image_prompt: 'hero',
      motion_prompt: 'slow push',
    });
    expect(validated.estimate.credits).toBe(5);
  });

  it('maps flow GET 404 to magnific_flow_not_found', async () => {
    const db = new TemplatesMemory();
    db.rows.push({
      template_id: '11111111-1111-4111-8111-111111111111',
      external_ref: 'uqzQLDr2Aw',
      bindings_json: SOCIAL_916_BINDINGS,
    });
    const { service } = makeService({
      db,
      cache: {
        getOrFetch: jest.fn(async () => {
          throw Object.assign(new Error('missing'), { error: 'magnific_flow_not_found' });
        }),
      },
    });
    await expect(
      service.validateDraft({
        template_id: '11111111-1111-4111-8111-111111111111',
        inputs: { image_prompt: 'a', motion_prompt: 'b' },
      }),
    ).rejects.toMatchObject({ error: 'magnific_flow_not_found' });
  });
});
