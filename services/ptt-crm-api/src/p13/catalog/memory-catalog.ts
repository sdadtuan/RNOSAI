export const CATALOG_TABLES = [
  'groups',
  'levels',
  'phases',
  'services',
  'items',
  'inputs',
  'deliverables',
  'kpis',
  'risks',
] as const;

export type CatalogTable = (typeof CATALOG_TABLES)[number];

export type CatalogRow = Record<string, unknown>;

export interface CatalogTx {
  get(table: CatalogTable, code: string): Promise<CatalogRow | null>;
  put(table: CatalogTable, code: string, row: CatalogRow): Promise<void>;
  listCodes(table: CatalogTable, serviceCode?: string): Promise<string[]>;
  deactivateItems(codes: string[]): Promise<number>;
  getScope(serviceCode: string, sortOrder: number): Promise<CatalogRow | null>;
  putScope(serviceCode: string, sortOrder: number, row: CatalogRow): Promise<void>;
  deleteScope(serviceCode: string, sortOrder: number): Promise<void>;
  listScopeSorts(serviceCode: string): Promise<number[]>;
  setRetainer(templates: unknown[], catalogVersion: string): Promise<void>;
  recordImport(row: CatalogRow): Promise<void>;
  recordAudit(row: CatalogRow): Promise<void>;
}

export interface CatalogStore {
  transaction<T>(fn: (tx: CatalogTx) => Promise<T>, opts: { dryRun: boolean }): Promise<T>;
}

function cloneRow(row: CatalogRow): CatalogRow {
  return JSON.parse(JSON.stringify(row)) as CatalogRow;
}

export class MemoryCatalog implements CatalogStore {
  readonly tables: Record<CatalogTable, Map<string, CatalogRow>> = {
    groups: new Map(),
    levels: new Map(),
    phases: new Map(),
    services: new Map(),
    items: new Map(),
    inputs: new Map(),
    deliverables: new Map(),
    kpis: new Map(),
    risks: new Map(),
  };
  readonly scope = new Map<string, CatalogRow>();
  retainer: unknown[] = [];
  imports: CatalogRow[] = [];
  audits: CatalogRow[] = [];

  async transaction<T>(fn: (tx: CatalogTx) => Promise<T>, opts: { dryRun: boolean }): Promise<T> {
    const scratch = this.snapshot();
    const tx = new MemoryTx(scratch);
    const result = await fn(tx);
    if (!opts.dryRun) this.restore(scratch);
    return result;
  }

  private snapshot(): MemoryCatalog {
    const copy = new MemoryCatalog();
    for (const table of CATALOG_TABLES) {
      for (const [code, row] of this.tables[table]) copy.tables[table].set(code, cloneRow(row));
    }
    for (const [key, row] of this.scope) copy.scope.set(key, cloneRow(row));
    copy.retainer = JSON.parse(JSON.stringify(this.retainer)) as unknown[];
    copy.imports = this.imports.map((row) => cloneRow(row));
    copy.audits = this.audits.map((row) => cloneRow(row));
    return copy;
  }

  private restore(scratch: MemoryCatalog): void {
    for (const table of CATALOG_TABLES) {
      this.tables[table].clear();
      for (const [code, row] of scratch.tables[table]) this.tables[table].set(code, row);
    }
    this.scope.clear();
    for (const [key, row] of scratch.scope) this.scope.set(key, row);
    this.retainer = scratch.retainer;
    this.imports = scratch.imports;
    this.audits = scratch.audits;
  }
}

class MemoryTx implements CatalogTx {
  constructor(private readonly db: MemoryCatalog) {}

  async get(table: CatalogTable, code: string): Promise<CatalogRow | null> {
    const row = this.db.tables[table].get(code);
    return row ? cloneRow(row) : null;
  }

  async put(table: CatalogTable, code: string, row: CatalogRow): Promise<void> {
    this.db.tables[table].set(code, cloneRow(row));
  }

  async listCodes(table: CatalogTable, serviceCode?: string): Promise<string[]> {
    const codes: string[] = [];
    for (const [code, row] of this.db.tables[table]) {
      if (serviceCode && row.service_code !== serviceCode) continue;
      codes.push(code);
    }
    return codes;
  }

  async deactivateItems(codes: string[]): Promise<number> {
    let count = 0;
    for (const code of codes) {
      const row = this.db.tables.items.get(code);
      if (!row || row.is_active === false) continue;
      row.is_active = false;
      count += 1;
    }
    return count;
  }

  async getScope(serviceCode: string, sortOrder: number): Promise<CatalogRow | null> {
    const row = this.db.scope.get(`${serviceCode}:${sortOrder}`);
    return row ? cloneRow(row) : null;
  }

  async putScope(serviceCode: string, sortOrder: number, row: CatalogRow): Promise<void> {
    this.db.scope.set(`${serviceCode}:${sortOrder}`, cloneRow({ ...row, service_code: serviceCode, sort_order: sortOrder }));
  }

  async deleteScope(serviceCode: string, sortOrder: number): Promise<void> {
    this.db.scope.delete(`${serviceCode}:${sortOrder}`);
  }

  async listScopeSorts(serviceCode: string): Promise<number[]> {
    const sorts: number[] = [];
    for (const [key, row] of this.db.scope) {
      if (row.service_code === serviceCode) sorts.push(Number(key.split(':')[1]));
    }
    return sorts;
  }

  async setRetainer(templates: unknown[], catalogVersion: string): Promise<void> {
    this.db.retainer = JSON.parse(JSON.stringify(templates)) as unknown[];
    void catalogVersion;
  }

  async recordImport(row: CatalogRow): Promise<void> {
    this.db.imports.push(cloneRow(row));
  }

  async recordAudit(row: CatalogRow): Promise<void> {
    this.db.audits.push(cloneRow(row));
  }
}
