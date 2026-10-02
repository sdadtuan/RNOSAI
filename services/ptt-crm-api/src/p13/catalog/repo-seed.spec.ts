import { readRepoCatalogSeed } from './repo-seed';

describe('repo catalog seed', () => {
  it('reads p13-seed-v2.json from the repo without an upload', () => {
    const file = readRepoCatalogSeed();
    const parsed = JSON.parse(file.text) as { schema_version: string; counts: { services: number; items: number } };
    expect(file.fileName).toBe('p13-seed-v2.json');
    expect(parsed.schema_version).toBe('p13-seed/1.0');
    expect(parsed.counts.services).toBe(16);
    expect(parsed.counts.items).toBe(675);
  });
});
