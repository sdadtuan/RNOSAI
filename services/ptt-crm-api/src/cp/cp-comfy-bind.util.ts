import { HttpException } from '@nestjs/common';

export function bindComfyWorkflow(input: {
  workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
  bindings: Record<string, { nodeId: string; inputKey: string }>;
  values: Record<string, unknown>;
}): Record<string, { class_type: string; inputs: Record<string, unknown> }> {
  for (const key of Object.keys(input.values)) {
    if (!Object.prototype.hasOwnProperty.call(input.bindings, key)) {
      cpThrow(422, { error: 'unsafe_binding', gate: 'GT-C02' });
    }
  }

  const bound = structuredClone(input.workflow);

  for (const [key, value] of Object.entries(input.values)) {
    const binding = input.bindings[key];
    const node = bound[binding.nodeId];
    if (!node) {
      cpThrow(422, { error: 'unsafe_binding', gate: 'GT-C02' });
    }
    node.inputs[binding.inputKey] = value;
  }

  return bound;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
