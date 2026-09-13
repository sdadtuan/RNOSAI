export const WEAVE_PATH_PATTERN = '{client_code}/{campaign_code}/{task_id}/{lane}/';
export const WEAVE_EMPTY_ORDERS = 'Chưa có Work Order.';
export const WEAVE_HUB_RULE = 'Chỉ review/ và final/ vào Hub. source/ không gửi Hub.';
export const WEAVE_SYNC_ZERO = 'Không ingest file. Kiểm tra path convention.';

export function weaveEmptyCopy(enabled: boolean, orderCount: number): string {
  if (!enabled) return '—';
  if (orderCount <= 0) return WEAVE_EMPTY_ORDERS;
  return '';
}

export function weaveExportPrefix(wo: {
  client_code?: string | null;
  campaign_code?: string | null;
  task_id?: string | null;
} | null): string {
  const client = String(wo?.client_code ?? '').trim();
  const campaign = String(wo?.campaign_code ?? '').trim();
  const task = String(wo?.task_id ?? '').trim();
  if (!client || !campaign || !task) return WEAVE_PATH_PATTERN;
  return `${client}/${campaign}/${task}/{lane}/`;
}

export function weaveSyncNotice(result: {
  ingested: number;
  scanned?: number;
  skipped?: number;
}): string {
  if (result.ingested <= 0) return WEAVE_SYNC_ZERO;
  return `Sync output: ${result.ingested} file`;
}
