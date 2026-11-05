import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLeadVideoLaunchable, evaluateLeadVideoPack, type LeadVideoFileFacts } from './ptt-fb-lead-video-qc.util';

const examplePath = resolve(__dirname, '../../../../docs/creative/ptt-fb-lead/qc-facts.example.json');
const envPath = process.env.PTT_LEAD_QC_FACTS;
const factsPath = envPath ?? examplePath;

describe('optional pack facts', () => {
  it('example fixture is launchable without H1-30 required', () => {
    if (envPath) {
      if (!existsSync(envPath)) {
        throw new Error(`PTT_LEAD_QC_FACTS is set but file is missing: ${envPath}`);
      }
    } else if (!existsSync(examplePath)) {
      throw new Error(`qc-facts.example.json is missing: ${examplePath}`);
    }

    const parsed = JSON.parse(readFileSync(factsPath, 'utf8')) as { files: LeadVideoFileFacts[] };
    const pack = evaluateLeadVideoPack(parsed.files);
    if (factsPath.endsWith('qc-facts.example.json')) {
      expect(pack.files.h1.overall).toBe('passed');
      return;
    }
    expect(pack.files.h1.overall).toBe('passed');
    expect(pack.files.h2.overall).toBe('passed');
    expect(pack.files.h3.overall).toBe('passed');
    assertLeadVideoLaunchable(pack, { require_h1_30: false });
  });
});
