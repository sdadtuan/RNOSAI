import { extractAiTraceSources, toAiTraceRow } from './ai-traces.util';

describe('extractAiTraceSources', () => {
  it('returns empty when copilotSources is missing', () => {
    expect(extractAiTraceSources({})).toEqual([]);
    expect(extractAiTraceSources(null)).toEqual([]);
  });

  it('keeps only id and pattern from job or nested brand_context', () => {
    expect(
      extractAiTraceSources({
        copilotSources: [
          { id: 11, pattern: 'hook-pain', evidence: 'SECRET_EVIDENCE', expires_at: '2099-01-01' },
          { id: 12, pattern: 'proof' },
        ],
        prompt: 'RAW PROMPT',
      }),
    ).toEqual([
      { id: 11, pattern: 'hook-pain' },
      { id: 12, pattern: 'proof' },
    ]);

    expect(
      extractAiTraceSources({
        brand_context: {
          copilotSources: [{ id: 7, pattern: 'offer' }],
        },
      }),
    ).toEqual([{ id: 7, pattern: 'offer' }]);
  });
});

describe('toAiTraceRow', () => {
  const job = {
    id: 55,
    job_type: 'draft_generate',
    status: 'succeeded',
    created_at: '2026-09-10T08:00:00.000Z',
    finished_at: '2026-09-10T08:01:00.000Z',
    ai_run_id: 'run-1',
    input_json: {
      prompt: 'do not leak',
      system_prompt: 'system secret',
      copilotSources: [{ id: 11, pattern: 'hook-pain', evidence: 'nope' }],
    },
    output_json: { markdown: 'full draft' },
  };

  it('maps time, intent, sources, job_id, status and optional run_id', () => {
    const row = toAiTraceRow(job);
    expect(row).toEqual({
      at: '2026-09-10T08:01:00.000Z',
      intent: 'Draft generate',
      sources: [{ id: 11, pattern: 'hook-pain' }],
      job_id: 55,
      status: 'succeeded',
      run_id: 'run-1',
    });
  });

  it('uses created_at when finished_at is missing and omits run_id when absent', () => {
    const row = toAiTraceRow({
      ...job,
      finished_at: null,
      ai_run_id: null,
      job_type: 'custom_job',
      input_json: {},
    });
    expect(row.at).toBe('2026-09-10T08:00:00.000Z');
    expect(row.intent).toBe('custom_job');
    expect(row).not.toHaveProperty('run_id');
  });

  it('never includes prompt, system prompt, or full input/output json', () => {
    const row = toAiTraceRow(job, {
      id: 'run-1',
      input_json: { systemPrompt: 'hidden', userPrompt: 'hidden', prompt: 'hidden' },
    });
    const serialized = JSON.stringify(row);
    expect(serialized).not.toMatch(/prompt|input_json|output_json|markdown|SECRET|hidden|system/i);
    expect(row).not.toHaveProperty('input_json');
    expect(row).not.toHaveProperty('output_json');
    expect(row).not.toHaveProperty('prompt');
  });

  it('falls back to run copilotSources when the job has none', () => {
    const row = toAiTraceRow(
      { ...job, input_json: { tone: 'friendly' }, ai_run_id: 'run-9' },
      { id: 'run-9', input_json: { copilotSources: [{ id: 3, pattern: 'from-run' }] } },
    );
    expect(row.sources).toEqual([{ id: 3, pattern: 'from-run' }]);
    expect(row.run_id).toBe('run-9');
  });
});
