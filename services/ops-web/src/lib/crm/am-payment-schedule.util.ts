export type AmPaymentStatus = 'upcoming' | 'overdue';

export function amPaymentStatusCopy(status: AmPaymentStatus): string {
  if (status === 'overdue') return 'Quá hạn';
  return 'Sắp tới';
}
