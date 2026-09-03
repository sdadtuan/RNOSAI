import { describe, expect, it } from 'vitest';
import {
  iwrB2bProjectCatalog,
  iwrB2bProjectOptionLabel,
  iwrProjectMetaPatch,
  resolveIwrB2bProjectId,
} from './iwr-b2b-project';

const catalog = iwrB2bProjectCatalog([
  { id: 'p1', code: 'acb-web', name: 'Website Redesign', status: 'active' },
  { id: 'p2', code: 'tiki-seo', name: 'SEO Growth', status: 'active' },
]);

describe('iwr-b2b-project', () => {
  it('builds option label from b2b project', () => {
    expect(iwrB2bProjectOptionLabel(catalog.get('p1')!)).toBe('Website Redesign (acb-web)');
  });

  it('resolves project id from meta.b2b_project_id', () => {
    expect(resolveIwrB2bProjectId({ b2b_project_id: 'p1' }, catalog)).toBe('p1');
  });

  it('resolves legacy free-text project labels', () => {
    expect(resolveIwrB2bProjectId({ project: 'SEO Growth (tiki-seo)' }, catalog)).toBe('p2');
  });

  it('patches meta with b2b project id and label', () => {
    expect(iwrProjectMetaPatch(catalog.get('p1')!)).toEqual({
      b2b_project_id: 'p1',
      project: 'Website Redesign (acb-web)',
    });
  });
});
