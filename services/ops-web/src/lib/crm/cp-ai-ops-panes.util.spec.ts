import { describe, expect, it } from 'vitest';
import { aiOpsHref, parseAiOpsPane } from './cp-ai-ops-panes.util';

describe('parseAiOpsPane', () => {
  it('defaults unknown or missing pane to weave', () => {
    expect(parseAiOpsPane(null)).toBe('weave');
    expect(parseAiOpsPane('magnific')).toBe('magnific');
    expect(parseAiOpsPane('nope')).toBe('weave');
  });
});

describe('aiOpsHref', () => {
  it('builds the comfy pane href without extra query params', () => {
    expect(aiOpsHref('p1', 'comfy')).toBe(
      '/crm/creative-os/projects/p1?tab=ai-ops&pane=comfy',
    );
  });
});
