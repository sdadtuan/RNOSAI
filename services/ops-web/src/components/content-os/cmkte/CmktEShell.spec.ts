import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(join(__dirname, 'CmktEShell.tsx'), 'utf8');

describe('CmktEShell admin chrome', () => {
  it('mounts StaffPageShell and revops-style cmkte-shell grid', () => {
    expect(src).toContain('StaffPageShell');
    expect(src).toMatch(/width=["']full["']/);
    expect(src).toContain('className="cmkte-shell"');
    expect(src).toContain('className="cmkte-sidebar"');
    expect(src).toContain('className="cmkte-column"');
  });

  it('does not use legacy standalone fixed sidebar wrapper', () => {
    expect(src).not.toContain('cmkte-root');
    expect(src).not.toMatch(/className="cmkte-side"/);
    expect(src).not.toMatch(/className="cmkte-main"/);
  });
});
