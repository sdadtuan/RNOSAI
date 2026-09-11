import { readFileSync } from 'fs';
import { join } from 'path';
import { AI_PUBLISH_FORBIDDEN_IMPORTS } from './ai-publish-guard.util';

const GENERATE_FILES = [
  'content-marketing/content-repurpose.service.ts',
  'content-marketing/content-brand-context.service.ts',
  'content-marketing/content-marketing-prompt.util.ts',
  'content-marketing/content-job-worker.service.ts',
];

it('generate services do not import execute or Facebook connector', () => {
  for (const rel of GENERATE_FILES) {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8');
    for (const needle of AI_PUBLISH_FORBIDDEN_IMPORTS) {
      expect(src).not.toContain(needle);
    }
  }
});
