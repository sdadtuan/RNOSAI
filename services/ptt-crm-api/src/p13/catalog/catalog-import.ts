import { createHash } from 'crypto';
import { decimalText, validateSeed, type SeedFile, type SeedItem } from './catalog-seed';
import type { CatalogRow, CatalogStore, CatalogTable, CatalogTx } from './memory-catalog';

export type Bucket = {
  created: number;
  updated: number;
  unchanged: number;
  skipped_edited: number;
  deactivated: number;
};

export type ImportSummary = {
  dry_run: boolean;
  groups: Bucket;
  levels: Bucket;
  phases: Bucket;
  services: Bucket;
  items: Bucket;
  inputs: Bucket;
  deliverables: Bucket;
  kpis: Bucket;
  risks: Bucket;
  scope_rows: Bucket;
  services_in_file: number;
  items_in_file: number;
  gates_in_file: number;
  client_only: number;
  billable: number;
  pricing_draft: 'deferred_to_p13b' | 'created' | 'exists';
};

export type ImportOptions = {
  dryRun: boolean;
  forceHours: boolean;
  deactivateMissing: boolean;
  fileName: string;
  fileSha256: string;
  actor: string;
};

const PROTECTED = ['est_hours', 'min_level', 'billable', 'default_qty'] as const;

function emptyBucket(): Bucket {
  return { created: 0, updated: 0, unchanged: 0, skipped_edited: 0, deactivated: 0 };
}

function stable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = sortValue(record[key]);
    return out;
  }
  return value;
}

function same(left: CatalogRow | null, right: CatalogRow, keys: string[]): boolean {
  if (!left) return false;
  return keys.every((key) => stable(left[key]) === stable(right[key]));
}

async function upsert(
  tx: CatalogTx,
  table: CatalogTable,
  code: string,
  row: CatalogRow,
  keys: string[],
  bucket: Bucket,
): Promise<void> {
  const existing = await tx.get(table, code);
  if (!existing) {
    await tx.put(table, code, row);
    bucket.created += 1;
    return;
  }
  if (same(existing, row, keys)) {
    bucket.unchanged += 1;
    return;
  }
  await tx.put(table, code, { ...existing, ...row, created_by: existing.created_by });
  bucket.updated += 1;
}

function itemRow(serviceCode: string, item: SeedItem, source: 'seed' | 'edited', assumption: boolean): CatalogRow {
  return {
    service_code: serviceCode,
    code: item.code,
    phase_code: item.phase_code,
    seq_in_phase: item.seq_in_phase,
    sort_order: item.sort_order,
    task: item.task,
    subtask: item.subtask,
    standard: item.standard,
    raci: item.raci,
    main_role_code: item.main_role_code,
    tool: item.tool,
    deliverable: item.deliverable,
    approval_gate: item.approval_gate,
    gate_approver: item.gate_approver,
    min_level: item.min_level,
    est_hours: decimalText(item.est_hours),
    est_hours_is_assumption: assumption,
    est_hours_source: source,
    unit: item.unit,
    default_qty: decimalText(item.default_qty),
    billable: item.billable,
    client_only: item.client_only,
    is_common: item.is_common,
    is_active: true,
  };
}

const ITEM_KEYS = [
  'service_code',
  'phase_code',
  'seq_in_phase',
  'sort_order',
  'task',
  'subtask',
  'standard',
  'raci',
  'main_role_code',
  'tool',
  'deliverable',
  'approval_gate',
  'gate_approver',
  'min_level',
  'est_hours',
  'est_hours_is_assumption',
  'est_hours_source',
  'unit',
  'default_qty',
  'billable',
  'client_only',
  'is_common',
  'is_active',
];

export function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export async function importCatalog(store: CatalogStore, raw: unknown, opts: ImportOptions): Promise<ImportSummary> {
  const seed = validateSeed(raw);
  return store.transaction((tx) => applySeed(tx, seed, opts), { dryRun: opts.dryRun });
}

async function applySeed(tx: CatalogTx, seed: SeedFile, opts: ImportOptions): Promise<ImportSummary> {
  const summary: ImportSummary = {
    dry_run: opts.dryRun,
    groups: emptyBucket(),
    levels: emptyBucket(),
    phases: emptyBucket(),
    services: emptyBucket(),
    items: emptyBucket(),
    inputs: emptyBucket(),
    deliverables: emptyBucket(),
    kpis: emptyBucket(),
    risks: emptyBucket(),
    scope_rows: emptyBucket(),
    services_in_file: seed.services.length,
    items_in_file: seed.services.reduce((sum, service) => sum + service.items.length, 0),
    gates_in_file: 0,
    client_only: 0,
    billable: 0,
    pricing_draft: 'deferred_to_p13b',
  };

  for (const group of seed.service_groups) {
    await upsert(tx, 'groups', group.code, { code: group.code, name: group.name, sort_order: group.sort_order, is_active: true }, ['name', 'sort_order', 'is_active'], summary.groups);
  }
  for (const level of seed.levels) {
    await upsert(tx, 'levels', level.code, { code: level.code, name: level.name, rank: level.rank }, ['name', 'rank'], summary.levels);
  }
  for (const phase of seed.phases) {
    await upsert(tx, 'phases', phase.code, { code: phase.code, name: phase.name, seq: phase.seq }, ['name', 'seq'], summary.phases);
  }

  const seenItems = new Set<string>();
  for (const service of seed.services) {
    await upsert(
      tx,
      'services',
      service.code,
      {
        code: service.code,
        group_code: service.group_code,
        name: service.name,
        sort_order: service.sort_order,
        objective: service.objective,
        problem: service.problem,
        target_customers: service.target_customers,
        prerequisites: service.prerequisites,
        exclusions: service.exclusions,
        billing_model: service.billing_model,
        meta_json: service.meta_json,
        legacy_sku_code: service.legacy_sku_code,
        catalog_version: seed.catalog_version,
        is_active: true,
      },
      ['group_code', 'name', 'sort_order', 'objective', 'problem', 'target_customers', 'prerequisites', 'exclusions', 'billing_model', 'meta_json', 'legacy_sku_code', 'catalog_version', 'is_active'],
      summary.services,
    );

    for (const item of service.items) {
      seenItems.add(item.code);
      if (item.approval_gate) summary.gates_in_file += 1;
      const existing = await tx.get('items', item.code);
      const protect = Boolean(existing && existing.est_hours_source === 'edited' && !opts.forceHours);
      const assumption = existing ? existing.est_hours_is_assumption === true : item.est_hours_is_assumption;
      const source = protect ? 'edited' : existing?.est_hours_source === 'edited' && opts.forceHours ? 'seed' : existing ? String(existing.est_hours_source ?? 'seed') : 'seed';
      const next = itemRow(service.code, item, source === 'edited' ? 'edited' : 'seed', assumption);
      if (protect && existing) {
        next.est_hours = existing.est_hours;
        next.min_level = existing.min_level;
        next.billable = existing.billable;
        next.default_qty = existing.default_qty;
        next.est_hours_source = 'edited';
        const seedRow = itemRow(service.code, item, 'seed', assumption);
        const protectedChanged = PROTECTED.some((key) => stable(existing[key]) !== stable(seedRow[key]));
        if (protectedChanged) summary.items.skipped_edited += 1;
      }
      if (!existing) {
        await tx.put('items', item.code, next);
        summary.items.created += 1;
      } else if (same(existing, next, ITEM_KEYS)) {
        summary.items.unchanged += 1;
      } else {
        await tx.put('items', item.code, { ...existing, ...next, created_by: existing.created_by });
        summary.items.updated += 1;
      }
    }

    await upsertChildren(tx, 'inputs', service.code, service.inputs, ['type', 'name', 'format_or_permission', 'sort_order', 'is_active'], summary.inputs);
    await upsertChildren(tx, 'deliverables', service.code, service.deliverables, ['name', 'format', 'owner_role_code', 'acceptance_criteria', 'revision_limit_text', 'approval_gate', 'sort_order', 'is_active'], summary.deliverables);
    await upsertChildren(tx, 'kpis', service.code, service.kpis, ['type', 'name', 'formula', 'data_source', 'frequency', 'owner_role_code', 'sort_order', 'is_active'], summary.kpis);
    await upsertChildren(tx, 'risks', service.code, service.risks, ['risk', 'likelihood', 'impact', 'mitigation', 'owner_role_code', 'sort_order', 'is_active'], summary.risks);

    const keepSorts = new Set<number>();
    for (const scope of service.scope) {
      keepSorts.add(scope.sort_order);
      const row = {
        service_code: service.code,
        sort_order: scope.sort_order,
        feature: scope.feature,
        basic_text: scope.basic_text,
        standard_text: scope.standard_text,
        advanced_text: scope.advanced_text,
      };
      const existing = await tx.getScope(service.code, scope.sort_order);
      if (!existing) {
        await tx.putScope(service.code, scope.sort_order, row);
        summary.scope_rows.created += 1;
      } else if (same(existing, row, ['feature', 'basic_text', 'standard_text', 'advanced_text'])) {
        summary.scope_rows.unchanged += 1;
      } else {
        await tx.putScope(service.code, scope.sort_order, row);
        summary.scope_rows.updated += 1;
      }
    }
    for (const sort of await tx.listScopeSorts(service.code)) {
      if (!keepSorts.has(sort)) await tx.deleteScope(service.code, sort);
    }

    if (opts.deactivateMissing) {
      const existingCodes = await tx.listCodes('items', service.code);
      const missing = existingCodes.filter((code) => !seenItems.has(code));
      summary.items.deactivated += await tx.deactivateItems(missing);
    }
  }

  await tx.setRetainer(seed.retainer_templates, seed.catalog_version);
  for (const code of await tx.listCodes('items')) {
    const row = await tx.get('items', code);
    if (!row || row.is_active === false) continue;
    if (row.client_only === true) summary.client_only += 1;
    if (row.billable === true) summary.billable += 1;
  }

  const log = {
    file_name: opts.fileName,
    file_sha256: opts.fileSha256,
    schema_version: seed.schema_version,
    catalog_version: seed.catalog_version,
    mode: opts.dryRun ? 'dry_run' : 'apply',
    summary_json: summary,
    run_by: opts.actor,
  };
  await tx.recordImport(log);
  await tx.recordAudit({
    action: opts.dryRun ? 'catalog_import_dry_run' : 'catalog_import_apply',
    actor: opts.actor,
    summary,
  });
  return summary;
}

async function upsertChildren(
  tx: CatalogTx,
  table: CatalogTable,
  serviceCode: string,
  rows: Array<{ code: string; sort_order: number; fields: Record<string, unknown> }>,
  keys: string[],
  bucket: Bucket,
): Promise<void> {
  for (const row of rows) {
    await upsert(
      tx,
      table,
      row.code,
      { service_code: serviceCode, code: row.code, sort_order: row.sort_order, is_active: true, ...row.fields },
      keys,
      bucket,
    );
  }
}
