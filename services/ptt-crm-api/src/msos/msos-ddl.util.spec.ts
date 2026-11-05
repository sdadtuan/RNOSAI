import { readFileSync } from 'fs';
import { join } from 'path';
import { MSOS_DDL_REQUIRED } from './msos-ddl.util';

describe('MSOS W1+WIN DDL', () => {
  const sql = readFileSync(
    join(__dirname, '../../../../docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql'),
    'utf8',
  );

  it('creates owned tables and forbids CRM/invoice clone', () => {
    for (const needle of MSOS_DDL_REQUIRED) {
      expect(sql).toContain(needle);
    }
    expect(sql).not.toMatch(/CREATE TABLE clients/i);
    expect(sql).not.toMatch(/CREATE TABLE crm_invoices/i);
    expect(sql).not.toMatch(/CREATE TABLE leads/i);
    expect(sql).not.toMatch(/INSERT INTO msos_partners/i);
    expect(sql).not.toMatch(/Sunlight|Tâm An|Admicro/i);
  });
});
