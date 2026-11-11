import type { PoolClient } from 'pg';
import { IMPLEMENTATION_ACCEPT_MINUTES } from './implementation-handoff.util';

/** Idempotent: create pending MKL implementation case when lead enters Triển khai. */
export async function ensureImplementationHandoffOnTrienKhai(
  client: PoolClient,
  leadId: number,
): Promise<boolean> {
  const updated = await client.query(
    `UPDATE crm_lead_presales
        SET implementation_handoff_status = 'pending',
            implementation_owner_staff_id = NULL,
            implementation_accept_due_at = COALESCE(
              implementation_accept_due_at,
              NOW() + ($2::int * INTERVAL '1 minute')
            ),
            implementation_claimed_at = NULL,
            updated_at = NOW()
      WHERE lead_id = $1
        AND COALESCE(implementation_handoff_status, '') NOT IN ('pending', 'claimed')
        AND implementation_status = 'trien_khai'
      RETURNING id`,
    [leadId, IMPLEMENTATION_ACCEPT_MINUTES],
  );
  if (updated.rowCount) return true;
  const exists = await client.query(
    `SELECT 1 FROM crm_lead_presales
      WHERE lead_id = $1
        AND implementation_status = 'trien_khai'
        AND COALESCE(implementation_handoff_status, '') IN ('pending', 'claimed')
      LIMIT 1`,
    [leadId],
  );
  return (exists.rowCount ?? 0) > 0;
}

export async function notifyMarketingLeadersImplementationHandoff(
  client: PoolClient,
  leadId: number,
  leadName: string,
): Promise<void> {
  const label = leadName.trim() || `Lead #${leadId}`;
  try {
    await client.query(
      `INSERT INTO staff_notifications (user_id, kind, title, body, link_href, meta_json)
       SELECT u.id::uuid,
              'implementation_handoff',
              'Case Triển khai chờ MKL nhận',
              $2,
              '/crm/implementation/queue',
              $3::jsonb
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
         JOIN staff_users u ON lower(trim(u.email)) = lower(trim(s.email))
        WHERE s.active IS TRUE
          AND lower(replace(p.code, ' ', '')) IN ('mkl', 'mkt-01', 'mkt01')`,
      [
        leadId,
        `${label} — nhận case Triển khai trong ${IMPLEMENTATION_ACCEPT_MINUTES} phút.`,
        JSON.stringify({ lead_id: leadId }),
      ],
    );
  } catch {
    /* optional bell */
  }
}
