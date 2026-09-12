import { createHmac } from 'crypto';
import {
  shouldIngestLane,
  verifyWeaveWebhookSign,
  watermarkForLane,
} from './cp-weave-ingest.util';

describe('cp-weave-ingest.util', () => {
  it('skips unknown lanes and approved by default', () => {
    expect(shouldIngestLane('review', false)).toBe(true);
    expect(shouldIngestLane('final', false)).toBe(true);
    expect(shouldIngestLane('drafts', false)).toBe(false);
    expect(shouldIngestLane('drafts', true)).toBe(true);
    expect(shouldIngestLane('source', false)).toBe(false);
    expect(shouldIngestLane('approved', false)).toBe(false);
  });

  it('watermarks drafts/review only', () => {
    expect(watermarkForLane('drafts')).toBe('DRAFT');
    expect(watermarkForLane('review')).toBe('REVIEW');
    expect(watermarkForLane('final')).toBeNull();
    expect(watermarkForLane('source')).toBeNull();
  });

  it('rejects a bad HMAC and accepts a matching hex digest', () => {
    const secret = 'weave-secret';
    const body = '{"key":"nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4"}';
    const good = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWeaveWebhookSign(body, 'deadbeef', secret)).toBe(false);
    expect(verifyWeaveWebhookSign(body, good, secret)).toBe(true);
    expect(verifyWeaveWebhookSign(body, `sha256=${good}`, secret)).toBe(true);
    expect(verifyWeaveWebhookSign(body, good, '')).toBe(false);
  });
});
