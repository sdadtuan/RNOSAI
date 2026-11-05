export const PUBLICATIONS_EMPTY = 'Chưa có lịch xuất bản.';
export const PUBLICATION_QUEUE_CTA = 'Vào queue';

export function canShowPublicationQueueCta(status: string | null | undefined): boolean {
  return status !== 'Blocked';
}

export function formatChannelHealthLabel(status: string | null | undefined): string {
  if (status === 'Manual') return 'Manual';
  if (status === 'TokenExpired') return 'Token expiry';
  if (status === 'Connected') return 'Connected';
  return '—';
}
