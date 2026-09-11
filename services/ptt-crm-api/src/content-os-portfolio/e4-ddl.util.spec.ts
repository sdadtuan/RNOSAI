import { readFileSync } from 'fs';
import { join } from 'path';
import { E4_DDL_REQUIRED } from './e4-ddl.util';

describe('E4 WIN DDL', () => {
  const sql = readFileSync(
    join(__dirname, '../../../../docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql'),
    'utf8',
  );

  it('creates oauth state, execute unique, dam bind, and hold actor', () => {
    for (const needle of E4_DDL_REQUIRED) {
      expect(sql).toContain(needle);
    }
    expect(sql).not.toMatch(/DROP TABLE cmkt_connectors/i);
    expect(sql).not.toMatch(/CREATE TABLE cmkt_content_items/i);
  });
});
