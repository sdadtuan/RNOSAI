import { staffIdsAcceptingIntake } from './ae-team.util';

export async function loadPausedIntakeStaffIds(
  query: (sql: string) => Promise<{ rows: Array<{ staff_id?: number }> }>,
): Promise<Set<number>> {
  try {
    const result = await query(`SELECT staff_id FROM crm_ae_intake WHERE accepting IS FALSE`);
    return new Set(result.rows.map((row) => Number(row.staff_id)).filter((id) => id > 0));
  } catch {
    return new Set();
  }
}
