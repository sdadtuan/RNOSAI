import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpBatchInput, CpBatchesService } from './cp-batches.service';
import { getPlaybook, listPlaybooks } from './cp-playbook.registry';
import { CpPlaybookRunInput } from './cp-playbook.types';
import { CpVideoScope } from './cp-videos.service';

export const CP_PLAYBOOKS_QUERY = 'CP_PLAYBOOKS_QUERY';

export interface CpPlaybooksQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpPlaybooksService {
  constructor(
    @Inject(CP_PLAYBOOKS_QUERY) private readonly db: CpPlaybooksQueryPort,
    private readonly batches: CpBatchesService,
  ) {}

  list() {
    return { items: listPlaybooks() };
  }

  async get(id: string) {
    const playbook = getPlaybook(id);
    const template = await this.findPublishedTemplate(playbook.template_slug);
    return {
      ...playbook,
      template_id: template?.id ?? null,
      template_status: template?.status ?? null,
    };
  }

  async cloneToTemplate(
    id: string,
    input: { name?: string; agency_client_id?: string | null } = {},
  ) {
    const playbook = getPlaybook(id);
    const source = await this.findPublishedTemplate(playbook.template_slug);
    if (!source) {
      cpThrow(409, { error: 'playbook_template_not_published', template_slug: playbook.template_slug });
    }
    const suffix = nullableText(input.agency_client_id);
    const defaultName = suffix
      ? `${playbook.label} · ${suffix.slice(0, 8)}`
      : `${playbook.label} · agency copy`;
    const name = nullableText(input.name) ?? defaultName;
    const result = await this.db.query(
      `INSERT INTO crm_cp_templates (
         tenant_id, name, version, variables_json, rules_json, brand_kit_id, status
       )
       SELECT $1, $2, 1, variables_json,
              COALESCE(rules_json, '{}'::jsonb) || $3::jsonb,
              brand_kit_id, 'draft'
         FROM crm_cp_templates
        WHERE id = $4::uuid
       RETURNING *`,
      [
        CP_TENANT_ID,
        name,
        JSON.stringify({
          playbook_id: playbook.id,
          cloned_from_template_id: source.id,
          qc_pack: playbook.qc_pack,
          self_serve: true,
        }),
        source.id,
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async run(
    id: string,
    input: CpPlaybookRunInput = {},
    scope: CpVideoScope = DEFAULT_SCOPE,
    createdBy = 0,
  ) {
    const playbook = getPlaybook(id);
    const template = await this.findPublishedTemplate(playbook.template_slug);
    if (!template) {
      cpThrow(409, { error: 'playbook_template_not_published', template_slug: playbook.template_slug });
    }
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (!rows.length && playbook.source === 're_project_products' && input.re_project_id != null) {
      cpThrow(400, { error: 'rows_required_for_re_project' });
    }
    const batchInput: CpBatchInput = {
      template_id: String(template.id),
      project_id: nullableUuid(input.project_id),
      rows,
      mapping: input.mapping,
      source: input.source ? { type: String(input.source) } : undefined,
    };
    const batch = await this.batches.create(batchInput, createdBy, scope) as Record<string, unknown> & {
      items?: unknown[];
    };
    return {
      playbook_id: playbook.id,
      batch_id: String(batch.id ?? ''),
      template_id: template.id,
      estimate_credits: batch.estimate_credits ?? null,
      item_count: Array.isArray(batch.items) ? batch.items.length : 0,
    };
  }

  private async findPublishedTemplate(slug: string) {
    const result = await this.db.query(
      `SELECT id, name, status, version
         FROM crm_cp_templates
        WHERE tenant_id = $1
          AND lower(name) = lower($2)
          AND status = 'published'
        ORDER BY version DESC, id DESC
        LIMIT 1`,
      [CP_TENANT_ID, slug],
    );
    return result.rows[0] ?? null;
  }
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableUuid(value: unknown): string | null {
  const id = String(value ?? '').trim();
  if (!id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error: 'invalid_project_id' });
  }
  return id;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
