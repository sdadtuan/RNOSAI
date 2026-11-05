import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { CsdEmailService } from '../csd/csd-email.service';
import { assertInternalEmailRecipients, parseInternalEmailDomains } from './iwr-email.util';
import { IwrReportsRepository } from './iwr-reports.repository';
import { IwrDelegationsRepository } from './iwr-w4.repository';
import type { IwrActor, SendIwrEmailInput } from './iwr.types';

const FILE_MAX_BYTES = 104857600;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function safeFileName(name: string): string {
  return String(name ?? 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 180);
}

function fileDir(): string {
  return process.env.PTT_IWR_FILE_DIR || join(process.cwd(), 'data/iwr-files');
}

function hasCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrFilesService {
  constructor(private readonly repo: IwrReportsRepository) {}

  async upload(
    actor: IwrActor,
    reportId: string,
    file?: Express.Multer.File,
    entityType: 'iwr_report' | 'iwr_item' = 'iwr_report',
    entityId?: string,
  ) {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id !== actor.staffId && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    if (!file?.buffer) throw new BadRequestException({ error: 'file_required' });
    if (file.size <= 0 || file.size > FILE_MAX_BYTES) {
      throw new BadRequestException({ error: 'file_too_large' });
    }
    const mime = file.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mime)) throw new BadRequestException({ error: 'file_type_not_allowed' });

    const targetId = entityId ?? reportId;
    const attachmentId = randomUUID();
    const fileName = safeFileName(file.originalname);
    const storageKey = `${entityType}/${targetId}/${attachmentId}-${fileName}`;
    const absDir = join(fileDir(), entityType, targetId);
    mkdirSync(absDir, { recursive: true });
    writeFileSync(join(fileDir(), storageKey), file.buffer);

    return this.repo.insertAttachment({
      id: attachmentId,
      storage_key: storageKey,
      file_name: fileName,
      mime_type: mime,
      byte_size: file.size,
      entity_type: entityType,
      entity_id: targetId,
      uploaded_by_staff_id: actor.staffId,
    });
  }

  async list(actor: IwrActor, reportId: string) {
    const report = await this.repo.getReport(reportId);
    if (!report) throw new NotFoundException({ error: 'iwr_report_not_found' });
    if (report.author_staff_id !== actor.staffId && !hasCap(actor, 'view')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const items = await this.repo.listAttachments('iwr_report', reportId);
    return { items };
  }
}

@Injectable()
export class IwrEmailService {
  constructor(private readonly csdEmail: CsdEmailService) {}

  async sendInternal(actor: IwrActor, input: SendIwrEmailInput) {
    const domains = parseInternalEmailDomains();
    assertInternalEmailRecipients(input.to ?? [], domains);
    return this.csdEmail.send(actor as never, {
      to: input.to,
      subject: input.subject,
      body_text: input.body_text,
    });
  }
}

@Injectable()
export class IwrDelegationsService {
  constructor(private readonly repo: IwrDelegationsRepository) {}

  async list(_actor: IwrActor) {
    return { items: await this.repo.list() };
  }

  async create(
    actor: IwrActor,
    input: { delegate_staff_id: number; starts_at: string; ends_at: string },
  ) {
    if (!hasCap(actor, 'manage') && !hasCap(actor, 'review')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'review' });
    }
    const row = await this.repo.insert({
      delegator_staff_id: actor.staffId,
      delegate_staff_id: input.delegate_staff_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
    });
    return row;
  }
}
