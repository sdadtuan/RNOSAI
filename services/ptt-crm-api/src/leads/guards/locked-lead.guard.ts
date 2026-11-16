import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Request } from 'express';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import {
  isLeadLockExemptPath,
  leadIdsFromRequest,
  leadLockedSql,
  LEAD_LOCKED_ERROR,
  LEAD_LOCKED_MESSAGE_VI,
  LEAD_LOCKED_NOT_FOUND_MESSAGE_VI,
} from '../lead-lock.util';

/**
 * Global guard (APP_GUARD): leads Sales confirmed as "Sai số" are locked.
 * - Any mutation touching a locked lead → 403 lead_locked (everyone, admin included).
 * - Reads → only super admin; others get 404.
 * Fails open (logs) when the DB check itself errors.
 */
@Injectable()
export class LockedLeadGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(LockedLeadGuard.name);
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private get db(): Pool | null {
    const url = this.config.databaseUrl;
    if (!url) return null;
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: url,
        max: 2,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 5_000,
      });
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end().catch(() => undefined);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    const pathname = String(req.path || req.originalUrl || req.url || '').split('?')[0];
    if (!pathname.startsWith('/api/') || isLeadLockExemptPath(pathname)) return true;
    const ids = leadIdsFromRequest({ path: pathname, query: req.query, body: req.body });
    if (!ids.length) return true;
    const db = this.db;
    if (!db) return true;
    let locked: number[] = [];
    try {
      const result = await db.query(
        `SELECT sqlite_lead_id AS id FROM crm_leads l
          WHERE l.sqlite_lead_id = ANY($1::bigint[]) AND ${leadLockedSql('l')}`,
        [ids],
      );
      locked = result.rows.map((row: { id: unknown }) => Number(row.id));
    } catch (err) {
      this.logger.warn(`lead lock check failed: ${(err as Error).message}`);
      return true;
    }
    if (!locked.length) return true;
    const method = String(req.method || 'GET').toUpperCase();
    const readOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (!readOnly) {
      throw new ForbiddenException({
        error: LEAD_LOCKED_ERROR,
        message: LEAD_LOCKED_MESSAGE_VI,
        lead_ids: locked,
      });
    }
    if (await this.isSuperAdmin(req)) return true;
    throw new NotFoundException({
      error: 'lead_not_found',
      message: LEAD_LOCKED_NOT_FOUND_MESSAGE_VI,
    });
  }

  private async isSuperAdmin(req: Request): Promise<boolean> {
    const header = String(req.headers.authorization ?? '');
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) return false;
    try {
      const payload = await this.staffAuth.verifyAccessToken(token);
      return Boolean(payload) && (await this.staffAuth.isSuperAdminUser(payload));
    } catch {
      return false;
    }
  }
}
