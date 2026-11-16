import type { PortalCareCase, PortalCaseDetail, PortalDesk } from '@/lib/api';

type PortalCaseMessage = PortalCaseDetail['messages'][number];

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

/** Desk poll: take the server lists as truth, dropping rows the server no longer returns. Live pushes still use mergeCareCases. */
export function mergeDeskMessages(_prev: PortalDesk, next: PortalDesk): PortalDesk {
  return {
    ...next,
    messages: next.messages,
    leads: next.leads,
    customers: next.customers,
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
