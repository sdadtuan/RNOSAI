export function isRevopsShellEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REVOPS_SHELL === '1';
}

export function isRevopsRouteCatalogEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG === '1'
  );
}
