import type { PortalConfirmCustomerResult } from '@/lib/api';

export function portalCustomerListHref(phone?: string): string {
  if (!phone?.trim()) return '/crm/customers';
  return `/crm/customers?phone=${encodeURIComponent(phone.trim())}`;
}

export function portalConfirmCustomerMessage(res: PortalConfirmCustomerResult): string {
  const name = res.name?.trim() || 'Khách';
  const phone = res.phone?.trim();
  if (phone) return `Đã chốt đơn — khách ${name} · ${phone}. Xem menu Khách hàng sau khi đơn được xác nhận.`;
  return `Đã chốt đơn cho ${name}. Mở menu Khách hàng khi đơn POS đã xác nhận.`;
}