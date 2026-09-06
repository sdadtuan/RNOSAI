import { afterEach, describe, expect, it } from 'vitest';
import { isRevopsRouteCatalogEnabled, isRevopsShellEnabled } from './revops-flags';

describe('revops-flags', () => {
  const prevShell = process.env.NEXT_PUBLIC_REVOPS_SHELL;
  const prevCat = process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG;
  afterEach(() => {
    process.env.NEXT_PUBLIC_REVOPS_SHELL = prevShell;
    process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG = prevCat;
  });
  it('shell false when unset', () => {
    delete process.env.NEXT_PUBLIC_REVOPS_SHELL;
    expect(isRevopsShellEnabled()).toBe(false);
  });
  it('shell true when 1', () => {
    process.env.NEXT_PUBLIC_REVOPS_SHELL = '1';
    expect(isRevopsShellEnabled()).toBe(true);
  });
  it('catalog true in development', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG;
    expect(isRevopsRouteCatalogEnabled()).toBe(true);
    process.env.NODE_ENV = prevEnv;
  });
});
