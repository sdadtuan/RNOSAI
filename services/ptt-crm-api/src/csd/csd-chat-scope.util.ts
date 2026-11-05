const PREFIXES = [
  '/api/crm/csd/chat',
  '/api/crm/csd/conversations',
  '/api/crm/csd/messages',
  '/api/crm/csd/files',
  '/api/crm/csd/calls',
  '/api/crm/csd/staff',
  '/api/crm/csd/ai/conversations',
  '/api/crm/csd/ai/interactions',
];

export function isChatScopedPath(path: string): boolean {
  const clean = path.split('?')[0];
  return PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}
