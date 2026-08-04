import type { LeadFlowKind } from './lead-flow-kind.util';

type SqlDialect = 'postgres' | 'sqlite';

function explicitFlowExpr(dialect: SqlDialect, alias: string): string {
  const meta = `${alias}.meta_json`;
  if (dialect === 'postgres') {
    return `lower(trim(COALESCE(${meta}->>'lead_flow_kind', ${meta}->>'lead_flow', '')))`;
  }
  return `lower(trim(COALESCE(json_extract(${meta}, '$.lead_flow_kind'), json_extract(${meta}, '$.lead_flow'), '')))`;
}

function hasAgencyClientExpr(dialect: SqlDialect, alias: string): string {
  if (dialect === 'postgres') {
    return `${alias}.agency_client_id IS NOT NULL`;
  }
  return `COALESCE(json_extract(${alias}.meta_json, '$.agency_client_id'), '') <> ''`;
}

function statusExpr(alias: string): string {
  return `lower(trim(COALESCE(${alias}.status, '')))`;
}

/** Mirrors resolveLeadFlowKind() for list queries (presales not considered). */
export function buildSpaOperationalListFilter(dialect: SqlDialect, alias = 'l'): string {
  const explicit = explicitFlowExpr(dialect, alias);
  const hasClient = hasAgencyClientExpr(dialect, alias);
  const status = statusExpr(alias);

  return `(
    ${explicit} IN ('spa_operational', 'spa')
    OR (
      ${hasClient}
      AND ${explicit} NOT IN ('b2b_prospect', 'b2b')
      AND ${status} NOT IN ('won', 'proposal')
    )
  )`;
}

export function buildLeadFlowKindListFilter(
  kind: LeadFlowKind,
  dialect: SqlDialect,
  alias = 'l',
): string {
  const spa = buildSpaOperationalListFilter(dialect, alias);
  if (kind === 'spa_operational') return spa;
  return `(NOT (${spa}))`;
}
