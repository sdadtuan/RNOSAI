import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpPlaybooksService } from './cp-playbooks.service';
import { CpProjectsService } from './cp-projects.service';
import {
  mapReProductsToBatchRows,
  ReProjectProductRow,
  ReProjectRow,
} from './cp-re-product.mapper';
import { CpVideoScope } from './cp-videos.service';

export const CP_RE_HANDOFF_QUERY = 'CP_RE_HANDOFF_QUERY';

export interface CpReHandoffQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpReHandoffInput = {
  playbook_id?: string;
  product_ids?: Array<number | string>;
  agency_client_id?: string;
  hotline?: string;
  cta?: string;
  include_sold?: boolean;
};

export type CpReHandoffResult = {
  cp_project_id: string;
  batch_id: string;
  href: string;
  skipped: Array<{ id: number | string; reason: string }>;
};

@Injectable()
export class CpReHandoffService {
  constructor(
    @Inject(CP_RE_HANDOFF_QUERY) private readonly db: CpReHandoffQueryPort,
    private readonly projects: CpProjectsService,
    private readonly playbooks: CpPlaybooksService,
  ) {}

  async handoff(
    reProjectId: string | number,
    input: CpReHandoffInput = {},
    scope: CpVideoScope,
  ): Promise<CpReHandoffResult> {
    const projectId = parseReProjectId(reProjectId);
    const playbookId = String(input.playbook_id ?? 'bds_social_916');
    const reProject = await this.loadReProject(projectId);
    const products = await this.loadReProducts(projectId, input.product_ids);
    if (!products.length) cpThrow(400, { error: 'no_products_for_handoff' });

    const mapped = mapReProductsToBatchRows(products, reProject, {
      hotline: input.hotline,
      cta: input.cta,
      includeSold: input.include_sold === true,
    });
    if (!mapped.rows.length) {
      cpThrow(400, { error: 'no_valid_batch_rows', skipped: mapped.skipped });
    }

    const cpProject = await this.findOrCreateCpProject(
      projectId,
      reProject,
      input,
      scope,
    );
    const run = await this.playbooks.run(
      playbookId,
      {
        project_id: String(cpProject.id),
        rows: mapped.rows,
        re_project_id: projectId,
        source: 're_project_products',
      },
      scope,
      scope.staffId,
    );

    return {
      cp_project_id: String(cpProject.id),
      batch_id: String(run.batch_id),
      href: `/crm/creative-os/batch/${run.batch_id}`,
      skipped: mapped.skipped,
    };
  }

  private async loadReProject(projectId: number): Promise<ReProjectRow> {
    const exists = await this.tableExists('crm_re_projects');
    if (!exists) cpThrow(503, { error: 're_projects_unavailable' });
    const result = await this.db.query(
      `SELECT id, code, name, location_address, district, city
         FROM crm_re_projects
        WHERE id = $1
        LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0];
    if (!row) cpThrow(404, { error: 're_project_not_found' });
    return {
      id: Number(row.id),
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      location_address: String(row.location_address ?? ''),
      district: String(row.district ?? ''),
      city: String(row.city ?? ''),
    };
  }

  private async loadReProducts(
    projectId: number,
    productIds?: Array<number | string>,
  ): Promise<ReProjectProductRow[]> {
    const exists = await this.tableExists('crm_re_project_products');
    if (!exists) cpThrow(503, { error: 're_products_unavailable' });
    const filterIds = (productIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const result = filterIds.length
      ? await this.db.query(
        `SELECT *
           FROM crm_re_project_products
          WHERE project_id = $1 AND id = ANY($2::bigint[])
          ORDER BY zone, product_line, tower, unit_code`,
        [projectId, filterIds],
      )
      : await this.db.query(
        `SELECT *
           FROM crm_re_project_products
          WHERE project_id = $1
          ORDER BY zone, product_line, tower, unit_code`,
        [projectId],
      );
    return result.rows.map((row) => ({
      id: Number(row.id),
      project_id: Number(row.project_id),
      unit_code: String(row.unit_code ?? ''),
      tower: String(row.tower ?? ''),
      floor: String(row.floor ?? ''),
      zone: String(row.zone ?? ''),
      typology: String(row.typology ?? ''),
      list_price_vnd: Number(row.list_price_vnd ?? 0),
      net_price_vnd: Number(row.net_price_vnd ?? 0),
      status: String(row.status ?? 'available'),
    }));
  }

  private async findOrCreateCpProject(
    reProjectId: number,
    reProject: ReProjectRow,
    input: CpReHandoffInput,
    scope: CpVideoScope,
  ) {
    const tag = `re_project:${reProjectId}`;
    const existing = await this.db.query(
      `SELECT id, name, tags
         FROM crm_cp_projects
        WHERE tenant_id = $1 AND tags @> ARRAY[$2]::text[]
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [CP_TENANT_ID, tag],
    );
    if (existing.rows[0]) return existing.rows[0];

    const clientId = await this.resolveAgencyClientId(reProject, input);
    if (scope.staffId <= 0) cpThrow(400, { error: 'owner_staff_id_required' });
    const created = await this.projects.create(
      {
        name: `${String(reProject.name ?? 'RE Project')} · Creative Pack`,
        agency_client_id: clientId,
        owner_staff_id: scope.staffId,
        status: 'active',
        industry: 'real_estate',
        tags: [tag, `re-code:${String(reProject.code ?? reProjectId)}`],
      },
      scope.staffId,
    );
    return created;
  }

  private async resolveAgencyClientId(
    reProject: ReProjectRow,
    input: CpReHandoffInput,
  ): Promise<string> {
    const provided = String(input.agency_client_id ?? '').trim();
    if (provided) return requiredUuid(provided, 'invalid_agency_client_id');

    const code = String(reProject.code ?? `RE${reProject.id}`).trim().toUpperCase().slice(0, 32) || 'RE';
    const name = String(reProject.name ?? 'RE Project').trim() || code;
    const found = await this.db.query(
      `SELECT id FROM clients WHERE upper(code) = upper($1) LIMIT 1`,
      [code],
    );
    if (found.rows[0]?.id) return String(found.rows[0].id);

    const inserted = await this.db.query(
      `INSERT INTO clients (code, name, status, industry_slug)
       VALUES ($1, $2, 'active', 'real_estate')
       RETURNING id`,
      [code, name],
    );
    const id = inserted.rows[0]?.id;
    if (!id) cpThrow(500, { error: 'client_create_failed' });
    return String(id);
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT to_regclass($1::text) AS reg`,
      [`public.${tableName}`],
    );
    return result.rows[0]?.reg != null;
  }
}

function parseReProjectId(value: string | number): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) cpThrow(400, { error: 'invalid_re_project_id' });
  return id;
}

function requiredUuid(value: string, error: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    cpThrow(400, { error });
  }
  return value;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
