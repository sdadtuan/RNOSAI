import {
  parseFlowBindings,
  resolveFlowInputs,
  type MagnificFlowBindings,
} from './cp-magnific-flow-bind.util';

const SOCIAL_916_BINDINGS: MagnificFlowBindings = {
  execution_kind: 'flow',
  flow_sqid: 'uqzQLDr2Aw',
  input_bindings: {
    image_prompt: { source: 'prompt_field', key: 'image_prompt', required: true },
    motion_prompt: { source: 'prompt_field', key: 'motion_prompt', required: true },
    start_image: {
      source: 'asset_ref',
      key: 'reference_asset_id',
      media_type: 'image',
    },
  },
  defaults: {
    aspect_ratio: '9:16',
    duration_sec: 5,
  },
  estimate_credits: 5,
  requires_render_high_cost: true,
};

describe('parseFlowBindings', () => {
  it('parses a valid social 916 bindings document', () => {
    expect(parseFlowBindings(SOCIAL_916_BINDINGS)).toEqual(SOCIAL_916_BINDINGS);
  });

  it('rejects non-flow execution_kind', () => {
    expect(() =>
      parseFlowBindings({ ...SOCIAL_916_BINDINGS, execution_kind: 'tool' }),
    ).toThrow(expect.objectContaining({ error: 'flow_template_invalid' }));
  });

  it('rejects missing flow_sqid', () => {
    expect(() =>
      parseFlowBindings({ ...SOCIAL_916_BINDINGS, flow_sqid: '  ' }),
    ).toThrow(expect.objectContaining({ error: 'flow_template_invalid' }));
  });
});

describe('resolveFlowInputs', () => {
  it('maps image_prompt and motion_prompt from composer fields', async () => {
    const out = await resolveFlowInputs(
      SOCIAL_916_BINDINGS,
      {
        image_prompt: ' Vertical social ad, bubble tea ',
        motion_prompt: 'Slow orbit 5 degrees',
      },
      {},
    );
    expect(out).toEqual({
      image_prompt: 'Vertical social ad, bubble tea',
      motion_prompt: 'Slow orbit 5 degrees',
      aspect_ratio: '9:16',
      duration_sec: 5,
    });
  });

  it('throws flow_input_missing when a required prompt is absent', async () => {
    await expect(
      resolveFlowInputs(
        SOCIAL_916_BINDINGS,
        { image_prompt: 'Only image' },
        {},
      ),
    ).rejects.toMatchObject({ error: 'flow_input_missing', gate: 'GT-MF03' });
  });

  it('resolves optional asset_ref via assetUrl', async () => {
    const out = await resolveFlowInputs(
      SOCIAL_916_BINDINGS,
      {
        image_prompt: 'Hero',
        motion_prompt: 'Pan',
        reference_asset_id: 'asset-123',
      },
      {
        assetUrl: async (id) => `https://cdn.example.com/${id}`,
      },
    );
    expect(out.start_image).toBe('https://cdn.example.com/asset-123');
  });

  it('throws when asset_ref is required but assetUrl is missing', async () => {
    const bindings: MagnificFlowBindings = {
      ...SOCIAL_916_BINDINGS,
      input_bindings: {
        ...SOCIAL_916_BINDINGS.input_bindings,
        start_image: {
          source: 'asset_ref',
          key: 'reference_asset_id',
          required: true,
          media_type: 'image',
        },
      },
    };
    await expect(
      resolveFlowInputs(
        bindings,
        {
          image_prompt: 'Hero',
          motion_prompt: 'Pan',
          reference_asset_id: 'asset-123',
        },
        {},
      ),
    ).rejects.toMatchObject({ error: 'flow_input_missing', gate: 'GT-MF03' });
  });

  it('merges literal defaults not covered by bindings', async () => {
    const bindings: MagnificFlowBindings = {
      execution_kind: 'flow',
      flow_sqid: 'abc123',
      input_bindings: {
        image_prompt: { source: 'prompt_field', key: 'image_prompt', required: true },
      },
      defaults: {
        motion_prompt: 'Default motion',
        duration_sec: 8,
      },
    };
    const out = await resolveFlowInputs(bindings, { image_prompt: 'Still' }, {});
    expect(out).toEqual({
      image_prompt: 'Still',
      motion_prompt: 'Default motion',
      duration_sec: 8,
    });
  });

  it('uses literal binding value when source is literal', async () => {
    const bindings: MagnificFlowBindings = {
      execution_kind: 'flow',
      flow_sqid: 'abc123',
      input_bindings: {
        image_prompt: { source: 'prompt_field', key: 'image_prompt', required: true },
        aspect_ratio: { source: 'literal', value: '9:16' },
      },
    };
    const out = await resolveFlowInputs(bindings, { image_prompt: 'Frame' }, {});
    expect(out.aspect_ratio).toBe('9:16');
  });
});
