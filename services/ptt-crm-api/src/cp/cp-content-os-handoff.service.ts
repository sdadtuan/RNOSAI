import { HttpException, Injectable } from '@nestjs/common';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpProjectsRepository, CpProjectsService } from './cp-projects.service';
import { CpVideosService, CpVideoScope } from './cp-videos.service';

export type CpContentOsHandoffQuery = {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};

export type CpContentOsHandoffInput = {
  lifecycle_id?: number | string;
  item_id?: number | string;
  name?: string;
  prompt?: string;
};

export type CpContentOsHandoffResult = {
  draft_id: string;
  href: string;
};

@Injectable()
export class CpContentOsHandoffService {
  constructor(
    private readonly db: CpProjectsRepository,
    private readonly projects: CpProjectsService,
    private readonly videos: CpVideosService,
  ) {}

  async handoff(
    input: CpContentOsHandoffInput,
    scope: CpVideoScope,
  ): Promise<CpContentOsHandoffResult> {
    const lifecycleId = parseLifecycleId(input.lifecycle_id);
    const existing = await this.findProject(lifecycleId);
    const item = await this.loadItem(lifecycleId, input.item_id);
    const name =
      nullableText(input.name) ||
      nullableText(item?.title) ||
      `Content OS LC-${lifecycleId}`;

    let projectId = existing?.id;
    if (!projectId) {
      const clientId = await this.resolveLifecycleClient(lifecycleId);
      if (!clientId) cpThrow(400, { error: 'agency_client_id_required' });
      const created = await this.projects.create(
        {
          name,
          agency_client_id: clientId,
          owner_staff_id: scope.staffId,
          lifecycle_id: String(lifecycleId),
          status: 'draft',
        },
        scope.staffId,
      );
      projectId = String(created.id);
    }

    const draft = await this.videos.upsertDraft(
      {
        project_id: projectId,
        name,
        prompt: nullableText(input.prompt),
        input_mode: 'prompt',
      },
      scope,
    );
    const draftId = String(draft.id);
    return {
      draft_id: draftId,
      href: `/crm/creative-os/video/${draftId}`,
    };
  }

  private async findProject(lifecycleId: number) {
    const result = await this.db.query(
      `SELECT p.id, p.agency_client_id, p.lifecycle_id
         FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.lifecycle_id = $2
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 1`,
      [CP_TENANT_ID, String(lifecycleId)],
    );
    const row = result.rows[0];
    return row ? { id: String(row.id), agency_client_id: String(row.agency_client_id ?? '') } : null;
  }

  private async resolveLifecycleClient(lifecycleId: number): Promise<string> {
    const result = await this.db.query(
      `SELECT TRIM(COALESCE(ct.agency_client_id, '')) AS agency_client_id
         FROM crm_service_lifecycle sl
         INNER JOIN crm_contracts ct ON ct.id = sl.contract_id
        WHERE sl.id = $1
        LIMIT 1`,
      [lifecycleId],
    );
    return String(result.rows[0]?.agency_client_id ?? '').trim();
  }

  private async loadItem(lifecycleId: number, itemId: unknown) {
    if (itemId == null || itemId === '') return null;
    const id = Number(itemId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const result = await this.db.query(
      `SELECT title FROM cmkt_content_items
        WHERE lifecycle_id = $1 AND id = $2
        LIMIT 1`,
      [lifecycleId, id],
    );
    const title = nullableText(result.rows[0]?.title);
    return title ? { title } : null;
  }
}

function parseLifecycleId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    cpThrow(400, { error: 'lifecycle_id_required' });
  }
  return id;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
