export const PUBLICATIONS_EMPTY = 'Chưa có lịch xuất bản.';
export const PUBLICATION_QUEUE_CTA = 'Vào queue';

export function canShowPublicationQueueCta(status: string | null | undefined): boolean {
  return status !== 'Blocked';
}
