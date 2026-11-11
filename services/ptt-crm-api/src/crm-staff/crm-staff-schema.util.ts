import type { Pool, PoolClient } from 'pg';

type Db = Pool | PoolClient;

/** Ensure optional receive-queue flags exist on crm_staff. Safe to call repeatedly. */
export async function ensureCrmStaffReceiveColumns(db: Db): Promise<void> {
  await db.query(
    `ALTER TABLE crm_staff
     ADD COLUMN IF NOT EXISTS can_receive_solution BOOLEAN NOT NULL DEFAULT FALSE`,
  );
}
