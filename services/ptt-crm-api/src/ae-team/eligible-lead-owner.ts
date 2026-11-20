export const ELIGIBLE_LEAD_OWNER_SQL = `
  s.active IS TRUE
  AND COALESCE(s.can_receive_leads, FALSE) IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM crm_ae_intake i
    WHERE i.staff_id = s.id AND i.accepting IS FALSE
  )
`;

export async function isEligibleLeadOwner(
  query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>,
  staffId: number,
): Promise<boolean> {
  if (!Number.isFinite(staffId) || staffId <= 0) return false;
  const result = await query(
    `SELECT s.id FROM crm_staff s WHERE s.id = $1 AND ${ELIGIBLE_LEAD_OWNER_SQL}`,
    [staffId],
  );
  return result.rows.length > 0;
}

export async function assertEligibleLeadOwner(
  query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>,
  staffId: number,
): Promise<void> {
  if (!(await isEligibleLeadOwner(query, staffId))) {
    throw new Error('Nhân viên này chưa bật nhận lead hoặc đang tạm dừng.');
  }
}
