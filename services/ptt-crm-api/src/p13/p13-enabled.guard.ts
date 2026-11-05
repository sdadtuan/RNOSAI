import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { p13Flag, p13FlagsFromPolicy } from './p13-flag';

@Injectable()
export class P13FlagsService {
  private pool: Pool | null = null;
  private cache: { at: number; flags: Record<string, boolean> } | null = null;

  constructor(private readonly config: AppConfigService) {}

  async settings(): Promise<Record<string, boolean>> {
    if (this.cache && Date.now() - this.cache.at < 5000) return this.cache.flags;
    try {
      if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
      const result = await this.pool.query(
        `SELECT policy_json->'p13_flags' AS flags FROM crm_quote_settings WHERE tenant_id = 'PTT' LIMIT 1`,
      );
      const flags = p13FlagsFromPolicy(result.rows[0]?.flags);
      this.cache = { at: Date.now(), flags };
      return flags;
    } catch {
      this.cache = { at: Date.now(), flags: {} };
      return {};
    }
  }

  async enabled(name = 'ENABLED'): Promise<boolean> {
    return p13Flag(name, process.env, await this.settings());
  }
}

@Injectable()
export class P13EnabledGuard implements CanActivate {
  constructor(private readonly flags: P13FlagsService) {}

  async canActivate(): Promise<boolean> {
    if (await this.flags.enabled('ENABLED')) return true;
    throw new NotFoundException({ error: 'not_found', code: 'p13_disabled' });
  }
}
