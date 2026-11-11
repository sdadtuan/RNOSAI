import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { createAppPgPool, shouldEndLocalPool } from '../config/pg-pool.factory';
import { AppConfigService } from '../config/app-config.service';
import { ensurePortalCrmLocalSchema } from '../portal/portal-crm-local-ddl.util';

@Injectable()
export class MetaBusinessTokenRepository implements OnModuleDestroy {
  private readonly log = new Logger(MetaBusinessTokenRepository.name);
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = createAppPgPool(this.config.databaseUrl);
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    if (shouldEndLocalPool()) await this.pool?.end();
    this.pool = null;
  }

  private async ensure(): Promise<void> {
    await ensurePortalCrmLocalSchema(this.db, this.log, MetaBusinessTokenRepository.name);
  }

  async read(): Promise<{ token: Buffer; updated_at: Date } | null> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT access_token_encrypted, updated_at FROM ptt_meta_business_token WHERE id = 'PTT'`,
    );
    const row = result.rows[0] as { access_token_encrypted?: Buffer; updated_at?: Date } | undefined;
    if (!row?.access_token_encrypted) return null;
    return {
      token: row.access_token_encrypted,
      updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    };
  }

  async save(encrypted: Buffer): Promise<Date> {
    await this.ensure();
    const result = await this.db.query(
      `INSERT INTO ptt_meta_business_token (id, access_token_encrypted, updated_at)
       VALUES ('PTT', $1, NOW())
       ON CONFLICT (id) DO UPDATE
         SET access_token_encrypted = EXCLUDED.access_token_encrypted,
             updated_at = NOW()
       RETURNING updated_at`,
      [encrypted],
    );
    const updated = result.rows[0]?.updated_at;
    return updated instanceof Date ? updated : new Date();
  }
}
