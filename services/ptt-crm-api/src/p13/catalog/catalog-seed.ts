export class CatalogSchemaError extends Error {
  readonly code = 'catalog_schema_invalid';
  readonly status = 422;

  constructor(message: string) {
    super(message);
    this.name = 'CatalogSchemaError';
  }
}

export type SeedLevel = { code: string; name: string; rank: number };
export type SeedPhase = { code: string; name: string; seq: number };
export type SeedGroup = { code: string; name: string; sort_order: number };
export type SeedRaci = { R?: string[]; A?: string[]; C?: string[]; I?: string[] };

export type SeedItem = {
  code: string;
  phase_code: string;
  seq_in_phase: number;
  sort_order: number;
  task: string;
  subtask: string | null;
  standard: string | null;
  raci: SeedRaci;
  main_role_code: string;
  tool: string | null;
  deliverable: string | null;
  approval_gate: boolean;
  gate_approver: string | null;
  min_level: 'basic' | 'standard' | 'advanced';
  est_hours: number;
  est_hours_is_assumption: boolean;
  unit: 'times' | 'month' | 'shoot_day';
  default_qty: number;
  billable: boolean;
  client_only: boolean;
  is_common: boolean;
};

export type SeedChild = {
  code: string;
  sort_order: number;
  fields: Record<string, unknown>;
};

export type SeedScope = {
  sort_order: number;
  feature: string;
  basic_text: string | null;
  standard_text: string | null;
  advanced_text: string | null;
};

export type SeedService = {
  code: string;
  name: string;
  group_code: string;
  sort_order: number;
  objective: string | null;
  problem: string | null;
  target_customers: string | null;
  prerequisites: string | null;
  exclusions: unknown[];
  billing_model: string | null;
  meta_json: Record<string, unknown>;
  legacy_sku_code: string | null;
  items: SeedItem[];
  inputs: SeedChild[];
  deliverables: SeedChild[];
  kpis: SeedChild[];
  risks: SeedChild[];
  scope: SeedScope[];
};

export type SeedFile = {
  schema_version: string;
  catalog_version: string;
  levels: SeedLevel[];
  phases: SeedPhase[];
  service_groups: SeedGroup[];
  services: SeedService[];
  retainer_templates: unknown[];
  counts: { services: number; items: number; gates: number; client_only: number; billable: number } | null;
};

const LEVELS = new Set(['basic', 'standard', 'advanced']);
const UNITS = new Set(['times', 'month', 'shoot_day']);
const PHASES = new Set(['K', 'N', 'P', 'S', 'T', 'D', 'B', 'V']);

function fail(message: string): never {
  throw new CatalogSchemaError(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} required`);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw ? raw : null;
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} must be a number`);
  return value;
}

export function decimalText(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
}

export function hoursStepOk(value: number): boolean {
  if (value < 0) return false;
  const doubled = Math.round(value * 2);
  return Math.abs(value * 2 - doubled) < 1e-6;
}

function childList(raw: unknown, path: string, fields: string[]): SeedChild[] {
  if (!Array.isArray(raw)) fail(`${path} must be an array`);
  return raw.map((row, index) => {
    if (!isObject(row)) fail(`${path}[${index}] must be an object`);
    const code = text(row.code, `${path}[${index}].code`);
    const bag: Record<string, unknown> = {};
    for (const field of fields) bag[field] = row[field] ?? null;
    return { code, sort_order: index + 1, fields: bag };
  });
}

export function validateSeed(raw: unknown): SeedFile {
  if (!isObject(raw)) fail('root must be an object');
  if (raw.schema_version !== 'p13-seed/1.0') fail('schema_version must be p13-seed/1.0');
  const catalogVersion = text(raw.catalog_version, 'catalog_version');
  if (!Array.isArray(raw.levels) || raw.levels.length !== 3) fail('levels must have 3 rows');
  const levels = raw.levels.map((row, index) => {
    if (!isObject(row)) fail(`levels[${index}]`);
    const code = text(row.code, `levels[${index}].code`);
    if (!LEVELS.has(code)) fail(`levels[${index}].code`);
    return { code, name: text(row.name, `levels[${index}].name`), rank: numberAt(row.rank, `levels[${index}].rank`) };
  });
  if (!Array.isArray(raw.phases) || raw.phases.length !== 8) fail('phases must have 8 rows');
  const phases = raw.phases.map((row, index) => {
    if (!isObject(row)) fail(`phases[${index}]`);
    const code = text(row.code, `phases[${index}].code`);
    if (!PHASES.has(code)) fail(`phases[${index}].code`);
    return { code, name: text(row.name, `phases[${index}].name`), seq: numberAt(row.seq, `phases[${index}].seq`) };
  });
  if (!Array.isArray(raw.service_groups)) fail('service_groups');
  const groups = raw.service_groups.map((row, index) => {
    if (!isObject(row)) fail(`service_groups[${index}]`);
    return {
      code: text(row.code, `service_groups[${index}].code`),
      name: text(row.name, `service_groups[${index}].name`),
      sort_order: numberAt(row.sort_order, `service_groups[${index}].sort_order`),
    };
  });
  if (!Array.isArray(raw.services) || raw.services.length === 0) fail('services');
  const itemCodes = new Set<string>();
  const services = raw.services.map((row, index) => parseService(row, index, itemCodes));
  const items = services.flatMap((service) => service.items);
  const gates = items.filter((item) => item.approval_gate).length;
  const clientOnly = items.filter((item) => item.client_only).length;
  const billable = items.filter((item) => item.billable).length;
  const counts = isObject(raw.counts)
    ? {
        services: numberAt(raw.counts.services, 'counts.services'),
        items: numberAt(raw.counts.items, 'counts.items'),
        gates: numberAt(raw.counts.gates, 'counts.gates'),
        client_only: numberAt(raw.counts.client_only, 'counts.client_only'),
        billable: numberAt(raw.counts.billable, 'counts.billable'),
      }
    : null;
  if (counts) {
    if (counts.services !== services.length) fail('counts.services mismatch');
    if (counts.items !== items.length) fail('counts.items mismatch');
    if (counts.gates !== gates) fail('counts.gates mismatch');
    if (counts.client_only !== clientOnly) fail('counts.client_only mismatch');
    if (counts.billable !== billable) fail('counts.billable mismatch');
  }
  return {
    schema_version: 'p13-seed/1.0',
    catalog_version: catalogVersion,
    levels,
    phases,
    service_groups: groups,
    services,
    retainer_templates: Array.isArray(raw.retainer_templates) ? raw.retainer_templates : [],
    counts,
  };
}

function parseService(row: unknown, index: number, itemCodes: Set<string>): SeedService {
  if (!isObject(row)) fail(`services[${index}]`);
  const code = text(row.code, `services[${index}].code`);
  const itemsRaw = row.items;
  if (!Array.isArray(itemsRaw)) fail(`services[${index}].items`);
  const items = itemsRaw.map((item, itemIndex) => parseItem(item, `${code}.items[${itemIndex}]`, code, itemCodes));
  const scopeRaw = row.scope_matrix;
  if (!Array.isArray(scopeRaw)) fail(`services[${index}].scope_matrix`);
  const scope = scopeRaw.map((scopeRow, scopeIndex) => {
    if (!isObject(scopeRow)) fail(`services[${index}].scope_matrix[${scopeIndex}]`);
    return {
      sort_order: scopeIndex + 1,
      feature: text(scopeRow.feature, `scope.feature`),
      basic_text: optionalText(scopeRow.basic),
      standard_text: optionalText(scopeRow.standard),
      advanced_text: optionalText(scopeRow.advanced),
    };
  });
  return {
    code,
    name: text(row.name, `services[${index}].name`),
    group_code: text(row.group_code, `services[${index}].group_code`),
    sort_order: numberAt(row.sort_order, `services[${index}].sort_order`),
    objective: optionalText(row.objective),
    problem: optionalText(row.problem),
    target_customers: optionalText(row.target_customers),
    prerequisites: optionalText(row.prerequisites),
    exclusions: Array.isArray(row.exclusions) ? row.exclusions : [],
    billing_model: optionalText(row.billing_model),
    legacy_sku_code: optionalText(row.legacy_sku_code),
    meta_json: {
      specs: row.specs ?? [],
      legal_notes: row.legal_notes ?? [],
      sow_client_responsibilities: row.sow_client_responsibilities ?? [],
      sow_out_of_scope: row.sow_out_of_scope ?? [],
      assumptions: row.assumptions ?? [],
      source_sheet: row.source_sheet ?? null,
    },
    items,
    inputs: childList(row.inputs, `services[${index}].inputs`, ['type', 'name', 'format_or_permission']),
    deliverables: childList(row.deliverables, `services[${index}].deliverables`, [
      'name',
      'format',
      'owner_role_code',
      'acceptance_criteria',
      'revision_limit_text',
      'approval_gate',
    ]),
    kpis: childList(row.kpis, `services[${index}].kpis`, [
      'type',
      'name',
      'formula',
      'data_source',
      'frequency',
      'owner_role_code',
    ]),
    risks: childList(row.risks, `services[${index}].risks`, [
      'risk',
      'likelihood',
      'impact',
      'mitigation',
      'owner_role_code',
    ]),
    scope,
  };
}

function parseItem(row: unknown, path: string, serviceCode: string, seen: Set<string>): SeedItem {
  if (!isObject(row)) fail(path);
  const code = text(row.code, `${path}.code`);
  if (!code.startsWith(`${serviceCode}-`)) fail(`${path}.code prefix`);
  if (seen.has(code)) fail(`duplicate item ${code}`);
  seen.add(code);
  const phase = text(row.phase_code, `${path}.phase_code`);
  if (!PHASES.has(phase)) fail(`${path}.phase_code`);
  const minLevel = text(row.min_level, `${path}.min_level`);
  if (!LEVELS.has(minLevel)) fail(`${path}.min_level`);
  const unit = text(row.unit, `${path}.unit`);
  if (!UNITS.has(unit)) fail(`${path}.unit`);
  const hours = numberAt(row.est_hours, `${path}.est_hours`);
  if (!hoursStepOk(hours)) fail(`${path}.est_hours`);
  if (!isObject(row.raci)) fail(`${path}.raci`);
  const approver = optionalText(row.gate_approver);
  if (approver && approver !== 'client' && approver !== 'internal') fail(`${path}.gate_approver`);
  return {
    code,
    phase_code: phase,
    seq_in_phase: typeof row.seq_in_phase === 'number' ? row.seq_in_phase : 0,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
    task: text(row.task, `${path}.task`),
    subtask: optionalText(row.subtask),
    standard: optionalText(row.standard),
    raci: row.raci as SeedRaci,
    main_role_code: text(row.main_role_code, `${path}.main_role_code`),
    tool: optionalText(row.tool),
    deliverable: optionalText(row.deliverable),
    approval_gate: row.approval_gate === true,
    gate_approver: approver,
    min_level: minLevel as SeedItem['min_level'],
    est_hours: hours,
    est_hours_is_assumption: row.est_hours_is_assumption !== false,
    unit: unit as SeedItem['unit'],
    default_qty: typeof row.default_qty === 'number' ? row.default_qty : 1,
    billable: row.billable === true,
    client_only: row.client_only === true,
    is_common: row.is_common === true,
  };
}
