import { BadRequestException } from '@nestjs/common';
import {
  assertProductionGateForPublish,
  defaultProductionPhase,
  itemNeedsProduction,
  mergeProductionJson,
} from './content-production.util';
import type { CmktItemRow } from './content-marketing.types';

const item = (patch: Partial<CmktItemRow>): CmktItemRow =>
  ({
    id: 1,
    lifecycle_id: 1,
    idea_id: null,
    parent_item_id: null,
    title: 'Carousel',
    format: 'carousel',
    channel: 'facebook',
    funnel_goal: '',
    status: 'approved_internal',
    assignee_sp: null,
    assignee_qa: null,
    brief_json: {},
    body_json: { markdown: 'slides' },
    selected_variant_idx: null,
    quality_score_json: {},
    seo_bridge_id: null,
    email_bridge_id: null,
    production_json: { phase: 'awaiting_design' },
    visual_status: 'not_needed',
    media_json: {},
    published_url: null,
    published_at: null,
    due_at: null,
    in_review_at: null,
    created_by: 't',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...patch,
  }) as CmktItemRow;

describe('content-production.util', () => {
  it('detects carousel needs production', () => {
    expect(itemNeedsProduction(item({}))).toBe(true);
    expect(defaultProductionPhase(item({}))).toBe('awaiting_design');
  });

  it('blocks publish when production not done', () => {
    expect(() => assertProductionGateForPublish(item({}))).toThrow(BadRequestException);
    expect(() =>
      assertProductionGateForPublish(item({ production_json: { phase: 'done' } })),
    ).not.toThrow();
  });

  it('skips production gate when carousel visual approved', () => {
    expect(() =>
      assertProductionGateForPublish(
        item({ format: 'carousel', production_json: { phase: 'awaiting_design' }, visual_status: 'approved' }),
      ),
    ).not.toThrow();
  });

  it('merges production patch', () => {
    const merged = mergeProductionJson({ phase: 'none' }, {
      phase: 'done',
      asset_urls: ['https://cdn/a.pdf'],
      effort_h: 20,
      tasks: [{ id: 'a', title: 'Write', assignee_id: 1, raci: { r: 'sp', a: 'am' }, depends_on: [], sla_h: 8, effort_h: 5, status: 'todo', started_at: '2026-09-11T00:00:00.000Z' }],
    });
    expect(merged.phase).toBe('done');
    expect(merged.asset_urls).toEqual(['https://cdn/a.pdf']);
    expect(merged.effort_h).toBe(20);
    expect(merged.tasks?.[0]?.id).toBe('a');
    expect(merged.tasks?.[0]?.started_at).toBe('2026-09-11T00:00:00.000Z');
  });

  it('persists a valid empty tasks array', () => {
    expect(mergeProductionJson({ phase: 'none' }, { tasks: [] }).tasks).toEqual([]);
  });

  it('rejects a non-array tasks value', () => {
    expect(() => mergeProductionJson({}, { tasks: { id: 'a' } })).toThrow(BadRequestException);
  });

  it('rejects a task that is missing required CmktETask fields', () => {
    expect(() => mergeProductionJson({}, { tasks: [{ id: 'a' }] })).toThrow(BadRequestException);
  });

  it('rejects malformed CmktETask field types', () => {
    const valid = {
      id: 'a',
      title: 'Write',
      assignee_id: 1,
      raci: { r: 'sp', a: 'am' },
      depends_on: [],
      sla_h: 8,
      effort_h: 5,
      status: 'todo' as const,
    };
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, status: 'shipped' }] })).toThrow(
      BadRequestException,
    );
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, raci: { r: 'sp' } }] })).toThrow(
      BadRequestException,
    );
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, effort_h: 'x' }] })).toThrow(
      BadRequestException,
    );
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, sla_h: Number.NaN }] })).toThrow(
      BadRequestException,
    );
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, depends_on: 'a' }] })).toThrow(
      BadRequestException,
    );
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, assignee_id: '1' }] })).toThrow(
      BadRequestException,
    );
    expect(() => mergeProductionJson({}, { tasks: [{ ...valid, id: '' }] })).toThrow(BadRequestException);
  });

  it('rejects a depends_on cycle as invalid_tasks', () => {
    const valid = {
      title: 'Write',
      assignee_id: 1,
      raci: { r: 'sp', a: 'am' },
      sla_h: 8,
      effort_h: 5,
      status: 'todo' as const,
    };
    try {
      mergeProductionJson(
        {},
        {
          tasks: [
            { ...valid, id: 'x', depends_on: ['y'] },
            { ...valid, id: 'y', depends_on: ['x'] },
          ],
        },
      );
      throw new Error('expected invalid_tasks');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'invalid_tasks' }),
      );
    }
  });
});
