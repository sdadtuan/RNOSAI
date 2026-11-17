/** Position codes that mean Giám đốc kinh doanh. The role stays; notifications are redirected. */
export function isGdkdPositionCode(code: string | null | undefined): boolean {
  const normalized = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]/g, '');
  return (
    normalized === 'gdkd' ||
    normalized === 'gdkd-01' ||
    normalized === 'gdkd01' ||
    normalized === 'gd-kd' ||
    normalized === 'giamdockinhdoanh' ||
    normalized === 'sales-director' ||
    normalized === 'salesdirector'
  );
}
