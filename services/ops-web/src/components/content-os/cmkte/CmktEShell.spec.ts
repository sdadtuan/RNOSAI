import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, 'CmktEShell.tsx'), 'utf8');

describe('CmktEShell admin chrome', () => {
  it('mounts StaffPageShell so OpsNav stays on /crm/content-os', () => {
    expect(src).toContain('StaffPageShell');
    expect(src).toMatch(/width=["']full["']/);
    expect(src).toContain('className="cmkte-app cmkte-root"');
  });

  it('does not use standalone full-page topbar logout', () => {
    expect(src).not.toContain('cmkte-top');
    expect(src).not.toContain('cmkte-topav');
  });
});
