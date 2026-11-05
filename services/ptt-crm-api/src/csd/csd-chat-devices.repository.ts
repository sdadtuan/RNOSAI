import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type CsdChatDeviceRow = {
  staff_id: number;
  platform: 'ios' | 'android';
  token: string;
};

@Injectable()
export class CsdChatDevicesRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.db
        .query(
          `CREATE TABLE IF NOT EXISTS csd_chat_devices (
             staff_id INTEGER NOT NULL,
             platform VARCHAR(16) NOT NULL,
             token TEXT NOT NULL,
             updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
             CONSTRAINT csd_chat_devices_platform_chk CHECK (platform IN ('ios', 'android')),
             CONSTRAINT csd_chat_devices_platform_token_uidx UNIQUE (platform, token)
           )`,
        )
        .then(() => undefined)
        .catch((err) => {
          this.schemaReady = null;
          throw err;
        });
    }
    await this.schemaReady;
  }

  async upsert(staffId: number, platform: 'ios' | 'android', token: string): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `INSERT INTO csd_chat_devices (staff_id, platform, token, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (platform, token)
       DO UPDATE SET staff_id = EXCLUDED.staff_id, updated_at = NOW()`,
      [staffId, platform, token],
    );
  }

  async listForStaff(staffIds: number[]): Promise<CsdChatDeviceRow[]> {
    const ids = [...new Set(staffIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) return [];
    await this.ensureSchema();
    const res = await this.db.query(
      `SELECT staff_id, platform, token
       FROM csd_chat_devices
       WHERE staff_id = ANY($1::int[])`,
      [ids],
    );
    return res.rows.map((row) => ({
      staff_id: Number(row.staff_id),
      platform: row.platform === 'ios' ? 'ios' : 'android',
      token: String(row.token),
    }));
  }
}
