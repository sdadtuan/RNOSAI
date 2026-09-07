export type CpBatchSourceIds = {
  clientId?: string;
  lifecycleId?: string;
};

export function isCrmColumnRef(value: string): boolean {
  return /^(clients|service_lifecycle)\./i.test(String(value ?? '').trim());
}

export function buildCpBatchSource(
  mapping: Record<string, string>,
  ids: CpBatchSourceIds = {},
): { type: 'crm'; client_id?: string; lifecycle_id?: string } | undefined {
  const usesCrm = Object.values(mapping).some(isCrmColumnRef);
  if (!usesCrm) return undefined;
  const clientId = String(ids.clientId ?? '').trim();
  const lifecycleId = String(ids.lifecycleId ?? '').trim();
  return {
    type: 'crm',
    client_id: clientId || undefined,
    lifecycle_id: lifecycleId || undefined,
  };
}
