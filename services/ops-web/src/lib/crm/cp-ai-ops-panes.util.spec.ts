import { describe, expect, it } from 'vitest';
import { CP_PROJECT_TABS } from './cp-project-tabs.util';
import {
  aiOpsHref,
  isMagnificComposerDisabled,
  isMagnificTransportEnabled,
  magnificProviderFromTransport,
  parseAiOpsPane,
} from './cp-ai-ops-panes.util';

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

  it('opens Magnific on tab=ai-ops&pane=magnific and never adds a magnific project tab or /crm/aco', () => {
    expect(aiOpsHref('proj-1', 'magnific')).toBe(
      '/crm/creative-os/projects/proj-1?tab=ai-ops&pane=magnific',
    );
    expect(aiOpsHref('proj-1', 'magnific', { job: 'job-9' })).toBe(
      '/crm/creative-os/projects/proj-1?tab=ai-ops&pane=magnific&job=job-9',
    );
    expect(CP_PROJECT_TABS.map((tab) => tab.id)).not.toContain('magnific');
    expect(CP_PROJECT_TABS.map((tab) => tab.id)).not.toContain('weave');
    expect(aiOpsHref('proj-1', 'magnific')).not.toContain('/crm/aco');
  });
});

describe('Magnific transport disable rules', () => {
  it('maps radio API to magnific_rest and MCP to magnific_mcp', () => {
    expect(magnificProviderFromTransport('api')).toBe('magnific_rest');
    expect(magnificProviderFromTransport('mcp')).toBe('magnific_mcp');
  });

  it('disables a radio when its flag is off and disables the composer when both are off', () => {
    const bothOn = { magnificRest: true, magnificMcp: true };
    const restOnly = { magnificRest: true, magnificMcp: false };
    const mcpOnly = { magnificRest: false, magnificMcp: true };
    const bothOff = { magnificRest: false, magnificMcp: false };

    expect(isMagnificTransportEnabled(bothOn, 'api')).toBe(true);
    expect(isMagnificTransportEnabled(bothOn, 'mcp')).toBe(true);
    expect(isMagnificComposerDisabled(bothOn)).toBe(false);

    expect(isMagnificTransportEnabled(restOnly, 'api')).toBe(true);
    expect(isMagnificTransportEnabled(restOnly, 'mcp')).toBe(false);
    expect(isMagnificComposerDisabled(restOnly)).toBe(false);

    expect(isMagnificTransportEnabled(mcpOnly, 'api')).toBe(false);
    expect(isMagnificTransportEnabled(mcpOnly, 'mcp')).toBe(true);
    expect(isMagnificComposerDisabled(mcpOnly)).toBe(false);

    expect(isMagnificTransportEnabled(bothOff, 'api')).toBe(false);
    expect(isMagnificTransportEnabled(bothOff, 'mcp')).toBe(false);
    expect(isMagnificComposerDisabled(bothOff)).toBe(true);
  });
});
