import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  buildQcBlockedResponse,
  parseCpVersionIdFromDescription,
  requiresCpQcForTemplate,
  type CpLaunchGateCheck,
} from './cp-launch-gate.util';

export type CpLaunchGateInput = {
  templateId: string;
  creativeId: string;
  clientId: string;
};

export type CpLaunchGateVersion = {
  id: string;
  qc_status: string | null;
  playbook_id: string | null;
};

@Injectable()
export class CpLaunchGateService implements OnModuleDestroy {
  private pool: Pool | null = null;

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

  async assertAdsLaunchAllowed(input: CpLaunchGateInput): Promise<void> {
    if (!requiresCpQcForTemplate(input.templateId)) return;

    const creative = await this.loadCreative(input.clientId, input.creativeId);
    if (!creative) {
      throw new BadRequestException({ error: 'creative_not_found' });
    }

    const versionId = parseCpVersionIdFromDescription(creative.description)
      ?? await this.findVersionByAssetUrl(
        input.clientId,
        creative.asset_url == null ? null : String(creative.asset_url),
      );
    if (!versionId) {
      throw new BadRequestException({
        error: 'cp_creative_link_missing',
        message: 'Creative chưa liên kết CP video version (cp_version:… hoặc asset_url khớp output_uri)',
      });
    }

    const version = await this.loadVersion(versionId, input.clientId);
    if (!version) {
      throw new BadRequestException({
        error: 'cp_version_not_found',
        version_id: versionId,
      });
    }

    const qcStatus = version.qc_status == null ? null : String(version.qc_status);
    if (qcStatus !== 'passed') {
      const checks: CpLaunchGateCheck[] = [{
        check: 'qc_status',
        result: qcStatus ?? 'unknown',
        reason: qcStatus === 'blocked' ? 'domain_qc_blocked' : 'qc_not_passed',
      }];
      if (version.playbook_id) {
        checks.push({
          check: 'playbook_id',
          result: version.playbook_id,
        });
      }
      throw new BadRequestException(buildQcBlockedResponse({ qcStatus, checks }));
    }
  }

  private async loadCreative(clientId: string, creativeId: string) {
    const result = await this.db.query(
      `SELECT id::text, client_id::text, status, title, description, asset_url
         FROM creative_submissions
        WHERE id = $1::uuid AND client_id = $2::uuid
        LIMIT 1`,
      [creativeId, clientId],
    );
    return result.rows[0] ?? null;
  }

  private async findVersionByAssetUrl(
    clientId: string,
    assetUrl: string | null,
  ): Promise<string | null> {
    const uri = String(assetUrl ?? '').trim();
    if (!uri) return null;
    const result = await this.db.query(
      `SELECT v.id::text
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.agency_client_id = $1::uuid
          AND v.output_uri = $2
        ORDER BY v.version_n DESC, v.id DESC
        LIMIT 1`,
      [clientId, uri],
    );
    const id = result.rows[0]?.id;
    return id == null ? null : String(id);
  }

  private async loadVersion(
    versionId: string,
    clientId: string,
  ): Promise<CpLaunchGateVersion | null> {
    const result = await this.db.query(
      `SELECT v.id::text,
              v.qc_status,
              d.config_json->>'playbook_id' AS playbook_id
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE v.id = $1::uuid
          AND p.agency_client_id = $2::uuid
        LIMIT 1`,
      [versionId, clientId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      qc_status: row.qc_status == null ? null : String(row.qc_status),
      playbook_id: row.playbook_id == null ? null : String(row.playbook_id),
    };
  }
}
