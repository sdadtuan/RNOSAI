import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdChatRepository } from './csd-chat.repository';
import type { CsdActor, CsdAttachmentRow } from './csd.types';

const MAX_BYTES = 104857600;

export type CsdFileIo = {
  mkdirSync: typeof mkdirSync;
  writeFileSync: typeof writeFileSync;
  existsSync: typeof existsSync;
  createReadStream: typeof createReadStream;
  fileDir: () => string;
};

const defaultIo: CsdFileIo = {
  mkdirSync,
  writeFileSync,
  existsSync,
  createReadStream,
  fileDir: () => process.env.PTT_CSD_FILE_DIR || join(process.cwd(), 'data/csd-files'),
};

function safeName(name: string): string {
  return String(name || 'file')
    .replace(/[/\\]+/g, '_')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120);
}

@Injectable()
export class CsdChatFilesService {
  io: CsdFileIo = defaultIo;

  constructor(private readonly repo: CsdChatRepository) {}

  async upload(
    _actor: CsdActor,
    conversationId: string,
    file?: Express.Multer.File,
  ): Promise<CsdAttachmentRow> {
    const conv = await this.repo.getConversation(conversationId);
    if (!conv) throw new NotFoundException({ error: 'csd_conversation_not_found' });
    if (!file?.buffer) throw new BadRequestException({ error: 'file_required' });
    if (file.size <= 0) throw new BadRequestException({ error: 'file_required' });
    if (file.size > MAX_BYTES) throw new BadRequestException({ error: 'file_too_large' });

    const visibility = conv.kind === 'client' ? 'client' : 'internal';
    const id = randomUUID();
    const fileName = safeName(file.originalname);
    const storageKey = `${conversationId}/${id}-${fileName}`;
    const absDir = join(this.io.fileDir(), conversationId);
    this.io.mkdirSync(absDir, { recursive: true });
    this.io.writeFileSync(join(this.io.fileDir(), storageKey), file.buffer);

    return this.repo.insertAttachment({
      id,
      storage_key: storageKey,
      file_name: fileName,
      mime_type: file.mimetype || 'application/octet-stream',
      byte_size: file.size,
      visibility,
      entity_type: 'csd_conversation',
      entity_id: conversationId,
      uploaded_by_staff_id: _actor.staffId,
    });
  }

  async listForMessage(messageId: string): Promise<CsdAttachmentRow[]> {
    const grouped = await this.repo.listAttachmentsByMessages([messageId]);
    return grouped[messageId] ?? [];
  }

  async attachToMessage(
    conversationId: string,
    messageId: string,
    attachmentIds: string[],
  ): Promise<void> {
    if (!attachmentIds.length) return;
    await this.repo.attachConversationFilesToMessage(conversationId, messageId, attachmentIds);
  }

  async copyClientFilesToTicket(files: CsdAttachmentRow[], ticketId: string): Promise<string[]> {
    const clientFiles = files.filter((f) => f.visibility === 'client');
    if (!clientFiles.length) return [];
    return this.repo.copyAttachmentsToEntity(clientFiles, 'csd_ticket', ticketId);
  }

  async openForDownload(
    _actor: CsdActor,
    attachmentId: string,
    opts: { asClient?: boolean } = {},
  ): Promise<{ file_name: string; mime_type: string; stream: ReturnType<typeof createReadStream> }> {
    const row = await this.repo.getAttachment(attachmentId);
    if (!row) throw new NotFoundException({ error: 'csd_file_not_found' });

    const conversationId = await this.resolveConversationId(row);
    const conv = conversationId ? await this.repo.getConversation(conversationId) : null;
    if (opts.asClient && row.visibility === 'internal' && conv?.kind === 'client') {
      throw new ForbiddenException({ error: 'csd_file_forbidden' });
    }

    const abs = join(this.io.fileDir(), row.storage_key);
    if (!this.io.existsSync(abs)) throw new NotFoundException({ error: 'csd_file_missing' });
    return {
      file_name: row.file_name,
      mime_type: row.mime_type,
      stream: this.io.createReadStream(abs),
    };
  }

  private async resolveConversationId(row: CsdAttachmentRow): Promise<string | null> {
    if (row.entity_type === 'csd_conversation') return row.entity_id;
    if (row.entity_type === 'csd_message') {
      const message = await this.repo.getMessageAny(row.entity_id);
      return message?.conversation_id ?? null;
    }
    return null;
  }
}
