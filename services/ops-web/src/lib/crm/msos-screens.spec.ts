import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MSOS_UI_DENYLIST } from './msos-empty';

const SCREEN_FILES = [
  'src/components/media-os/MsosCommand.tsx',
  'src/components/media-os/MsosInventory.tsx',
  'src/components/media-os/MsosPackages.tsx',
  'src/components/media-os/MsosCampaigns.tsx',
  'src/components/media-os/MsosEvidence.tsx',
  'src/components/media-os/MsosOutcomes.tsx',
  'src/components/media-os/MsosMargin.tsx',
  'src/components/media-os/MsosGovernance.tsx',
] as const;

describe('MSOS screen components denylist', () => {
  for (const file of SCREEN_FILES) {
    it(`${file} has no demo ids`, () => {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      for (const n of MSOS_UI_DENYLIST) {
        expect(src).not.toContain(n);
      }
    });
  }
});
