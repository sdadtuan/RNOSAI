import { buildWeaveOpenUrl } from './cp-weave-open.util';

describe('buildWeaveOpenUrl', () => {
  it('attaches wo and does not treat app.weavy.ai as an API', () => {
    const result = buildWeaveOpenUrl({
      base: 'https://app.weavy.ai/',
      templateUrl: 'https://weave.figma.com/flows/feed-1x1',
      workOrderId: 'wo-1',
      projectId: 'prj-1',
    });

    expect(result.href).toContain('wo=wo-1');
    expect(result.href.startsWith('https://weave.figma.com/flows/feed-1x1')).toBe(true);
    expect(result.href).not.toMatch(/app\.weavy\.ai\/api/i);
    expect(result.href).not.toContain('/api/crm/');
  });

  it('falls back to WEAVE_OPEN_BASE when template URL is missing', () => {
    const result = buildWeaveOpenUrl({
      base: 'https://app.weavy.ai/',
      templateUrl: null,
      workOrderId: 'wo-2',
      projectId: 'prj-2',
    });

    expect(result.href.startsWith('https://app.weavy.ai/')).toBe(true);
    expect(result.href).toContain('wo=wo-2');
    expect(result.href).not.toMatch(/\/api(\/|$)/);
  });
});
