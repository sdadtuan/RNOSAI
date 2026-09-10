export type ContentDisplaySeqTable = 'cmkt_content_requests' | 'cmkt_content_items';

export type ContentDisplaySeqQuery = (
  sql: string,
  values: unknown[],
) => Promise<{ rows: Array<{ seq?: unknown }> }>;

/** Shared CNT/CR MAX+1 — used by portfolio and marketing item seq. */
export async function nextDisplaySeq(
  query: ContentDisplaySeqQuery,
  zeroCode: string,
  table: ContentDisplaySeqTable = 'cmkt_content_requests',
): Promise<number> {
  const prefix = zeroCode.slice(0, -3);
  const res = await query(
    `SELECT COALESCE(MAX(CAST(split_part(display_code, '-', 3) AS INT)), 0) + 1 AS seq
     FROM ${table}
     WHERE display_code LIKE $1`,
    [`${prefix}%`],
  );
  return Number(res.rows[0]?.seq ?? 1);
}
