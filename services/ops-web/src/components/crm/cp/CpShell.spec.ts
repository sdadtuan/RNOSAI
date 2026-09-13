import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, 'CpShell.tsx'), 'utf8');

describe('CpShell admin chrome', () => {
  it('mounts StaffPageShell so OpsNav stays on /crm/creative-os', () => {
    expect(src).toContain('StaffPageShell');
    expect(src).toMatch(/width=["']full["']/);
    expect(src).toContain('className={`cp-app cp-root');
  });

  it('does not replace OpsNav with a standalone CP topbar', () => {
    expect(src).not.toContain('cp-topbar');
    expect(src).not.toContain('CP_SEARCH_PLACEHOLDER');
  });
});
