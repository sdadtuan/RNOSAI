import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertValidChannelFormat } from './content-marketing-channel.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { emptyBodyJson } from './content-marketing.util';
import type { CmktBodyJson, CmktIdeaRow, CmktItemRow } from './content-marketing.types';

@Injectable()
export class ContentItemService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listItems(
    lifecycleId: number,
    filters: { status?: string; format?: string; assignee?: number },
  ): Promise<{ items: CmktItemRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const items = await this.repo.listItems(lifecycleId, filters);
    return { items };
  }

  async getItem(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    return item;
  }

  async createItem(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const channel = String(body.channel ?? '').trim();
    const format = String(body.format ?? '').trim();
    assertValidChannelFormat(channel, format);
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'title_required' });
    }
    return this.repo.createItem(lifecycleId, {
      title,
      channel,
      format,
      funnel_goal: String(body.funnel_goal ?? '').trim(),
      idea_id: body.idea_id != null ? Number(body.idea_id) : null,
      brief_json: (body.brief_json as Record<string, unknown>) ?? {},
      body_json: (body.body_json as CmktBodyJson) ?? emptyBodyJson(),
      created_by: actorEmail,
    });
  }

  async createItemFromIdea(
    lifecycleId: number,
    idea: CmktIdeaRow,
    channel: string,
    format: string,
    actorEmail: string,
    opts?: { title?: string },
  ): Promise<CmktItemRow> {
    assertValidChannelFormat(channel, format);
    return this.repo.createItem(lifecycleId, {
      title: opts?.title?.trim() || idea.title,
      channel,
      format,
      funnel_goal: idea.target_goal,
      idea_id: idea.id,
      brief_json: { hook: idea.hook, ...(idea.meta_json ?? {}) },
      body_json: emptyBodyJson(),
      created_by: actorEmail,
    });
  }

  async patchItem(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (existing.status === 'published' || existing.status === 'archived') {
      throw new BadRequestException({ error: 'item_locked', status: existing.status });
    }

    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = String(body.title).trim();
    if (body.funnel_goal != null) patch.funnel_goal = String(body.funnel_goal).trim();
    if (body.brief_json != null) patch.brief_json = body.brief_json;
    if (body.selected_variant_idx != null) {
      patch.selected_variant_idx = Number(body.selected_variant_idx);
    }
    if (body.channel != null || body.format != null) {
      const channel = String(body.channel ?? existing.channel);
      const format = String(body.format ?? existing.format);
      assertValidChannelFormat(channel, format);
      patch.channel = channel;
      patch.format = format;
    }

    let versionReason: string | null = null;
    if (body.body_json != null) {
      patch.body_json = body.body_json as CmktBodyJson;
      versionReason = 'manual';
    }

    const updated = await this.repo.patchItem(lifecycleId, itemId, patch);
    if (versionReason) {
      await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, versionReason);
    }
    return updated;
  }
}
