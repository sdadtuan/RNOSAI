import { describe, expect, it } from 'vitest';
import {
  buildFlowDraftBody,
  fieldsFromBindings,
  flowTemplateFromApi,
  type MagnificFlowBindingsShape,
} from './cp-ai-ops-flow.util';

const SOCIAL_916_BINDINGS: MagnificFlowBindingsShape = {
  execution_kind: 'flow',
  flow_sqid: 'uqzQLDr2Aw',
  input_bindings: {
    image_prompt: { source: 'prompt_field', key: 'image_prompt', required: true },
    motion_prompt: { source: 'prompt_field', key: 'motion_prompt', required: true },
    start_image: { source: 'asset_ref', key: 'reference_asset_id', media_type: 'image' },
  },
};

describe('fieldsFromBindings', () => {
  it('maps social 916 i2v prompt and asset fields', () => {
    expect(fieldsFromBindings(SOCIAL_916_BINDINGS)).toEqual([
      { key: 'image_prompt', label: 'Prompt ảnh', kind: 'text' },
      { key: 'motion_prompt', label: 'Prompt chuyển động', kind: 'text' },
      { key: 'reference_asset_id', label: 'Ảnh tham chiếu', kind: 'asset' },
    ]);
  });
});

describe('buildFlowDraftBody', () => {
  it('builds a magnific_rest flow draft payload', () => {
    expect(
      buildFlowDraftBody({
        projectId: 'proj-1',
        templateId: 'tmpl-1',
        values: { image_prompt: 'hero', motion_prompt: 'push' },
        idempotencyKey: 'key-1',
      }),
    ).toEqual({
      project_id: 'proj-1',
      provider: 'magnific_rest',
      execution_kind: 'flow',
      template_id: 'tmpl-1',
      inputs: { image_prompt: 'hero', motion_prompt: 'push' },
      idempotency_key: 'key-1',
    });
  });
});

describe('flowTemplateFromApi', () => {
  it('normalizes template list rows from the API', () => {
    expect(
      flowTemplateFromApi({
        template_id: '11111111-1111-4111-8111-111111111111',
        name: 'Social 9:16',
        flow_sqid: 'uqzQLDr2Aw',
        estimate_credits: 5,
        fields: [
          { key: 'image_prompt', label: 'Prompt ảnh', kind: 'text' },
          { key: 'motion_prompt', label: 'Prompt chuyển động', kind: 'text' },
        ],
      }),
    ).toMatchObject({
      name: 'Social 9:16',
      flow_sqid: 'uqzQLDr2Aw',
      estimate_credits: 5,
      fields: expect.any(Array),
    });
  });
});
