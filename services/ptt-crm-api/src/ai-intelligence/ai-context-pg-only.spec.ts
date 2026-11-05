import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTEXT_FILES = [
  'lead-score-context.repository.ts',
  'deal-score-context.repository.ts',
  'lead-route-context.repository.ts',
  'nl-query-context.repository.ts',
  'upsell-context.repository.ts',
  'churn-health-context.repository.ts',
  'renewal-contract-context.repository.ts',
  'ai-forecast.service.ts',
];

describe('AI Intelligence PostgreSQL-only context', () => {
  it.each(CONTEXT_FILES)('%s has no SQLite dependency', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8');
    expect(source).not.toMatch(/CrmLeadsSqliteRepository|DatabaseSync|node:sqlite|sqlitePath/);
  });
});
