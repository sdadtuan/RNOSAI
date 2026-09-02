import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdChatAccountsService } from './csd-chat-accounts.service';
import { CsdChatFriendsRepository } from './csd-chat-friends.repository';
import { CsdNotificationsRepository } from './csd-notifications.repository';
import type {
  CsdActor,
  CsdChatFriendshipRow,
  CsdChatPersonRow,
} from './csd.types';

function pairIds(a: number, b: number): { lo: number; hi: number } {
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

function hasCsdCap(actor: CsdActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'csd' && c.action === action);
}

function isParticipant(row: CsdChatFriendshipRow, staffId: number): boolean {
  return row.requester_staff_id === staffId || row.addressee_staff_id === staffId;
}

@Injectable()
export class CsdChatFriendsService {
  constructor(
    private readonly repo: CsdChatFriendsRepository,
    private readonly accounts: CsdChatAccountsService,
    private readonly notifications: CsdNotificationsRepository,
  ) {}

  async listFriends(actor: CsdActor): Promise<{ items: CsdChatPersonRow[] }> {
    await this.accounts.assertEnabled(actor);
    const items = await this.repo.listAcceptedPeople(actor.staffId);
    return { items };
  }

  async listRequests(
    actor: CsdActor,
  ): Promise<{ incoming: CsdChatFriendshipRow[]; outgoing: CsdChatFriendshipRow[] }> {
    await this.accounts.assertEnabled(actor);
    const [incoming, outgoing] = await Promise.all([
      this.repo.listPendingIncoming(actor.staffId),
      this.repo.listPendingOutgoing(actor.staffId),
    ]);
    return { incoming, outgoing };
  }

  async searchPeople(actor: CsdActor, q: string): Promise<{ items: CsdChatPersonRow[] }> {
    await this.accounts.assertEnabled(actor);
    if (q.trim().length < 2) return { items: [] };
    const [people, peers] = await Promise.all([
      this.accounts.searchPeople(actor.staffId, q),
      this.repo.listPeerStaffIds(actor.staffId),
    ]);
    const hide = new Set(peers);
    return { items: people.filter((p) => !hide.has(p.staff_id)) };
  }

  async request(actor: CsdActor, staffId: number): Promise<CsdChatFriendshipRow> {
    await this.accounts.assertEnabled(actor);
    const target = Number(staffId);
    if (!Number.isInteger(target) || target <= 0) {
      throw new BadRequestException({ error: 'staff_id_required' });
    }
    if (target === actor.staffId) {
      throw new BadRequestException({ error: 'cannot_friend_self' });
    }
    const enabled = await this.accounts.isEnabled(target);
    if (!enabled) {
      throw new NotFoundException({ error: 'chat_account_not_found' });
    }
    const { lo, hi } = pairIds(actor.staffId, target);
    const existing = await this.repo.findPair(lo, hi);
    if (existing) {
      throw new ConflictException({ error: 'friendship_exists' });
    }
    const row = await this.repo.insertPending({
      staff_lo: lo,
      staff_hi: hi,
      requester_staff_id: actor.staffId,
      addressee_staff_id: target,
    });
    await this.notifications.insert({
      staff_id: target,
      event_key: 'chat_friend_request',
      title_vi: 'Lời mời kết bạn',
      body_vi: actor.staffLabel,
      entity_type: 'chat_friendship',
      entity_id: row.id,
    });
    return row;
  }

  async accept(actor: CsdActor, id: string): Promise<CsdChatFriendshipRow> {
    await this.accounts.assertEnabled(actor);
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException({ error: 'friendship_not_found' });
    if (row.status !== 'pending' || row.addressee_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'friendship_forbidden' });
    }
    return this.repo.setStatus(id, 'accepted');
  }

  async reject(actor: CsdActor, id: string): Promise<{ deleted: true }> {
    await this.accounts.assertEnabled(actor);
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException({ error: 'friendship_not_found' });
    if (row.status !== 'pending' || row.addressee_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'friendship_forbidden' });
    }
    await this.repo.deleteById(id);
    return { deleted: true };
  }

  async remove(actor: CsdActor, id: string): Promise<{ deleted: true }> {
    await this.accounts.assertEnabled(actor);
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException({ error: 'friendship_not_found' });
    const canDeletePending = row.status === 'pending' && row.requester_staff_id === actor.staffId;
    const canUnfriend = row.status === 'accepted' && isParticipant(row, actor.staffId);
    if (!canDeletePending && !canUnfriend) {
      throw new ForbiddenException({ error: 'friendship_forbidden' });
    }
    await this.repo.deleteById(id);
    return { deleted: true };
  }

  async block(actor: CsdActor, id: string): Promise<CsdChatFriendshipRow> {
    await this.accounts.assertEnabled(actor);
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException({ error: 'friendship_not_found' });
    if (!isParticipant(row, actor.staffId)) {
      throw new ForbiddenException({ error: 'friendship_forbidden' });
    }
    const other =
      row.requester_staff_id === actor.staffId ? row.addressee_staff_id : row.requester_staff_id;
    return this.repo.setBlocked(id, actor.staffId, other);
  }

  async isAccepted(a: number, b: number): Promise<boolean> {
    const { lo, hi } = pairIds(a, b);
    const row = await this.repo.findPair(lo, hi);
    return row?.status === 'accepted';
  }

  async adminRemove(admin: CsdActor, friendshipId: string): Promise<{ deleted: true }> {
    if (!hasCsdCap(admin, 'admin')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'csd', action: 'admin' });
    }
    const row = await this.repo.findById(friendshipId);
    if (!row) throw new NotFoundException({ error: 'friendship_not_found' });
    await this.repo.deleteById(friendshipId);
    return { deleted: true };
  }
}
