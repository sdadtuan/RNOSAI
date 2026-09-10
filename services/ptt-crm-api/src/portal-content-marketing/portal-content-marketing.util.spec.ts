import type { CmktApprovalPackageRow, CmktItemRow } from '../content-marketing/content-marketing.types';
import {
  stripPortalInternalFields,
  toPortalApprovalPackage,
  toPortalSummaryItem,
} from './portal-content-marketing.util';

function collectJsonKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonKeys(item, keys);
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      collectJsonKeys(nested, keys);
    }
  }
  return keys;
}

function assertNoPromptOrCostKeys(payload: unknown): void {
  const leaked = collectJsonKeys(payload).filter((key) => {
    const lower = key.toLowerCase();
    return lower.includes('prompt') || lower.includes('cost');
  });
  expect(leaked).toEqual([]);
}

function item(partial: Partial<CmktItemRow> = {}): CmktItemRow {
  return {
    id: 7,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Launch post',
    format: 'social_post',
    channel: 'facebook',
    funnel_goal: 'awareness',
    status: 'pending_client',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: {},
    body_json: { markdown: 'body' },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: {},
    visual_status: 'not_needed',
    media_json: {},
    published_url: null,
    published_at: null,
    due_at: null,
    in_review_at: null,
    created_by: 'sp@test.vn',
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T12:00:00.000Z',
    ...partial,
  };
}

function approvalPackage(partial: Partial<CmktApprovalPackageRow> = {}): CmktApprovalPackageRow {
  return {
    id: 11,
    item_id: 7,
    status: 'Sent',
    created_by: 'sp@test.vn',
    created_at: '2026-09-10T11:00:00.000Z',
    snapshot_json: {
      body_json: { markdown: 'Client copy' },
      brief_json: {
        objective: 'Lead gen',
        disclaimer: 'Results vary',
        internal_note: 'do not show client',
        hidden_rule: 'legal-only',
        ai_prompt: 'write like a lawyer',
        cost: 1200,
      },
      media: { selected_asset_id: 'a1', unit_cost: 40 },
      rights: [{ asset_ref: 'https://cdn/a.jpg', license_cost: 99 }],
      disclaimer: 'Results vary',
      system_prompt: 'hidden staff prompt',
    } as CmktApprovalPackageRow['snapshot_json'],
    ...partial,
  };
}

describe('stripPortalInternalFields', () => {
  it('strips internal_note, cost, hidden_rule, and ai_prompt', () => {
    const out = stripPortalInternalFields({
      title: 'Visible',
      internal_note: 'staff only',
      cost: 500,
      hidden_rule: 'secret',
      ai_prompt: 'generate copy',
      status: 'pending_client',
    });

    expect(out).toEqual({ title: 'Visible', status: 'pending_client' });
  });

  it('strips any key whose lowercase name contains prompt or cost', () => {
    const out = stripPortalInternalFields({
      body: 'ok',
      AI_Prompt: 'nope',
      system_prompt: 'nope',
      promptHash: 'nope',
      unitCost: 9,
      COST_USD: 3,
      media_cost_estimate: 1,
    });

    expect(out).toEqual({ body: 'ok' });
  });

  it('recurses into nested objects and arrays without mutating the source', () => {
    const source = {
      title: 'Keep',
      nested: {
        internal_note: 'hide',
        hidden_rule: 'hide',
        copy: 'visible',
        extras: [{ ai_prompt: 'hide', caption: 'ok' }, { cost: 2, url: 'https://cdn/x' }],
      },
    };
    const snapshot = JSON.parse(JSON.stringify(source));

    const out = stripPortalInternalFields(source);

    expect(out).toEqual({
      title: 'Keep',
      nested: {
        copy: 'visible',
        extras: [{ caption: 'ok' }, { url: 'https://cdn/x' }],
      },
    });
    expect(source).toEqual(snapshot);
    expect(source.nested.internal_note).toBe('hide');
    expect(source.nested.extras[0].ai_prompt).toBe('hide');
  });
});

describe('toPortalSummaryItem', () => {
  it('maps the public fields and redacts title PII', () => {
    const out = toPortalSummaryItem(
      item({ title: 'Draft for admin@test.vn' }),
    );

    expect(out).toEqual({
      id: 7,
      title: 'Draft for [email]',
      channel: 'facebook',
      format: 'social_post',
      status: 'pending_client',
      updated_at: '2026-09-10T12:00:00.000Z',
    });
    assertNoPromptOrCostKeys(out);
  });

  it('does not leak extra staff fields from the source item', () => {
    const row = item({
      brief_json: { internal_note: 'staff', ai_prompt: 'secret', objective: 'Lead' },
    });
    const fat = { ...row, cost: 88, hidden_rule: 'x', ai_prompt: 'y' };

    const out = toPortalSummaryItem(fat as CmktItemRow);

    expect(out).not.toHaveProperty('cost');
    expect(out).not.toHaveProperty('hidden_rule');
    expect(out).not.toHaveProperty('ai_prompt');
    expect(out).not.toHaveProperty('brief_json');
    expect(row.brief_json.internal_note).toBe('staff');
    assertNoPromptOrCostKeys(out);
  });
});

describe('toPortalApprovalPackage', () => {
  it('exposes a stripped snapshot so portal package keys never contain prompt or cost', () => {
    const source = approvalPackage();
    const out = toPortalApprovalPackage(source);

    expect(out.id).toBe(11);
    expect(out.status).toBe('Sent');
    expect(out.snapshot_json.brief_json).toEqual({
      objective: 'Lead gen',
      disclaimer: 'Results vary',
    });
    expect(out.snapshot_json.media).toEqual({ selected_asset_id: 'a1' });
    expect(out.snapshot_json.rights).toEqual([{ asset_ref: 'https://cdn/a.jpg' }]);
    expect(out.snapshot_json).not.toHaveProperty('system_prompt');
    expect(source.snapshot_json.brief_json.internal_note).toBe('do not show client');
    expect(source.snapshot_json.brief_json.cost).toBe(1200);
    assertNoPromptOrCostKeys(out);
  });

  it('attaches a stripped package on the portal summary item without mutating staff source', () => {
    const source = approvalPackage();
    const out = toPortalSummaryItem(item(), source);

    expect(out.approval_package?.id).toBe(11);
    expect(out.approval_package?.snapshot_json.brief_json).toEqual({
      objective: 'Lead gen',
      disclaimer: 'Results vary',
    });
    expect(source.snapshot_json.brief_json.ai_prompt).toBe('write like a lawyer');
    assertNoPromptOrCostKeys(out);
  });
});

describe('portal content-marketing payload keys', () => {
  it('walks a full portal summary DTO and finds no prompt or cost keys', () => {
    const pkg = approvalPackage();
    const payload = stripPortalInternalFields({
      ok: true,
      enabled: true,
      lifecycle_id: 1,
      service_slug: 'content-marketing',
      items_by_status: { pending_client: 1 },
      pending_client_count: 1,
      published_mtd: 0,
      pending_items: [toPortalSummaryItem(item(), pkg)],
      staff_content_url: 'http://127.0.0.1:3001/crm/service-delivery/1?tab=content-os',
    });

    assertNoPromptOrCostKeys(payload);
    expect(payload.pending_items[0].title).toBe('Launch post');
  });
});
