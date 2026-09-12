import { createHmac } from 'crypto';
import {
  applyWeaveWatermark,
  durationMsFromProbe,
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

  it('never reports duration_ms as 0', () => {
    expect(durationMsFromProbe({ duration_sec: 0 })).toBeNull();
    expect(durationMsFromProbe({ duration_sec: null })).toBeNull();
    expect(durationMsFromProbe({ duration_sec: 1.5 })).toBe(1500);
  });

  it('burns a visible DRAFT overlay onto an image proxy and leaves final unmarked', async () => {
    const sharp = (await import('sharp')).default;
    const source = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 80, b: 160 } },
    }).png().toBuffer();
    const draft = await applyWeaveWatermark(source, 'DRAFT');
    const fin = await applyWeaveWatermark(source, null);
    expect(draft.watermarked).toBe(true);
    expect(fin.watermarked).toBe(false);
    expect(draft.thumb.length).toBeGreaterThan(0);
    expect(draft.proxy.equals(fin.proxy)).toBe(false);
  });
});
