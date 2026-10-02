import { readFileSync } from 'fs';
import { join } from 'path';
import { CatalogSchemaError } from './catalog-seed';
import { importCatalog } from './catalog-import';
import { MemoryCatalog } from './memory-catalog';

const seedPath = join(__dirname, '../../../../../docs/p13/p13-seed-v2.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as unknown;
const sqlPath = join(__dirname, '../../../../../docs/specs/2026-10-02-p13-01-service-catalog.sql');

const baseOpts = {
  dryRun: false,
  forceHours: false,
  deactivateMissing: false,
  fileName: 'p13-seed-v2.json',
  fileSha256: 'test',
  actor: 'jest',
};

describe('p13 catalog import', () => {
  it('dry-run reports 16 services, 675 items, 227 gates and writes nothing', async () => {
    const db = new MemoryCatalog();
    const summary = await importCatalog(db, seed, { ...baseOpts, dryRun: true });
    expect(summary.services_in_file).toBe(16);
    expect(summary.items_in_file).toBe(675);
    expect(summary.gates_in_file).toBe(227);
    expect(summary.items.created).toBe(675);
    expect(db.tables.services.size).toBe(0);
    expect(db.imports).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  it('apply stores 23 client_only and 652 billable, then a second run changes nothing', async () => {
    const db = new MemoryCatalog();
    const first = await importCatalog(db, seed, baseOpts);
    expect(first.client_only).toBe(23);
    expect(first.billable).toBe(652);
    expect(first.items.created).toBe(675);
    expect(db.imports).toHaveLength(1);
    expect(db.audits).toHaveLength(1);
    const second = await importCatalog(db, seed, baseOpts);
    expect(second.items.created).toBe(0);
    expect(second.items.updated).toBe(0);
    expect(second.services.created).toBe(0);
    expect(second.services.updated).toBe(0);
    expect(second.inputs.updated).toBe(0);
    expect(second.scope_rows.updated).toBe(0);
  });

  it('keeps an edited hour on WEB-04-08', async () => {
    const db = new MemoryCatalog();
    await importCatalog(db, seed, baseOpts);
    const item = db.tables.items.get('WEB-04-08');
    expect(item).toBeTruthy();
    item!.est_hours = '20.00';
    item!.est_hours_source = 'edited';
    const again = await importCatalog(db, seed, baseOpts);
    expect(again.items.skipped_edited).toBe(1);
    expect(db.tables.items.get('WEB-04-08')?.est_hours).toBe('20.00');
  });

  it('rejects a bad schema before any write', async () => {
    const db = new MemoryCatalog();
    await expect(importCatalog(db, { schema_version: 'nope' }, baseOpts)).rejects.toBeInstanceOf(CatalogSchemaError);
    expect(db.tables.items.size).toBe(0);
    expect(db.imports).toHaveLength(0);
  });

  it('does not mention the SPC catalog tables in the P13 migration', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase();
    expect(sql).not.toContain('service_family');
    expect(sql).not.toContain('service_offer');
    expect(sql).not.toContain('service_process_phase');
    expect(sql).not.toContain('tasks_json');
    expect(sql).not.toContain('crm_contracts');
  });
});
