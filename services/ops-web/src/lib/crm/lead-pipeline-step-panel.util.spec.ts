import { describe, expect, it } from 'vitest';
import { resolvePipelinePanelMode } from './lead-pipeline-step-panel.util';

describe('resolvePipelinePanelMode', () => {
  it('shows placeholder for pending far-ahead steps', () => {
    expect(resolvePipelinePanelMode('proposal', 'pending')).toBe('blocked_ahead');
  });
  it('shows live panel for current', () => {
    expect(resolvePipelinePanelMode('b2', 'current')).toBe('live');
  });
  it('shows live panel for done (review)', () => {
    expect(resolvePipelinePanelMode('b2', 'done')).toBe('live');
  });
  it('shows review banner mode when blocked+review', () => {
    expect(resolvePipelinePanelMode('presales_lead', 'blocked', true)).toBe('review');
  });
});
