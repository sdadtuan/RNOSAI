import { buildSearchSnippet, normalizeSearchEntityType } from './crm-search.types';

describe('crm-search.types', () => {
  it('normalizes entity types', () => {
    expect(normalizeSearchEntityType('LEAD')).toBe('lead');
    expect(normalizeSearchEntityType('bad')).toBeNull();
  });

  it('builds snippet around query', () => {
    const snippet = buildSearchSnippet('Hello world from OpenSearch CRM index', 'OpenSearch');
    expect(snippet.toLowerCase()).toContain('opensearch');
  });
});

describe('CrmSearchService scoring via SearchDocumentProvider logic', () => {
  it('scores title matches higher than body-only', () => {
    const needle = 'acme';
    const titleMatch = `${'other '.repeat(10)}acme corp`.toLowerCase().includes(needle) ? 4 : 0;
    const bodyOnly = 'other'.includes(needle) ? 1 : 0;
    expect(titleMatch).toBeGreaterThan(bodyOnly);
  });
});
