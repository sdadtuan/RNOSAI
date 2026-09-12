import { describe, expect, it } from 'vitest';
import { CP_PROJECT_TABS } from './cp-project-tabs.util';
import { buildOpenHref } from './cp-weave-api';
import { aiOpsHref } from './cp-ai-ops-panes.util';

describe('buildOpenHref', () => {
  it('keeps wo on the Weave deep-link and does not use app.weavy.ai as an API', () => {
    const href = buildOpenHref({
      href: 'https://weave.figma.com/flows/feed-1x1?wo=wo-1&project=p1',
    });
    expect(href).toContain('wo=wo-1');
    expect(href.startsWith('https://weave.figma.com/')).toBe(true);
    expect(href).not.toMatch(/app\.weavy\.ai\/api/i);
  });
});

describe('AI Ops weave pane', () => {
  it('opens Weave on tab=ai-ops&pane=weave and never adds a weave project tab', () => {
    expect(aiOpsHref('proj-1', 'weave')).toBe(
      '/crm/creative-os/projects/proj-1?tab=ai-ops&pane=weave',
    );
    expect(CP_PROJECT_TABS.map((tab) => tab.id)).not.toContain('weave');
  });
});
