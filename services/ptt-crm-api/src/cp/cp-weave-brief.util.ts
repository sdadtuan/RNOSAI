import type { CpWeaveBrief } from './cp-weave.types';

const OUTPUT_KINDS = new Set(['image', 'video', 'carousel']);

export function normalizeWeaveBrief(raw: unknown): CpWeaveBrief {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const prompt = String(input.prompt ?? '').trim();
  if (!prompt) throw new Error('prompt_required');

  const formatRaw = input.output_format && typeof input.output_format === 'object'
    ? input.output_format as Record<string, unknown>
    : {};
  const kind = String(formatRaw.kind ?? '').trim();
  if (!OUTPUT_KINDS.has(kind)) throw new Error('invalid_output_format');
  const width = Number(formatRaw.width);
  const height = Number(formatRaw.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('invalid_output_format');
  }

  const shotList = Array.isArray(input.shot_list)
    ? input.shot_list.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const notes = String(formatRaw.notes ?? '').trim();

  return {
    creative_brief: String(input.creative_brief ?? '').trim(),
    prompt,
    negative_prompt: String(input.negative_prompt ?? '').trim(),
    shot_list: shotList,
    output_format: {
      kind: kind as CpWeaveBrief['output_format']['kind'],
      width,
      height,
      ...(notes ? { notes } : {}),
    },
  };
}
