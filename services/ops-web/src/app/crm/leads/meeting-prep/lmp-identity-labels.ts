import type { LmpDiscoverSource } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';

export function discoverSourceLabelVi(source: LmpDiscoverSource | null | undefined): string {
  switch (source) {
    case 'auto':
      return 'AI tự tìm';
    case 'am_manual':
      return 'AM nhập tay';
    case 'am_confirmed':
      return 'AM xác nhận';
    case 'ingest':
      return 'Form ingest';
    default:
      return 'Chưa xác định';
  }
}
