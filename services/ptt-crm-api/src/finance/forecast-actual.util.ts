import { Pool } from 'pg';

export async function sumReceivedRevenueForRange(
  pool: Pool,
  start: string,
  end: string,
): Promise<number> {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
    FROM crm_svc_payments
    WHERE status = 'received'
      AND received_on >= $1::date
      AND received_on <= $2::date
    `,
    [start, end],
  );
  return Number(result.rows[0]?.v ?? 0);
}
