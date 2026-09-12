import { bindComfyWorkflow } from './cp-comfy-bind.util';

const PACKSHOT_WORKFLOW = {
  '20': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'default packshot prompt', clip: ['19', 0] },
  },
  '19': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'model.safetensors' },
  },
} as const;

const PACKSHOT_BINDINGS = {
  positivePrompt: { nodeId: '20', inputKey: 'text' },
} as const;

describe('bindComfyWorkflow', () => {
  it('binds packshot positivePrompt onto node 20 text', () => {
    const workflow = structuredClone(PACKSHOT_WORKFLOW) as Record<
      string,
      { class_type: string; inputs: Record<string, unknown> }
    >;

    const bound = bindComfyWorkflow({
      workflow,
      bindings: { ...PACKSHOT_BINDINGS },
      values: { positivePrompt: 'luxury watch on marble' },
    });

    expect(bound['20'].inputs.text).toBe('luxury watch on marble');
    expect(bound['19'].inputs.ckpt_name).toBe('model.safetensors');
  });

  it('deep-clones the workflow and does not mutate the input', () => {
    const workflow = structuredClone(PACKSHOT_WORKFLOW) as Record<
      string,
      { class_type: string; inputs: Record<string, unknown> }
    >;
    const before = structuredClone(workflow);

    bindComfyWorkflow({
      workflow,
      bindings: { ...PACKSHOT_BINDINGS },
      values: { positivePrompt: 'new prompt' },
    });

    expect(workflow).toEqual(before);
  });

  it('throws unsafe_binding (GT-C02) for extra values keys without bindings', () => {
    expect(() =>
      bindComfyWorkflow({
        workflow: structuredClone(PACKSHOT_WORKFLOW) as Record<
          string,
          { class_type: string; inputs: Record<string, unknown> }
        >,
        bindings: { ...PACKSHOT_BINDINGS },
        values: { positivePrompt: 'ok', rogueKey: 'nope' },
      }),
    ).toThrow(
      expect.objectContaining({
        status: 422,
        error: 'unsafe_binding',
        gate: 'GT-C02',
      }),
    );
  });

  it('throws unsafe_binding (GT-C02) when binding nodeId is missing from workflow', () => {
    expect(() =>
      bindComfyWorkflow({
        workflow: structuredClone(PACKSHOT_WORKFLOW) as Record<
          string,
          { class_type: string; inputs: Record<string, unknown> }
        >,
        bindings: { positivePrompt: { nodeId: '99', inputKey: 'text' } },
        values: { positivePrompt: 'orphan node' },
      }),
    ).toThrow(
      expect.objectContaining({
        status: 422,
        error: 'unsafe_binding',
        gate: 'GT-C02',
      }),
    );
  });
});
