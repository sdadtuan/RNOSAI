import { BadRequestException } from '@nestjs/common';
import { CsdChatService } from './csd-chat.service';
import type { CsdActor } from './csd.types';

describe('CsdChatService', () => {
  const actor: CsdActor = { staffId: 3, staffLabel: 'am@test.vn', caps: [{ section: 'csd', action: 'write' }] };

  const repo = {
    insertConversation: jest.fn(),
    listConversations: jest.fn(),
    getConversation: jest.fn(),
    insertMessage: jest.fn(),
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    linkMessageToTicket: jest.fn(),
  };

  const tickets = {
    create: jest.fn(),
  };

  function svc() {
    return new CsdChatService(repo as never, tickets as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires client_account_id when kind=client', async () => {
    await expect(
      svc().createConversation(actor, { kind: 'client', name_vi: 'Khách A' }),
    ).rejects.toMatchObject({ status: 400, response: { error: 'client_account_id_required' } });
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
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'client' });
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
    tickets.create.mockResolvedValue({ id: 't1', code: 'PTT-2026-000001' });
    repo.linkMessageToTicket.mockResolvedValue({ id: 'm1', ticket_id: 't1' });

    const first = await svc().createTicketFromMessage(actor, 'm1', { ticket_type: 'incident', priority: 'P2' });
    const second = await svc().createTicketFromMessage(actor, 'm1', { ticket_type: 'incident', priority: 'P2' });

    expect(first.code).toBe('PTT-2026-000001');
    expect(second.code).toBe('PTT-2026-000001');
    expect(tickets.create).toHaveBeenCalledTimes(2);
    expect(tickets.create).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ source_type: 'chat_message', source_id: 'm1' }),
    );
    expect(repo.linkMessageToTicket).toHaveBeenCalledWith('m1', 't1');
  });

  it('rejects empty message body', async () => {
    repo.getConversation.mockResolvedValue({ id: 'c1', kind: 'group' });
    await expect(svc().sendMessage(actor, 'c1', { body_text: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
