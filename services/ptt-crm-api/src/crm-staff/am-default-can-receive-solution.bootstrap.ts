import type { Logger } from '@nestjs/common';
import type { Pool } from 'pg';

export const AM_DEFAULT_CAN_RECEIVE_SOLUTION_MIGRATION = '2026-11-20-am-recv-solution';

const MIGRATION_DESCRIPTION =
  'One-time default tick Nhận Solution (can_receive_solution) for active AM positions (acm, kd-01, kd01)';

type LogLike = Pick<Logger, 'log' | 'warn'>;

/** One-time backfill; guarded by schema_migrations — safe on every API start. */
export async function bootstrapAmDefaultCanReceiveSolution(db: Pool, logger?: LogLike): Promise<void> {
  const tableCheck = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'schema_migrations'
     LIMIT 1`,
  );
  if ((tableCheck.rowCount ?? 0) === 0) {
    logger?.warn?.(
      'bootstrapAmDefaultCanReceiveSolution: schema_migrations missing; skipping AM can_receive_solution backfill',
    );
    return;
  }

  const marker = await db.query(`SELECT 1 FROM schema_migrations WHERE version = $1 LIMIT 1`, [
    AM_DEFAULT_CAN_RECEIVE_SOLUTION_MIGRATION,
  ]);
  if ((marker.rowCount ?? 0) > 0) return;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const update = await client.query(`
      UPDATE crm_staff s
      SET can_receive_solution = TRUE,
          updated_at = NOW()
      FROM crm_positions p
      WHERE p.id = s.position_id
        AND s.active IS TRUE
        AND COALESCE(s.can_receive_solution, FALSE) IS NOT TRUE
        AND lower(replace(COALESCE(p.code, ''), ' ', '')) IN ('acm', 'kd-01', 'kd01')
    `);
    await client.query(`INSERT INTO schema_migrations (version, description) VALUES ($1, $2)`, [
      AM_DEFAULT_CAN_RECEIVE_SOLUTION_MIGRATION,
      MIGRATION_DESCRIPTION,
    ]);
    await client.query('COMMIT');
    logger?.log?.(
      `bootstrapAmDefaultCanReceiveSolution: backfill updated ${update.rowCount ?? 0} active AM staff row(s)`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}