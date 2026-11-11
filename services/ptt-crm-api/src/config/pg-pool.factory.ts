import { Pool } from 'pg';

let workerPool: Pool | null = null;

export function isPortalWorkerProcess(): boolean {
  return (process.env.PTT_PROCESS_ROLE ?? '').trim().toLowerCase() === 'portal-worker';
}

/** API process: one pool per repository (unchanged). Worker: a single shared pool (max ~3, statement timeout). */
export function createAppPgPool(connectionString: string): Pool {
  if (!isPortalWorkerProcess()) {
    return new Pool({ connectionString });
  }
  if (!workerPool) {
    const maxRaw = Number(process.env.PTT_DB_POOL_MAX ?? 3);
    const max = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(8, maxRaw) : 3;
    const timeoutRaw = Number(process.env.PTT_DB_STATEMENT_TIMEOUT_MS ?? 15_000);
    const statementTimeout = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15_000;
    workerPool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: statementTimeout,
      query_timeout: statementTimeout,
    });
  }
  return workerPool;
}

export function shouldEndLocalPool(): boolean {
  return !isPortalWorkerProcess();
}
