import { catalogTs } from '../catalog/catalog-slug.util';

interface ExpenseLinkStatement {
  run(...params: unknown[]): { changes?: number | bigint };
}

interface ExpenseLinkStore {
  prepare(sql: string): ExpenseLinkStatement;
}

/**
 * Legacy contract promotion still supplies its transaction-bound store.
 * Service lifecycle runtime finance reads and writes live in PostgreSQL repositories.
 */
export function linkPresalesExpensesToLifecycle(
  store: ExpenseLinkStore,
  presalesId: number,
  lifecycleId: number,
): number {
  const result = store
    .prepare(
      `UPDATE crm_svc_expenses
       SET lifecycle_id = ?, updated_at = ?
       WHERE presales_id = ? AND cost_phase = 'presales' AND lifecycle_id IS NULL`,
    )
    .run(lifecycleId, catalogTs(), presalesId);
  return Number(result.changes ?? 0);
}
