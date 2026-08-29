import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiSummarizeRateLimitService } from '../ai-intelligence/ai-summarize-rate-limit.service';
import { IntakeB2bVisibilityService, IntakeStaffActor } from './intake-b2b-visibility.service';
import { IntakePgRepository } from './intake-pg.repository';
import {
  imageParseStatus,
  parseSalesKitPdf,
  parseSalesKitXlsx,
} from './sales-kit-ingest.util';
import {
  folderKeyOk,
  isAllowedSalesKitMime,
  playbookSlugForFolder,
  salesKitFileTooLarge,
  sessionFolderKey,
} from './sales-kit-library.util';
import {
  SalesKitLibraryRepository,
  type SalesKitFileRow,
  type SalesKitReadyChunkRow,
} from './sales-kit-library.repository';
import { scoreSalesKitChunks, type SalesKitHit } from './sales-kit-retrieve.util';

export const SALES_KIT_FS = 'SALES_KIT_FS';

export type SalesKitFs = {
  mkdirSync: typeof mkdirSync;
  writeFileSync: typeof writeFileSync;
  renameSync: typeof renameSync;
  existsSync: typeof existsSync;
  createReadStream: typeof createReadStream;
};

const ORG_FILE_CAP = 40;
const SESSION_FILE_CAP = 10;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EXT_MIME: Record<string, string> = {
  '.xlsx': XLSX_MIME,
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export type SalesKitSessionRef = {
  id: number;
  lead_id: number | null;
  service_slug: string;
};

const DEFAULT_FS: SalesKitFs = {
  mkdirSync,
  writeFileSync,
  renameSync,
  existsSync,
  createReadStream,
};

function actorHasCap(actor: IntakeStaffActor | null | undefined, section: string, action: string): boolean {
  if (!actor) return true;
  return (actor.caps ?? []).some((c) => c.section === section && c.action === action);
}

function hasConfigure(actor: IntakeStaffActor | null | undefined): boolean {
  return actorHasCap(actor, 'playbooks', 'configure') || actorHasCap(actor, 'crm_leads', 'configure');
}

function hasEdit(actor: IntakeStaffActor | null | undefined): boolean {
  return actorHasCap(actor, 'crm_leads', 'edit');
}

function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  return base || 'file';
}

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.PTT_SALES_KIT_STORAGE_DIR || 'var/sales-kit');
}

function assertInsideRoot(abs: string): void {
  const root = storageRoot();
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new BadRequestException({ error: 'invalid_storage_key' });
  }
}

function rowVisibleToSession(session: SalesKitSessionRef, row: SalesKitReadyChunkRow): boolean {
  const folder = String(row.folder_path ?? '');
  const first = folder.split('/')[0] ?? '';
  const isSessionRow =
    row.lead_id != null || row.session_id != null || first === 'session';
  if (isSessionRow) {
    return (
      session.lead_id != null &&
      Number(row.lead_id) === Number(session.lead_id) &&
      Number(row.session_id) === Number(session.id)
    );
  }
  return first === session.service_slug || first === '_common';
}

function kindTagFromFolder(folderKey: string): string {
  const last = folderKey.split('/').filter(Boolean).pop() ?? 'other';
  return last;
}

function xlsxKindFromFolder(folderKey: string): 'qa' | 'pricing' | 'auto' {
  if (folderKey.includes('/pricing')) return 'pricing';
  if (folderKey.includes('/qa')) return 'qa';
  return 'auto';
}

function resolveMime(file: Express.Multer.File): string | null {
  const ext = path.extname(file.originalname ?? '').toLowerCase();
  if (ext === '.docx' || ext === '.doc') return null;
  if (isAllowedSalesKitMime(file.mimetype)) return file.mimetype;
  return EXT_MIME[ext] ?? null;
}

function llmOn(): boolean {
  return process.env.PTT_INTAKE_SALES_KIT_LLM === '1';
}

@Injectable()
export class SalesKitLibraryService {
  private readonly fs: SalesKitFs;

  constructor(
    private readonly repo: SalesKitLibraryRepository,
    private readonly b2bVisibility: IntakeB2bVisibilityService,
    private readonly intakePg: IntakePgRepository,
    private readonly rateLimit: AiSummarizeRateLimitService,
    private readonly aiConfig: AiIntelligenceConfigService,
    @Optional() @Inject(SALES_KIT_FS) fsApi?: SalesKitFs,
  ) {
    this.fs = fsApi ?? DEFAULT_FS;
  }

  async retrieveForSession(
    session: SalesKitSessionRef,
    query: string,
    _kindHint?: string,
  ): Promise<SalesKitHit[]> {
    const rows = await this.repo.listReadyChunks();
    const allowed = rows.filter((row) => rowVisibleToSession(session, row));
    return scoreSalesKitChunks({ query, rows: allowed });
  }

  async uploadFile(input: {
    file?: Express.Multer.File | null;
    folderKey?: string;
    leadId?: number;
    sessionId?: number;
    actor?: IntakeStaffActor | null;
  }): Promise<SalesKitFileRow> {
    const actorId = input.actor?.staffId ?? 'internal';
    this.rateLimit.check(`intake-kit:${actorId}`, this.aiConfig.summarizeRateLimitPerMin);

    const file = input.file;
    if (!file?.buffer) {
      throw new BadRequestException({ error: 'file_required' });
    }
    const mime = resolveMime(file);
    if (!mime) {
      throw new BadRequestException({ error: 'unsupported_type' });
    }
    if (salesKitFileTooLarge(mime, file.size ?? file.buffer.length)) {
      throw new BadRequestException({ error: 'file_too_large' });
    }
    if (!(await this.repo.tableReady())) {
      throw new ServiceUnavailableException({ error: 'schema_not_ready' });
    }

    let folderKey = String(input.folderKey ?? '').trim();
    let leadId: number | null = input.leadId != null ? Number(input.leadId) : null;
    let sessionId: number | null = input.sessionId != null ? Number(input.sessionId) : null;
    if (sessionId != null && leadId == null) {
      const sess = await this.intakePg.getSession(sessionId);
      if (!sess) throw new NotFoundException({ error: 'not_found' });
      leadId = sess.lead_id;
    }
    const sessionBag = sessionId != null && leadId != null;
    let playbookStatus: 'draft' | 'active' = 'draft';
    let tags: string[];

    if (sessionBag) {
      const bagLeadId = leadId as number;
      const bagSessionId = sessionId as number;
      if (!hasEdit(input.actor)) {
        throw new ForbiddenException({ error: 'missing_cap', section: 'crm_leads' });
      }
      await this.b2bVisibility.assertLeadVisible(bagLeadId, input.actor);
      folderKey = sessionFolderKey(bagLeadId, bagSessionId);
      playbookStatus = 'active';
      tags = ['sales_kit', 'session'];
      const n = await this.repo.countFilesBySession(bagLeadId, bagSessionId);
      if (n >= SESSION_FILE_CAP) {
        throw new BadRequestException({ error: 'session_limit' });
      }
    } else {
      if (!hasConfigure(input.actor)) {
        throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
      }
      if (!folderKeyOk(folderKey)) {
        throw new BadRequestException({ error: 'invalid_folder_key' });
      }
      const n = await this.repo.countFilesByFolder(folderKey);
      if (n >= ORG_FILE_CAP) {
        throw new BadRequestException({ error: 'folder_limit' });
      }
      const serviceSlug = folderKey.split('/')[0] ?? '';
      tags = ['sales_kit', serviceSlug, kindTagFromFolder(folderKey)];
    }

    const playbook = await this.repo.ensurePlaybook({
      slug: playbookSlugForFolder(folderKey),
      title: `Sales kit ${folderKey}`,
      tags,
      status: playbookStatus,
      createdBy: input.actor ? String(input.actor.staffId) : null,
    });

    const safeName = safeFileName(file.originalname ?? 'file');
    const tmpRel = path.join(folderKey, `.tmp-${randomUUID()}-${safeName}`);
    const tmpAbs = path.join(storageRoot(), tmpRel);
    assertInsideRoot(tmpAbs);
    this.fs.mkdirSync(path.dirname(tmpAbs), { recursive: true });
    this.fs.writeFileSync(tmpAbs, file.buffer);

    const row = await this.repo.insertFile({
      playbookId: playbook.id,
      leadId,
      sessionId,
      folderKey,
      originalName: file.originalname ?? safeName,
      mime,
      storageKey: tmpRel,
      parseStatus: 'pending',
      uploadedBy: input.actor?.staffId ?? null,
    });

    const finalRel = `${folderKey}/${row.id}-${safeName}`;
    const finalAbs = path.join(storageRoot(), finalRel);
    assertInsideRoot(finalAbs);
    this.fs.renameSync(tmpAbs, finalAbs);
    await this.repo.updateFileStorage(row.id, finalRel);

    await this.parseAndStore(row.id, playbook.id, folderKey, mime, file.buffer, sessionBag);
    const updated = await this.repo.findFileById(row.id);
    return updated ?? { ...row, storage_key: finalRel };
  }

  private async parseAndStore(
    fileId: string,
    playbookId: string,
    folderKey: string,
    mime: string,
    buf: Buffer,
    sessionBag: boolean,
  ): Promise<void> {
    if (mime.startsWith('image/')) {
      await this.repo.updateFileParse(fileId, imageParseStatus(llmOn()), null);
      return;
    }
    try {
      if (mime === XLSX_MIME) {
        const parsed = await parseSalesKitXlsx(buf, xlsxKindFromFolder(folderKey));
        if (parsed.error || !parsed.chunks.length) {
          await this.repo.updateFileParse(fileId, 'failed', parsed.error ?? 'xlsx_empty');
          return;
        }
        await this.repo.insertChunks(playbookId, fileId, parsed.chunks);
        await this.repo.updateFileParse(fileId, sessionBag ? 'ready' : 'pending', null);
        return;
      }
      if (mime === 'application/pdf') {
        const parsed = await parseSalesKitPdf(buf);
        if (parsed.error || !parsed.chunks.length) {
          await this.repo.updateFileParse(fileId, parsed.error === 'pdf_needs_ocr' ? 'needs_ocr' : 'failed', parsed.error ?? 'pdf_empty');
          return;
        }
        await this.repo.insertChunks(playbookId, fileId, parsed.chunks);
        await this.repo.updateFileParse(fileId, sessionBag ? 'ready' : 'pending', null);
        return;
      }
      await this.repo.updateFileParse(fileId, 'failed', 'unsupported_type');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'parse_failed';
      await this.repo.updateFileParse(fileId, 'failed', msg.slice(0, 200));
    }
  }

  async listFiles(
    query: { folder_key?: string; session_id?: string },
    actor?: IntakeStaffActor | null,
  ): Promise<{ files: SalesKitFileRow[] }> {
    const sessionId = query.session_id ? Number(query.session_id) : undefined;
    const folderKey = String(query.folder_key ?? '').trim() || undefined;
    if (sessionId && Number.isFinite(sessionId)) {
      const session = await this.intakePg.getSession(sessionId);
      if (!session) throw new NotFoundException({ error: 'not_found' });
      if (session.lead_id) {
        await this.b2bVisibility.assertLeadVisible(session.lead_id, actor);
      }
      return { files: await this.repo.listFiles({ sessionId }) };
    }
    if (folderKey) {
      if (!hasConfigure(actor)) {
        throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
      }
      if (!folderKeyOk(folderKey)) {
        throw new BadRequestException({ error: 'invalid_folder_key' });
      }
      return { files: await this.repo.listFiles({ folderKey }) };
    }
    throw new BadRequestException({ error: 'folder_or_session_required' });
  }

  async approveFile(id: string, actor?: IntakeStaffActor | null): Promise<SalesKitFileRow> {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    const file = await this.repo.approveFile(id);
    if (!file) throw new NotFoundException({ error: 'not_found' });
    return file;
  }

  async downloadFile(id: string, actor?: IntakeStaffActor | null): Promise<StreamableFile> {
    const file = await this.repo.findFileById(id);
    if (!file) throw new NotFoundException({ error: 'not_found' });
    if (file.lead_id) {
      await this.b2bVisibility.assertLeadVisible(file.lead_id, actor);
    } else if (!hasConfigure(actor) && !actorHasCap(actor, 'crm_leads', 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_leads' });
    }
    const abs = path.join(storageRoot(), file.storage_key);
    assertInsideRoot(abs);
    if (!this.fs.existsSync(abs)) {
      throw new NotFoundException({ error: 'file_missing' });
    }
    return new StreamableFile(this.fs.createReadStream(abs), {
      type: file.mime,
      disposition: `attachment; filename="${safeFileName(file.original_name)}"`,
    });
  }
}
