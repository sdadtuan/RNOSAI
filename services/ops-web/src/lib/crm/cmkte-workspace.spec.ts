import { describe, expect, it } from 'vitest';
import { evaluatePublishGate } from './cmkte-publish-gate';
import {
  canMarkPublished,
  claimHighlightSegments,
  DEFAULT_CLAIM_LEXEMES,
  itemClaimHits,
  itemMediaUrls,
  publishGateFlagsFromItem,
  rejectCommentValid,
} from './cmkte-workspace';
import type { ContentOsItem } from '@/lib/content-os-api';

function item(partial: Partial<ContentOsItem>): ContentOsItem {
  return {
    id: 21,
    lifecycle_id: 4,
    idea_id: null,
    title: 'Master',
    format: 'social_post',
    channel: 'facebook',
    funnel_goal: '',
    status: 'draft',
    brief_json: {},
    body_json: {},
    selected_variant_idx: null,
    created_by: '',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('publishGateFlagsFromItem', () => {
  it('reaches Pass when brief, internal, and client are ready without inventing E1 flags', () => {
    const flags = publishGateFlagsFromItem(
      item({
        status: 'client_approved',
        brief_json: { hook: 'ready', destination_url: 'https://example.com/post' },
      }),
    );
    expect(flags).not.toHaveProperty('rightsValid');
    expect(flags).not.toHaveProperty('altComplete');
    expect(flags).not.toHaveProperty('versionLocked');
    expect(flags).not.toHaveProperty('accountHealthy');
    expect(evaluatePublishGate(flags).status).toBe('Pass');
  });

  it('ignores brief_json.publish_gate so write-cap cannot stuff Pass', () => {
    const flags = publishGateFlagsFromItem(
      item({
        status: 'draft',
        brief_json: {
          publish_gate: {
            briefReady: true,
            internalApproved: true,
            legalRequired: false,
            legalApproved: true,
            rightsValid: true,
            altComplete: true,
            clientApproved: true,
            urlOk: true,
            versionLocked: true,
            accountHealthy: true,
          },
        },
      }),
    );
    const gate = evaluatePublishGate(flags);
    expect(gate.status).toBe('Blocked');
    expect(gate.blockers.map((row) => row.code)).toEqual(
      expect.arrayContaining(['internal_approval', 'client_approval']),
    );
  });
});

describe('canMarkPublished', () => {
  it('allows Mark published only when gate is Pass', () => {
    expect(canMarkPublished('Pass')).toBe(true);
    expect(canMarkPublished('Warning')).toBe(false);
    expect(canMarkPublished('Blocked')).toBe(false);
    expect(canMarkPublished('Pass', 'published')).toBe(false);
  });
});

describe('itemMediaUrls', () => {
  it('collects production and media urls without inventing assets', () => {
    expect(itemMediaUrls(item({}))).toEqual([]);
    expect(
      itemMediaUrls(
        item({
          production_json: { asset_urls: ['https://cdn.example/a.jpg', ''] },
          media_json: {
            ai_assets: [{ url: 'https://cdn.example/b.jpg' }],
            carousel_slides: [{ url: 'https://cdn.example/c.jpg' }],
            video_short: { url: 'https://cdn.example/d.mp4' },
          },
        }),
      ),
    ).toEqual([
      'https://cdn.example/a.jpg',
      'https://cdn.example/b.jpg',
      'https://cdn.example/c.jpg',
      'https://cdn.example/d.mp4',
    ]);
  });
});

describe('rejectCommentValid', () => {
  it('requires at least 10 characters', () => {
    expect(rejectCommentValid('short')).toBe(false);
    expect(rejectCommentValid('1234567890')).toBe(true);
  });
});

describe('claim highlight', () => {
  it('uses E1 default lexemes and prefers API claim_hits', () => {
    expect(DEFAULT_CLAIM_LEXEMES).toEqual(['cam kết sinh lời', 'giá rẻ', 'số 1']);
    expect(itemClaimHits(item({ claim_hits: ['giá rẻ'] }))).toEqual(['giá rẻ']);
    expect(
      itemClaimHits(item({ body_json: { markdown: 'Chúng tôi là Số 1' } })),
    ).toEqual(['số 1']);
  });

  it('wraps matched lexemes as hit segments', () => {
    const segs = claimHighlightSegments('Gói giá rẻ hôm nay', ['giá rẻ']);
    expect(segs).toEqual([
      { text: 'Gói ', hit: false },
      { text: 'giá rẻ', hit: true },
      { text: ' hôm nay', hit: false },
    ]);
  });
});
