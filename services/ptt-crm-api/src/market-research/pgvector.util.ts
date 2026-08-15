export function toPgvectorLiteral(values: number[]): string {
  if (!values.length || values.some((n) => !Number.isFinite(n))) {
    throw new Error('invalid_pgvector');
  }
  return `[${values.join(',')}]`;
}

export function shouldUsePgvectorAnn(
  flag: boolean,
  queryVec: number[] | undefined,
): boolean {
  return Boolean(flag && queryVec && queryVec.length > 0);
}
