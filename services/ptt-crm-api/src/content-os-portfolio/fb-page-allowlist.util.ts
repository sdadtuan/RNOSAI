export function parsePageAllowlist(raw?: string): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}
