import { describe, expect, it } from 'vitest';
import { evaluatePublishGate } from './cmkte-publish-gate';
import {
  calendarCollisionNotice,
  canMarkPublished,
  capacityBandLabel,
  claimHighlightSegments,
  criticalPathTaskTitles,
  DEFAULT_CLAIM_LEXEMES,
  firstCalendarCollision,
  itemClaimHits,
  itemGlossaryHits,
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
        brief_json: { audience: 'CMO', goal: 'Lead', destination_url: 'https://example.com/post' },
      }),
    );
    expect(flags).not.toHaveProperty('rightsValid');
    expect(flags).not.toHaveProperty('altComplete');
    expect(flags).not.toHaveProperty('versionLocked');
    expect(flags).not.toHaveProperty('accountHealthy');
    expect(evaluatePublishGate(flags).status).toBe('Pass');
  });

  it('consumes server publish_gate fields instead of a non-empty brief or client URL regex', () => {
    const flags = publishGateFlagsFromItem(
      item({
        status: 'draft',
        brief_json: { hook: 'only' },
        brief_ready: false,
        publish_gate: {
          briefReady: true,
          internalApproved: true,
          legalRequired: false,
          legalApproved: false,
          clientApproved: true,
          urlOk: true,
          paidExpiryWarning: true,
        },
      }),
    );
    expect(flags.briefReady).toBe(true);
    expect(flags.urlOk).toBe(true);
    expect(flags.paidExpiryWarning).toBe(true);
    expect(evaluatePublishGate(flags).status).toBe('Warning');
  });

  it('does not treat a hook-only brief as ready when server fields are absent', () => {
    const flags = publishGateFlagsFromItem(
      item({
        status: 'client_approved',
        brief_json: { hook: 'ready', destination_url: 'https://example.com/post' },
      }),
    );
    expect(flags.briefReady).toBe(false);
    expect(evaluatePublishGate(flags).status).toBe('Blocked');
  });

  it('sets rightsValid false when item.rights_valid is false', () => {
    const flags = publishGateFlagsFromItem(
      item({
        status: 'client_approved',
        brief_json: { hook: 'ready', destination_url: 'https://example.com/post' },
        rights_valid: false,
      }),
    );
    expect(flags.rightsValid).toBe(false);
    expect(evaluatePublishGate(flags).status).toBe('Blocked');
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

  // E1 UAT: Rights Invalid → GET rights_valid false → gate Blocked → Mark published disabled.
  it('is false when item.rights_valid is false because the gate is Blocked', () => {
    const flags = publishGateFlagsFromItem(
      item({
        status: 'client_approved',
        brief_json: { hook: 'ready', destination_url: 'https://example.com/post' },
        rights_valid: false,
      }),
    );
    const gate = evaluatePublishGate(flags);
    expect(flags.rightsValid).toBe(false);
    expect(gate.status).toBe('Blocked');
    expect(gate.blockers.map((row) => row.code)).toContain('rights_invalid');
    expect(canMarkPublished(gate.status)).toBe(false);
  });
});

describe('calendar collision notice', () => {
  it('prefers last upsert collision, then listed slots, and does not block publish', () => {
    expect(firstCalendarCollision([])).toBeNull();
    expect(
      firstCalendarCollision([{ collision: { item_id: 12, at: '2026-09-11T11:30:00.000Z' } }]),
    ).toEqual({ item_id: 12, at: '2026-09-11T11:30:00.000Z' });
    expect(
      firstCalendarCollision(
        [{ collision: { item_id: 9, at: '2026-09-11T08:00:00.000Z' } }],
        { collision: { item_id: 12, at: '2026-09-11T11:30:00.000Z' } },
      ),
    ).toEqual({ item_id: 12, at: '2026-09-11T11:30:00.000Z' });
    expect(canMarkPublished('Pass', 'scheduled')).toBe(true);
    expect(calendarCollisionNotice({ item_id: 12, at: '2026-09-11T11:30:00.000Z' })).toContain(
      'Cảnh báo trùng lịch',
    );
    expect(calendarCollisionNotice(null)).toBeNull();
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

describe('capacityBandLabel', () => {
  it('shows threshold copy only when pct is a number', () => {
    expect(capacityBandLabel(null, 'overloaded')).toBeNull();
    expect(capacityBandLabel(50, 'ok')).toBeNull();
    expect(capacityBandLabel(80, 'warning')).toBe('Cảnh báo');
    expect(capacityBandLabel(90, 'at_risk')).toBe('At risk');
    expect(capacityBandLabel(120, 'overloaded')).toBe('Quá tải');
  });
});

describe('criticalPathTaskTitles', () => {
  it('maps critical_path_task_ids to titles and stays empty for —', () => {
    expect(criticalPathTaskTitles(item({}))).toEqual([]);
    expect(
      criticalPathTaskTitles(
        item({
          critical_path_task_ids: ['a', 'b'],
          production_json: {
            tasks: [
              { id: 'a', title: 'Write' },
              { id: 'b', title: 'Design' },
              { id: 'c', title: 'Side' },
            ],
          },
        }),
      ),
    ).toEqual(['Write', 'Design']);
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

describe('glossary highlight FR-COPY-012', () => {
  it('uses API glossary_hits and invents no sample terms when empty', () => {
    expect(itemGlossaryHits(item({}))).toEqual([]);
    expect(itemGlossaryHits(item({ body_json: { markdown: 'CTA đăng ký nhận tư vấn' } }))).toEqual([]);
    expect(itemGlossaryHits(item({ glossary_hits: ['đăng ký nhận tư vấn'] }))).toEqual([
      'đăng ký nhận tư vấn',
    ]);
  });

  it('highlights glossary terms found in copy', () => {
    const segs = claimHighlightSegments('CTA: đăng ký nhận tư vấn hôm nay', ['đăng ký nhận tư vấn']);
    expect(segs).toEqual([
      { text: 'CTA: ', hit: false },
      { text: 'đăng ký nhận tư vấn', hit: true },
      { text: ' hôm nay', hit: false },
    ]);
  });

  it('does not invent another brand or locale hit on the client', () => {
    expect(
      itemGlossaryHits(
        item({
          brief_json: { brand_id: 'brand-4', locale: 'vi' },
          body_json: { markdown: 'CTA: đăng ký nhận tư vấn other-brand' },
          glossary_hits: ['đăng ký nhận tư vấn'],
        }),
      ),
    ).toEqual(['đăng ký nhận tư vấn']);
    expect(
      itemGlossaryHits(
        item({
          brief_json: {},
          body_json: { markdown: 'CTA: đăng ký nhận tư vấn' },
        }),
      ),
    ).toEqual([]);
  });
});
