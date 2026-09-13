import * as path from 'path';
import { resolveWeaveStreamAbs } from './cp-weave-stream-path.util';

const PREFIX = '/var/www/rnosai/data/cp-weave-export';
const REVIEW_KEY = 'ptt-hcm/meta-lead-gen/CR-2026-0913-001/review/CR-2026-0913-001_v01_9x16.mp4';
const FINAL_KEY = 'ptt-hcm/meta-lead-gen/CR-2026-0913-001/final/CR-2026-0913-001_v01_9x16.mp4';

describe('resolveWeaveStreamAbs', () => {
  it('resolves review and final keys inside the export prefix', () => {
    expect(resolveWeaveStreamAbs(PREFIX, REVIEW_KEY)).toBe(
      path.resolve(PREFIX, REVIEW_KEY),
    );
    expect(resolveWeaveStreamAbs(PREFIX, FINAL_KEY)).toBe(
      path.resolve(PREFIX, FINAL_KEY),
    );
  });

  it('rejects source, drafts, and approved lanes', () => {
    expect(resolveWeaveStreamAbs(
      PREFIX,
      'ptt-hcm/meta-lead-gen/CR-2026-0913-001/source/CR-2026-0913-001_v01_9x16.mp4',
    )).toBeNull();
    expect(resolveWeaveStreamAbs(
      PREFIX,
      'ptt-hcm/meta-lead-gen/CR-2026-0913-001/drafts/CR-2026-0913-001_v01_9x16.mp4',
    )).toBeNull();
    expect(resolveWeaveStreamAbs(
      PREFIX,
      'ptt-hcm/meta-lead-gen/CR-2026-0913-001/approved/CR-2026-0913-001_v01_9x16.mp4',
    )).toBeNull();
  });

  it('rejects traversal, nested filenames, missing prefix, and invalid keys', () => {
    expect(resolveWeaveStreamAbs(
      PREFIX,
      'ptt-hcm/meta-lead-gen/CR-2026-0913-001/review/../../../../etc/passwd',
    )).toBeNull();
    expect(resolveWeaveStreamAbs(
      PREFIX,
      'ptt-hcm/meta-lead-gen/CR-2026-0913-001/review/nested/CR-2026-0913-001_v01_9x16.mp4',
    )).toBeNull();
    expect(resolveWeaveStreamAbs('', REVIEW_KEY)).toBeNull();
    expect(resolveWeaveStreamAbs(PREFIX, '/etc/passwd')).toBeNull();
    expect(resolveWeaveStreamAbs(PREFIX, 'not-a-weave-key.mp4')).toBeNull();
  });
});
