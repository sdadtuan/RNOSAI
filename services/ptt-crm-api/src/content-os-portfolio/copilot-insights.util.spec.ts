import {
  formatCopilotSourcesPromptSection,
  selectCopilotSources,
  type CmktInsightRow,
} from './copilot-insights.util';

function insight(partial: Partial<CmktInsightRow> & Pick<CmktInsightRow, 'id' | 'status'>): CmktInsightRow {
  return {
    lifecycle_id: 4,
    pattern: `pattern-${partial.id}`,
    evidence: `evidence-${partial.id}`,
    confidence: 0.8,
    scope_json: {},
    expires_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('selectCopilotSources', () => {
  const now = new Date('2026-09-11T03:00:00.000Z');

  it('does not include a Draft insight in copilotSources', () => {
    const sources = selectCopilotSources(
      [insight({ id: 1, status: 'Draft', pattern: 'draft-hook', evidence: 'should stay out' })],
      now,
    );
    expect(sources.map((row) => row.id)).not.toContain(1);
    expect(sources).toEqual([]);
  });

  it('includes an Approved unexpired insight in copilotSources', () => {
    const sources = selectCopilotSources(
      [
        insight({
          id: 2,
          status: 'Approved',
          pattern: 'reel-hook',
          evidence: '3s hook lifts watch',
          expires_at: '2026-12-01T00:00:00.000Z',
        }),
      ],
      now,
    );
    expect(sources).toEqual([
      {
        id: 2,
        pattern: 'reel-hook',
        evidence: '3s hook lifts watch',
        expires_at: '2026-12-01T00:00:00.000Z',
      },
    ]);
  });

  it('includes Approved insights with null expires_at', () => {
    const sources = selectCopilotSources([insight({ id: 3, status: 'Approved', expires_at: null })], now);
    expect(sources.map((row) => row.id)).toEqual([3]);
  });

  it('does not include an expired Approved insight in copilotSources', () => {
    const sources = selectCopilotSources(
      [
        insight({
          id: 4,
          status: 'Approved',
          expires_at: '2026-09-10T23:59:59.000Z',
        }),
      ],
      now,
    );
    expect(sources.map((row) => row.id)).not.toContain(4);
    expect(sources).toEqual([]);
  });

  it('excludes Rejected, Outdated, and Superseded even when unexpired', () => {
    const sources = selectCopilotSources(
      [
        insight({ id: 5, status: 'Rejected', expires_at: null }),
        insight({ id: 6, status: 'Outdated', expires_at: '2026-12-01T00:00:00.000Z' }),
        insight({ id: 7, status: 'Superseded', expires_at: null }),
        insight({ id: 8, status: 'Approved', pattern: 'keep', evidence: 'ok' }),
      ],
      now,
    );
    expect(sources.map((row) => row.id)).toEqual([8]);
  });
});

describe('formatCopilotSourcesPromptSection', () => {
  it('returns a labeled section used by draft prompts', () => {
    const section = formatCopilotSourcesPromptSection([
      { id: 2, pattern: 'reel-hook', evidence: '3s hook lifts watch', expires_at: null },
    ]);
    expect(section).toContain('Approved insights (copilot whitelist)');
    expect(section).toContain('#2');
    expect(section).toContain('reel-hook');
    expect(section).toContain('3s hook lifts watch');
    expect(section).not.toMatch(/SELECT |cmkt_insights/i);
  });

  it('returns empty string when there are no whitelist sources', () => {
    expect(formatCopilotSourcesPromptSection([])).toBe('');
  });
});
