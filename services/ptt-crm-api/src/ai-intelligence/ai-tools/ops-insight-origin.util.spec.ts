import {
  buildPresalesAssumedRubric,
  buildPresalesDraftConfidenceJson,
  detectInsightOrigin,
  PRESALES_SOURCE_TOOL,
} from './ops-insight-origin.util';

describe('ops-insight-origin.util', () => {
  it('detects explicit origin / source_tool', () => {
    expect(
      detectInsightOrigin({
        ai_generated: false,
        confidence_json: { origin: 'presales_ai' },
      }),
    ).toBe('presales_ai');
    expect(
      detectInsightOrigin({
        confidence_json: { source_tool: PRESALES_SOURCE_TOOL },
      }),
    ).toBe('presales_ai');
  });

  it('detects [P7] marker and ai_generated fallback', () => {
    expect(detectInsightOrigin({ statement: '[P7] Presales insight — X' })).toBe('presales_ai');
    expect(detectInsightOrigin({ ai_generated: true })).toBe('presales_ai');
    expect(detectInsightOrigin({ ai_generated: false, statement: 'Manual' })).toBe(
      'research_manual',
    );
  });

  it('builds draft confidence + assumed rubric', () => {
    const draft = buildPresalesDraftConfidenceJson({});
    expect(draft.origin).toBe('presales_ai');
    expect(draft.source_tool).toBe(PRESALES_SOURCE_TOOL);
    const rubric = buildPresalesAssumedRubric({});
    expect(rubric.assumed_from_presales).toBe(true);
    expect((rubric.rubric as { S: number }).S).toBe(2);
  });
});
