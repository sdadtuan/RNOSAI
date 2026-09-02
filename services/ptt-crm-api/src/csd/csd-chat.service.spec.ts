import { BadRequestException } from '@nestjs/common';
import { CsdChatService } from './csd-chat.service';
import type { CsdActor } from './csd.types';

describe('CsdChatService', () => {
  const actor: CsdActor = { staffId: 3, staffLabel: 'am@test.vn', caps: [{ section: 'csd', action: 'write' }] };

  const repo = {
    insertConversation: jest.fn(),
    listConversations: jest.fn(),
    listConversationsForMember: jest.fn(),
    findDirectPair: jest.fn(),
    markRead: jest.fn(),
    getConversation: jest.fn(),
    insertMessage: jest.fn(),
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    linkMessageToTicket: jest.fn(),
    listMembers: jest.fn(),
    insertMember: jest.fn(),
    deleteMember: jest.fn(),
    updateStatus: jest.fn(),
    insertMentionNotifications: jest.fn(),
    insertClientChatNotifications: jest.fn(),
    countUnreadConversations: jest.fn(),
    listRelatedTickets: jest.fn(),
    updateMessageBody: jest.fn(),
    softDeleteMessage: jest.fn(),
    listAttachmentsByMessages: jest.fn(),
  };

  const tickets = {
    create: jest.fn(),
    findBySource: jest.fn(),
  };

  const files = {
    listForMessage: jest.fn(),
    attachToMessage: jest.fn(),
    copyClientFilesToTicket: jest.fn(),
  };

  const audit = {
    insert: jest.fn(),
  };

  const accounts = {
    assertEnabled: jest.fn(),
  };

  const friends = {
    isAccepted: jest.fn(),
  };

  function svc() {
    return new CsdChatService(
      repo as never,
      tickets as never,
      files as never,
      audit as never,
      accounts as never,
      friends as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    files.listForMessage.mockResolvedValue([]);
    files.attachToMessage.mockResolvedValue(undefined);
    files.copyClientFilesToTicket.mockResolvedValue([]);
    audit.insert.mockResolvedValue(undefined);
    tickets.findBySource.mockResolvedValue(null);
    repo.insertClientChatNotifications.mockResolvedValue(undefined);
    repo.listMembers.mockResolvedValue([]);
    accounts.assertEnabled.mockResolvedValue(undefined);
    friends.isAccepted.mockResolvedValue(true);
  });

  it('createConversation direct without friend is 409', async () => {
    accounts.assertEnabled.mockResolvedValue(undefined);
    friends.isAccepted.mockResolvedValue(false);
    repo.findDirectPair.mockResolvedValue(null);
    await expect(
      svc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] }),
    ).rejects.toMatchObject({ status: 409, response: { error: 'not_friends' } });
  });

  it('existing direct pair skips friend check', async () => {
    repo.findDirectPair.mockResolvedValue({ id: 'd1', kind: 'direct' });
    const row = await svc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] });
    expect(row.id).toBe('d1');
    expect(friends.isAccepted).not.toHaveBeenCalled();
  });

  it('does not send when chat account is disabled', async () => {
    accounts.assertEnabled.mockRejectedValue({ status: 403, response: { error: 'chat_disabled' } });
    await expect(svc().sendMessage(actor, 'c1', { body_text: 'ping' })).rejects.toMatchObject({
      status: 403,
    });
    expect(repo.insertMessage).not.toHaveBeenCalled();
    expect(repo.getConversation).not.toHaveBeenCalled();
  });

  it('requires client_account_id when kind=client', async () => {
    await expect(
      svc().createConversation(actor, { kind: 'client', name_vi: 'Khách A' }),
    ).rejects.toMatchObject({ status: 400, response: { error: 'client_account_id_required' } });
    expect(repo.insertConversation).not.toHaveBeenCalled();
  });

  it('creates direct with exactly two staff and reuses pair', async () => {
    repo.findDirectPair.mockResolvedValue(null);
    repo.insertConversation.mockResolvedValue({ id: 'd1', kind: 'direct' });
    await svc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] });
    expect(repo.insertConversation).toHaveBeenCalled();
    repo.findDirectPair.mockResolvedValue({ id: 'd1', kind: 'direct' });
    const again = await svc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] });
    expect(again.id).toBe('d1');
  });

  it('rejects direct without peer', async () => {
    await expect(svc().createConversation(actor, { kind: 'direct', name_vi: 'x' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('lists only memberships and applies internal filter', async () => {
    repo.listConversationsForMember.mockResolvedValue([{ id: 'g1', kind: 'group', unread_count: 0 }]);
    const out = await svc().listConversations(actor, { filter: 'internal' });
    expect(repo.listConversationsForMember).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: 3, filter: 'internal' }),
    );
    expect(out.items[0].kind).toBe('group');
  });

  it('rejects ticket campaign and ai_assist kinds in MVP', async () => {
    await expect(
      svc().createConversation(actor, { kind: 'ticket', name_vi: 'Từ ticket' }),
    ).rejects.toMatchObject({ status: 400, response: { error: 'kind_not_mvp' } });
    expect(repo.insertConversation).not.toHaveBeenCalled();
  });

  it('requires group name and extra members', async () => {
    await expect(
      svc().createConversation(actor, { kind: 'group', name_vi: '', member_staff_ids: [8] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      svc().createConversation(actor, { kind: 'group', name_vi: 'Nhóm AM' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.insertConversation).not.toHaveBeenCalled();
  });

  it('creates client conversation with client_account_id', async () => {
    repo.insertConversation.mockResolvedValue({
      id: 'c1',
      kind: 'client',
      client_account_id: 'CLI-1',
    });
    const out = await svc().createConversation(actor, {
      kind: 'client',
      name_vi: 'Khách A',
      client_account_id: 'CLI-1',
    });
    expect(out.id).toBe('c1');
    expect(repo.insertConversation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'client', client_account_id: 'CLI-1' }),
    );
  });

  it('forces visibility=client for client conversations', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client', status: 'active' });
    repo.insertMessage.mockResolvedValue({ id: 'm1', visibility: 'client' });

    await svc().sendMessage(actor, 'c1', { body_text: 'Xin chào', visibility: 'internal' });

    expect(repo.insertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'client', body_text: 'Xin chào' }),
    );
  });

  it('returns existing ticket when createTicketFromMessage source repeats', async () => {
    repo.getMessage.mockResolvedValue({
      id: 'm1',
      conversation_id: 'c1',
      body_text: 'Lỗi website',
    });
    repo.getConversation.mockResolvedValue({
      id: 'c1',
      kind: 'client',
      client_account_id: 'CLI-1',
    });
    tickets.findBySource
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 't1', code: 'PTT-2026-000001' });
    tickets.create.mockResolvedValue({ id: 't1', code: 'PTT-2026-000001' });
    repo.linkMessageToTicket.mockResolvedValue({ id: 'm1', ticket_id: 't1' });

    const first = await svc().createTicketFromMessage(actor, 'm1', { ticket_type: 'incident', priority: 'P2' });
    const second = await svc().createTicketFromMessage(actor, 'm1', { ticket_type: 'incident', priority: 'P2' });

    expect(first.code).toBe('PTT-2026-000001');
    expect(second.code).toBe('PTT-2026-000001');
    expect(second.already_exists).toBe(true);
    expect(tickets.create).toHaveBeenCalledTimes(1);
    expect(tickets.create).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ source_type: 'chat_message', source_id: 'm1' }),
    );
    expect(repo.linkMessageToTicket).toHaveBeenCalledWith('m1', 't1');
  });

  it('suggests P1 priority on urgent client message', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client', status: 'active', owner_staff_id: 9 });
    repo.insertMessage.mockResolvedValue({ id: 'm1', body_text: 'Ads ngưng chạy' });
    repo.listMembers.mockResolvedValue([{ member_staff_id: 9, role: 'owner' }]);
    const out = await svc().sendMessage(actor, 'c1', { body_text: 'Ads ngưng chạy' });
    expect(out.priority_suggestion).toBe('P1');
    expect(repo.insertClientChatNotifications).toHaveBeenCalled();
  });

  it('notifies mentioned staff except the sender', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'group', status: 'active' });
    repo.insertMessage.mockResolvedValue({ id: 'm1', body_text: 'cc @8 và @12' });
    repo.insertMentionNotifications.mockResolvedValue(undefined);
    await svc().sendMessage(actor, 'c1', { body_text: 'cc @8 và @12' });
    expect(repo.insertMentionNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'c1',
        messageId: 'm1',
        staffIds: [8, 12],
        excludeStaffId: 3,
      }),
    );
  });

  it('lists related tickets for a conversation', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client', client_account_id: 'CLI-1' });
    repo.listRelatedTickets.mockResolvedValue([{ id: 't1', code: 'PTT-2026-000099' }]);
    const out = await svc().listRelatedTickets(actor, 'c1');
    expect(repo.listRelatedTickets).toHaveBeenCalledWith('c1');
    expect(out.items[0].code).toBe('PTT-2026-000099');
  });

  it('rejects empty message body', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'group', status: 'active' });
    await expect(svc().sendMessage(actor, 'c1', { body_text: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects announcement send and ticket from non-owner', async () => {
    repo.getConversation.mockResolvedValue({
      id: 'a1',
      kind: 'announcement',
      status: 'active',
      owner_staff_id: 9,
    });
    await expect(svc().sendMessage(actor, 'a1', { body_text: 'ping' })).rejects.toMatchObject({
      status: 403,
    });
    repo.getMessage.mockResolvedValue({
      id: 'm1',
      conversation_id: 'a1',
      body_text: 'ping',
    });
    await expect(svc().createTicketFromMessage(actor, 'm1', {})).rejects.toMatchObject({
      status: 400,
    });
    expect(repo.insertMessage).not.toHaveBeenCalled();
    expect(tickets.create).not.toHaveBeenCalled();
  });

  it('marks conversation read for actor', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'group' });
    repo.markRead.mockResolvedValue(true);
    await svc().markRead(actor, 'c1');
    expect(repo.markRead).toHaveBeenCalledWith('c1', 3);
  });

  it('rejects sendMessage when conversation is closed', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client', status: 'closed' });
    await expect(svc().sendMessage(actor, 'c1', { body_text: 'hi' })).rejects.toMatchObject({
      status: 409,
    });
    expect(repo.insertMessage).not.toHaveBeenCalled();
  });

  it('closes when actor is owner', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', status: 'active', owner_staff_id: 3 });
    repo.updateStatus.mockResolvedValue({ id: 'c1', status: 'closed' });
    const out = await svc().closeConversation(actor, 'c1');
    expect(out.status).toBe('closed');
    expect(repo.updateStatus).toHaveBeenCalledWith('c1', 'closed', 3);
  });

  it('denies close when not owner and no manage cap', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', status: 'active', owner_staff_id: 9 });
    await expect(svc().closeConversation(actor, 'c1')).rejects.toMatchObject({ status: 403 });
  });

  it('adds staff member and rejects owner remove', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', status: 'active', owner_staff_id: 3 });
    repo.insertMember.mockResolvedValue({
      conversation_id: 'c1',
      member_staff_id: 8,
      role: 'member',
    });
    await svc().addMember(actor, 'c1', { member_staff_id: 8 });
    expect(repo.insertMember).toHaveBeenCalledWith(
      expect.objectContaining({ conversation_id: 'c1', member_staff_id: 8, role: 'member' }),
    );
    await expect(svc().removeMember(actor, 'c1', 3)).rejects.toMatchObject({ status: 400 });
    expect(repo.deleteMember).not.toHaveBeenCalled();
  });

  it('rejects edit after 15 minutes', async () => {
    repo.getMessage.mockResolvedValue({
      id: 'm1',
      conversation_id: 'c1',
      author_staff_id: 3,
      created_at: new Date(Date.now() - 16 * 60_000).toISOString(),
    });
    repo.getConversation.mockResolvedValue({ id: 'c1', status: 'active' });
    await expect(svc().editMessage(actor, 'm1', { body_text: 'x' })).rejects.toMatchObject({ status: 409 });
  });

  it('skips internal files when creating ticket from message', async () => {
    repo.getMessage.mockResolvedValue({
      id: 'm1',
      conversation_id: 'c1',
      body_text: 'Ads lỗi',
    });
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'group', client_account_id: null });
    tickets.create.mockResolvedValue({ id: 't1', code: 'PTT-2026-000010' });
    repo.linkMessageToTicket.mockResolvedValue({ id: 'm1', ticket_id: 't1' });
    files.listForMessage.mockResolvedValue([{ id: 'a1', visibility: 'internal' }]);
    files.copyClientFilesToTicket.mockResolvedValue([]);
    const out = await svc().createTicketFromMessage(actor, 'm1', {});
    expect(out.skipped_internal_files).toEqual(['a1']);
    expect(files.copyClientFilesToTicket).toHaveBeenCalledWith([], 't1');
  });
});
