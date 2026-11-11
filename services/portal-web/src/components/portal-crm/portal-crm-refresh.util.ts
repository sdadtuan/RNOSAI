import type { PortalCareCase, PortalCaseMessage, PortalDesk } from '@/lib/api';

export const PORTAL_CRM_DESK_POLL_MS = 12_000;

export function saigonRefreshLabel(at: Date): string {
  return at.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function mergeCareCases(prev: PortalCareCase[], incoming: PortalCareCase[]): PortalCareCase[] {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((row) => [row.id, row]));
  const order: string[] = [];
  for (const row of incoming) {
    if (!byId.has(row.id)) order.push(row.id);
    const old = byId.get(row.id);
    byId.set(row.id, old ? { ...old, ...row } : row);
  }
  for (const row of prev) {
    if (!order.includes(row.id)) order.push(row.id);
  }
  return order.map((id) => byId.get(id)).filter((row): row is PortalCareCase => Boolean(row));
}

export function mergeDeskMessages(prev: PortalDesk, next: PortalDesk): PortalDesk {
  return {
    ...next,
    messages: mergeCareCases(prev.messages, next.messages),
    leads: mergeCareCases(prev.leads, next.leads),
    customers: mergeCareCases(prev.customers, next.customers),
  };
}

export function mergeCaseMessages(prev: PortalCaseMessage[], incoming: PortalCaseMessage[]): PortalCaseMessage[] {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((row) => [row.id, row]));
  const order: string[] = [];
  for (const row of incoming) {
    if (!byId.has(row.id)) order.push(row.id);
    byId.set(row.id, row);
  }
  for (const row of prev) {
    if (!order.includes(row.id)) order.push(row.id);
  }
  return order.map((id) => byId.get(id)).filter((row): row is PortalCaseMessage => Boolean(row));
}
