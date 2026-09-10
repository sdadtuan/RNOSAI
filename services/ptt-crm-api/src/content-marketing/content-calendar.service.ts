import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  assertTransition,
  scheduleFromStatuses,
} from './content-workflow.util';
import type {
  CmktCalendarSlotRow,
  CmktItemRow,
  CmktPublicationCollision,
} from './content-marketing.types';

const COLLISION_WINDOW_MS = 2 * 60 * 60 * 1000;

type CollisionCandidate = {
  item_id: number;
  scheduled_at: string;
  channel: string;
  pillar_id: number | null;
};

function collisionWindow(scheduledAt: string): { from: string; to: string } {
  const t = new Date(scheduledAt).getTime();
  return {
    from: new Date(t - COLLISION_WINDOW_MS).toISOString(),
    to: new Date(t + COLLISION_WINDOW_MS).toISOString(),
  };
}

function withinTwoHours(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= COLLISION_WINDOW_MS;
}

export function pickPublicationCollision(
  candidate: CollisionCandidate,
  others: CollisionCandidate[],
): CmktPublicationCollision | null {
  for (const other of others) {
    if (other.item_id === candidate.item_id) continue;
    if (other.channel !== candidate.channel) continue;
    if (!withinTwoHours(candidate.scheduled_at, other.scheduled_at)) continue;
    if (candidate.pillar_id != null && other.pillar_id != null && candidate.pillar_id !== other.pillar_id) {
      continue;
    }
    return { item_id: other.item_id, at: other.scheduled_at };
  }
  return null;
}

@Injectable()
export class ContentCalendarService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listCalendar(
    lifecycleId: number,
    query: { from?: string; to?: string },
  ): Promise<{ slots: CmktCalendarSlotRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const slots = await this.repo.listCalendarSlots(lifecycleId, {
      from: query.from,
      to: query.to,
    });
    const items = await Promise.all(slots.map((slot) => this.repo.getItemById(lifecycleId, slot.item_id)));
    const pillars = await Promise.all(items.map((row) => this.resolvePillarId(lifecycleId, row)));
    const candidates: CollisionCandidate[] = slots.map((slot, idx) => ({
      item_id: slot.item_id,
      scheduled_at: slot.scheduled_at,
      channel: items[idx]?.channel ?? '',
      pillar_id: pillars[idx] ?? null,
    }));
    const enriched = slots.map((slot, idx) => ({
      ...slot,
      item: items[idx] ?? undefined,
      collision: pickPublicationCollision(candidates[idx], candidates),
    }));
    return { slots: enriched };
  }

  async upsertSlot(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ slot: CmktCalendarSlotRow; item: CmktItemRow; collision: CmktPublicationCollision | null }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(
      item.status,
      scheduleFromStatuses(this.config.contentMarketingClientGate),
      'schedule',
    );

    const scheduledAt = String(body.scheduled_at ?? '').trim();
    if (!scheduledAt) {
      throw new BadRequestException({ error: 'scheduled_at_required' });
    }

    const collision = await this.findCollision(lifecycleId, {
      item_id: itemId,
      scheduled_at: scheduledAt,
      channel: item.channel,
      pillar_id: await this.resolvePillarId(lifecycleId, item),
    });

    const slot = await this.repo.upsertCalendarSlot({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      scheduled_at: scheduledAt,
      timezone: body.timezone != null ? String(body.timezone) : undefined,
    });

    const updated = await this.repo.patchItem(lifecycleId, itemId, { status: 'scheduled' });
    await this.repo.insertItemVersion(updated.id, updated.body_json, actorEmail, 'schedule');

    return { slot, item: updated, collision };
  }

  async deleteSlot(lifecycleId: number, itemId: number): Promise<{ ok: boolean }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const deleted = await this.repo.deleteCalendarSlot(lifecycleId, itemId);
    if (!deleted) throw new NotFoundException({ error: 'calendar_slot_not_found', item_id: itemId });
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (item?.status === 'scheduled') {
      const revertStatus = this.config.contentMarketingClientGate ? 'client_approved' : 'approved_internal';
      await this.repo.patchItem(lifecycleId, itemId, { status: revertStatus });
    }
    return { ok: true };
  }

  private async findCollision(
    lifecycleId: number,
    candidate: CollisionCandidate,
  ): Promise<CmktPublicationCollision | null> {
    const window = collisionWindow(candidate.scheduled_at);
    const nearby = await this.repo.listCalendarSlots(lifecycleId, window);
    const others: CollisionCandidate[] = [];
    for (const slot of nearby) {
      if (slot.item_id === candidate.item_id) continue;
      const other = await this.repo.getItemById(lifecycleId, slot.item_id);
      if (!other) continue;
      others.push({
        item_id: slot.item_id,
        scheduled_at: slot.scheduled_at,
        channel: other.channel,
        pillar_id: await this.resolvePillarId(lifecycleId, other),
      });
    }
    return pickPublicationCollision(candidate, others);
  }

  /** Item has no pillar_id column; pillar is idea_id → cmkt_content_ideas.pillar_id when present. */
  private async resolvePillarId(lifecycleId: number, item: CmktItemRow | null): Promise<number | null> {
    if (item?.idea_id == null) return null;
    const idea = await this.repo.getIdeaById(lifecycleId, item.idea_id);
    return idea?.pillar_id ?? null;
  }
}
