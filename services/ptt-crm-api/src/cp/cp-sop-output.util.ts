interface CpSopOutputQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export function parseVdProjectId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number <= 0 || !Number.isInteger(number)) return null;
  return number;
}

export function resolveConfiguredSopOutputUri(
  config: Record<string, unknown>,
): string | null {
  const uri = String(config.output_uri ?? config.sop_output_uri ?? '').trim();
  return uri || null;
}

export async function resolveLinkedVdProjectId(
  db: CpSopOutputQueryPort,
  draftId: string,
  config: Record<string, unknown>,
): Promise<number | null> {
  const fromConfig = parseVdProjectId(config.vd_project_id ?? config.sop_project_id);
  if (fromConfig) return fromConfig;

  try {
    const linked = await db.query(
      `SELECT vd_project_id
         FROM crm_cp_deliverables
        WHERE video_draft_id = $1::uuid
          AND vd_project_id IS NOT NULL
          AND vd_project_id <> ''
        ORDER BY created_at DESC
        LIMIT 1`,
      [draftId],
    );
    return parseVdProjectId(linked.rows[0]?.vd_project_id);
  } catch {
    return null;
  }
}

export async function resolveSopMasterOutputUri(
  db: CpSopOutputQueryPort,
  vdProjectId: number,
): Promise<string | null> {
  try {
    const result = await db.query(
      `SELECT url, storage_key
         FROM vd_assets
        WHERE project_id = $1
          AND kind = 'master'
        ORDER BY id DESC
        LIMIT 1`,
      [vdProjectId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const url = String(row.url ?? '').trim();
    if (url) return url;
    const storageKey = String(row.storage_key ?? '').trim();
    if (storageKey) {
      if (storageKey.startsWith('sop://') || storageKey.startsWith('file://')
        || storageKey.startsWith('http://') || storageKey.startsWith('https://')
        || storageKey.startsWith('s3://')) {
        return storageKey;
      }
      return `sop://vd/${vdProjectId}/master`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveSopOutputUri(
  db: CpSopOutputQueryPort,
  draftId: string,
  config: Record<string, unknown>,
): Promise<{ vdProjectId: number | null; outputUri: string | null }> {
  const configured = resolveConfiguredSopOutputUri(config);
  const vdProjectId = await resolveLinkedVdProjectId(db, draftId, config);
  if (configured) {
    return { vdProjectId, outputUri: configured };
  }
  if (!vdProjectId) {
    return { vdProjectId: null, outputUri: null };
  }
  const outputUri = await resolveSopMasterOutputUri(db, vdProjectId);
  return { vdProjectId, outputUri };
}
