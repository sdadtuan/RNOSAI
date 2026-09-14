import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { B2bStringeeTokenService } from '../b2b-projects/b2b-stringee-token.service';
import { CsdChatRepository } from './csd-chat.repository';
import type { CsdActor, CsdChatCallMode, CsdChatCallTokenResult } from './csd.types';

@Injectable()
export class CsdChatCallsService {
  constructor(
    private readonly repo: CsdChatRepository,
    private readonly stringee: B2bStringeeTokenService,
  ) {}

  async prepareDirectCall(
    actor: CsdActor,
    conversationId: string,
    mode: CsdChatCallMode,
  ): Promise<CsdChatCallTokenResult> {
    if (actor.staffId <= 0) {
      throw new BadRequestException({ error: 'staff_required' });
    }
    const conv = await this.repo.getConversationForMember(conversationId, actor.staffId);
    if (!conv) {
      throw new NotFoundException({ error: 'conversation_not_found' });
    }
    if (conv.kind !== 'direct') {
      throw new BadRequestException({ error: 'direct_only' });
    }
    const members = await this.repo.listMembers(conversationId);
    const peer = members.find((m) => m.member_staff_id !== actor.staffId);
    if (!peer) {
      throw new BadRequestException({ error: 'peer_not_found' });
    }

    const peerName =
      (await this.repo.findStaffDisplayName(peer.member_staff_id)) || `Staff #${peer.member_staff_id}`;
    const base = {
      mode,
      from_user_id: `staff_${actor.staffId}`,
      to_user_id: `staff_${peer.member_staff_id}`,
      peer_staff_id: peer.member_staff_id,
      peer_name: peerName,
    };

    const token = this.stringee.createStaffUserToken(actor.staffId);
    if (!token || !this.stringee.isConfigured()) {
      return { ...base, provider: 'unavailable' };
    }

    return {
      ...base,
      provider: 'stringee',
      access_token: token.access_token,
      from_user_id: token.user_id,
    };
  }
}
