import { describe, expect, it } from 'vitest';
import { INTEL_EMPTY, INTEL_LOAD_ERROR, insightEmptyCopy } from '@/components/content-os/cmkte/CmktEIntelligence';
import { pctLabel } from './cmkte-workspace';

describe('E2 Command Center capacity label', () => {
  it('renders an em dash when capacity_pct is null and never a fake 78%', () => {
    const label = pctLabel(null);
    expect(label).toBe('—');
    expect(label).not.toContain('78');
    expect(label).not.toMatch(/\d/);
  });

  it('renders a real percent only when capacity_pct is a number', () => {
    expect(pctLabel(50)).toBe('50%');
    expect(pctLabel(0)).toBe('0%');
  });
});

describe('E2 insight load error vs empty', () => {
  it('uses distinct load-error copy instead of INTEL_EMPTY', () => {
    expect(insightEmptyCopy(true)).toBe(INTEL_LOAD_ERROR);
    expect(insightEmptyCopy(true)).not.toBe(INTEL_EMPTY);
    expect(insightEmptyCopy(false)).toBe(INTEL_EMPTY);
  });

  it('renders load-error copy on the Intelligence page when fetch fails', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../../components/content-os/cmkte/CmktEIntelligence.tsx', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(/insightEmptyCopy\(loadError\)/);
  });
});
