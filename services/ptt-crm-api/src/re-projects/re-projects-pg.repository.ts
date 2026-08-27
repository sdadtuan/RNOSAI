import { Injectable } from '@nestjs/common';
import { catalogTs } from '../catalog/catalog-slug.util';
import { computeKpiBoardStats, computeProductInventoryStats } from './re-projects-inventory.util';
import {
  currentPeriodMonth, KPI_CATEGORIES, KPI_METRIC_TEMPLATES, KPI_TRACK_STATUSES,
  mapReTrackToStaffStatus, parsePeriodMonth,
  RE_LEADS_NEW_EXCLUDED_STATUSES, RE_LEADS_NEW_METRIC_CODE,
} from './re-projects-kpi.util';
import {
  defaultBusinessPlan, defaultMarketingPlan, defaultSalesPlan, mergePlan, parseJsonPlan, slugTypeCode,
} from './re-projects-plan.util';
import { computeProjectWorkflow as buildProjectWorkflow } from './re-projects-workflow.util';
import { ReProjectsChannelsPgRepository } from './re-projects-channels-pg.repository';
import {
  BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS, CreateReProjectBody, DEFAULT_PROJECT_TYPE_LABELS,
  KPI_CATEGORY_LABELS, KPI_TRACK_STATUS_LABELS, PRICE_LIST_STATUSES, PRICE_LIST_STATUS_LABELS,
  PRODUCT_LINES, PRODUCT_LINE_LABELS, PRODUCT_STATUSES, PRODUCT_STATUS_LABELS, PRODUCT_TYPOLOGIES,
  PRODUCT_TYPOLOGY_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, RePriceListRow, ReProjectRow,
  ReProjectTypeRow, RISK_CATEGORIES, RISK_CATEGORY_LABELS, RISK_LEVELS, RISK_LEVEL_LABELS,
  SavePriceListBody, SaveProductBody, SaveProjectTypeBody,
} from './re-projects.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

@Injectable()
export class ReProjectsPgRepository extends ReProjectsChannelsPgRepository {
  private mapProjectRow(row: Record<string, unknown>, labels: Record<string, string>): ReProjectRow {
    const bp = mergePlan(parseJsonPlan(typeof row.business_plan_json === 'string'
      ? row.business_plan_json : JSON.stringify(row.business_plan_json ?? {}), defaultBusinessPlan()), defaultBusinessPlan());
    const mp = mergePlan(parseJsonPlan(typeof row.marketing_plan_json === 'string'
      ? row.marketing_plan_json : JSON.stringify(row.marketing_plan_json ?? {}), defaultMarketingPlan()), defaultMarketingPlan());
    const sp = mergePlan(parseJsonPlan(typeof row.sales_plan_json === 'string'
      ? row.sales_plan_json : JSON.stringify(row.sales_plan_json ?? {}), defaultSalesPlan()), defaultSalesPlan());
    const pt = text(row.project_type) || 'can_ho';
    const status = text(row.status) || 'planning';
    const total = Number(row.total_units ?? 0);
    const sold = Number(row.sold_units ?? 0);
    return {
      id: Number(row.id), code: text(row.code), name: text(row.name), project_type: pt,
      project_type_label: labels[pt] ?? DEFAULT_PROJECT_TYPE_LABELS[pt] ?? pt,
      status, status_label: PROJECT_STATUS_LABELS[status] ?? status,
      location_address: text(row.location_address), district: text(row.district), city: text(row.city),
      developer_name: text(row.developer_name), investor_name: text(row.investor_name),
      total_land_area_m2: row.total_land_area_m2 == null ? null : Number(row.total_land_area_m2),
      total_units: total, sold_units: sold, sell_through_pct: total ? Math.round(sold / total * 1000) / 10 : 0,
      revenue_target_vnd: Number(row.revenue_target_vnd ?? 0), start_date: text(row.start_date),
      presale_date: text(row.presale_date), handover_date: text(row.handover_date),
      description: text(row.description), notes: text(row.notes), business_plan: bp,
      marketing_plan: mp, sales_plan: sp, created_at: text(row.created_at), updated_at: text(row.updated_at),
    };
  }

  async listProjectTypes(includeInactive = false): Promise<ReProjectTypeRow[]> {
    const result = await this.query(
      `SELECT t.*,(SELECT COUNT(*)::int FROM crm_re_projects p WHERE lower(p.project_type)=lower(t.code)) project_count
       FROM crm_re_project_types t ${includeInactive ? '' : 'WHERE t.active=1'}
       ORDER BY t.sort_order,lower(t.name),t.id`,
    );
    return result.rows.map((r) => ({
      id: Number(r.id), code: text(r.code), name: text(r.name), description: text(r.description),
      sort_order: Number(r.sort_order ?? 0), active: Boolean(Number(r.active)),
      project_count: Number(r.project_count ?? 0), created_at: text(r.created_at), updated_at: text(r.updated_at),
    }));
  }

  async saveProjectType(payload: SaveProjectTypeBody, typeId?: number): Promise<ReProjectTypeRow> {
    const name = text(payload.name).trim();
    if (!name) throw new Error('Thiếu tên loại BĐS.');
    const ts = catalogTs();
    let id: number;
    if (typeId) {
      const prior = await this.query('SELECT * FROM crm_re_project_types WHERE id=$1', [typeId]);
      const row = prior.rows[0];
      if (!row) throw new Error('Không tìm thấy loại BĐS.');
      let code = text(row.code);
      if (payload.code != null) {
        const next = slugTypeCode(text(payload.code));
        if (next !== code) {
          const used = await this.query('SELECT COUNT(*)::int c FROM crm_re_projects WHERE lower(project_type)=lower($1)', [code]);
          if (Number(used.rows[0]?.c)) throw new Error('Không đổi mã khi đã có dự án đang dùng loại này.');
          code = next;
        }
      }
      try {
        await this.query(
          `UPDATE crm_re_project_types SET code=$1,name=$2,description=$3,sort_order=$4,
           active=$5,updated_at=$6 WHERE id=$7`,
          [code.slice(0, 40), name.slice(0, 120), text(payload.description).slice(0, 2000),
            Number(payload.sort_order ?? 0), payload.active == null ? Number(row.active) :
              payload.active === false || payload.active === 0 || payload.active === '0' ? 0 : 1, ts, typeId],
        );
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new Error('Mã loại BĐS đã tồn tại.');
        throw e;
      }
      id = typeId;
    } else {
      const code = slugTypeCode(text(payload.code ?? name));
      if (!code) throw new Error('Mã loại BĐS không hợp lệ.');
      try {
        const inserted = await this.query(
          `INSERT INTO crm_re_project_types(code,name,description,sort_order,active,created_at,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
          [code.slice(0, 40), name.slice(0, 120), text(payload.description).slice(0, 2000),
            Number(payload.sort_order ?? 0), payload.active === false || payload.active === 0 || payload.active === '0' ? 0 : 1, ts],
        );
        id = Number(inserted.rows[0].id);
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new Error('Mã loại BĐS đã tồn tại.');
        throw e;
      }
    }
    const row = (await this.listProjectTypes(true)).find((item) => item.id === id);
    if (!row) throw new Error('Không tìm thấy loại BĐS sau khi lưu.');
    return row;
  }

  async deleteProjectType(typeId: number): Promise<void> {
    const row = await this.query('SELECT code FROM crm_re_project_types WHERE id=$1', [typeId]);
    if (!row.rows[0]) throw new Error('Không tìm thấy loại BĐS.');
    const used = await this.query('SELECT COUNT(*)::int c FROM crm_re_projects WHERE lower(project_type)=lower($1)', [row.rows[0].code]);
    if (Number(used.rows[0]?.c)) throw new Error(`Không xóa được — còn ${used.rows[0].c} dự án đang dùng loại «${row.rows[0].code}».`);
    await this.query('DELETE FROM crm_re_project_types WHERE id=$1', [typeId]);
  }

  private async typeLabels(): Promise<Record<string, string>> {
    return Object.fromEntries((await this.listProjectTypes(true)).map((r) => [r.code, r.name]));
  }

  async listProjects(q = ''): Promise<ReProjectRow[]> {
    const params: unknown[] = [];
    let where = '';
    if (q.trim()) {
      params.push(`%${q.trim()}%`);
      where = 'WHERE name ILIKE $1 OR code ILIKE $1 OR district ILIKE $1 OR city ILIKE $1';
    }
    const [rows, labels] = await Promise.all([
      this.query(`SELECT * FROM crm_re_projects ${where} ORDER BY updated_at DESC,id DESC`, params),
      this.typeLabels(),
    ]);
    return rows.rows.map((r) => this.mapProjectRow(r, labels));
  }

  async fetchProject(projectId: number): Promise<ReProjectRow | null> {
    const [result, labels] = await Promise.all([
      this.query('SELECT * FROM crm_re_projects WHERE id=$1', [projectId]), this.typeLabels(),
    ]);
    return result.rows[0] ? this.mapProjectRow(result.rows[0], labels) : null;
  }

  private async validateProjectType(code: string, allowInactive = false): Promise<string> {
    const result = await this.query(
      `SELECT code,active FROM crm_re_project_types WHERE lower(code)=lower($1)`, [code.trim()],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Loại BĐS không tồn tại.');
    if (!allowInactive && !Number(row.active)) throw new Error('Loại BĐS đang tắt — không thể gán cho dự án mới.');
    return text(row.code);
  }

  async createProject(payload: CreateReProjectBody): Promise<ReProjectRow> {
    const name = text(payload.name).trim();
    if (!name) throw new Error('Thiếu tên dự án.');
    const projectType = await this.validateProjectType(text(payload.project_type) || 'can_ho');
    const status = (PROJECT_STATUSES as readonly string[]).includes(text(payload.status)) ? text(payload.status) : 'planning';
    const ts = catalogTs();
    const result = await this.query(
      `INSERT INTO crm_re_projects(code,name,project_type,status,location_address,district,city,
       developer_name,investor_name,total_land_area_m2,total_units,sold_units,revenue_target_vnd,
       start_date,presale_date,handover_date,description,notes,business_plan_json,marketing_plan_json,
       sales_plan_json,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)
       RETURNING id`,
      [text(payload.code).slice(0, 40), name.slice(0, 240), projectType, status,
        text(payload.location_address).slice(0, 500), text(payload.district).slice(0, 120),
        text(payload.city).slice(0, 120), text(payload.developer_name).slice(0, 240),
        text(payload.investor_name).slice(0, 240), payload.total_land_area_m2 ?? null,
        Number(payload.total_units ?? 0), Number(payload.sold_units ?? 0), Number(payload.revenue_target_vnd ?? 0),
        text(payload.start_date).slice(0, 10), text(payload.presale_date).slice(0, 10),
        text(payload.handover_date).slice(0, 10), text(payload.description).slice(0, 4000),
        text(payload.notes).slice(0, 4000), JSON.stringify(payload.business_plan ?? defaultBusinessPlan()),
        JSON.stringify(payload.marketing_plan ?? defaultMarketingPlan()),
        JSON.stringify(payload.sales_plan ?? defaultSalesPlan()), ts],
    );
    const project = await this.fetchProject(Number(result.rows[0].id));
    if (!project) throw new Error('Không tạo được dự án.');
    return project;
  }

  async updateProject(projectId: number, payload: CreateReProjectBody): Promise<ReProjectRow> {
    const prev = await this.fetchProject(projectId);
    if (!prev) throw new Error('Không tìm thấy dự án.');
    const merged = { ...prev, ...payload } as Record<string, unknown>;
    const projectType = payload.project_type != null
      ? await this.validateProjectType(text(payload.project_type), true) : prev.project_type;
    const status = (PROJECT_STATUSES as readonly string[]).includes(text(merged.status)) ? text(merged.status) : prev.status;
    await this.query(
      `UPDATE crm_re_projects SET code=$1,name=$2,project_type=$3,status=$4,location_address=$5,
       district=$6,city=$7,developer_name=$8,investor_name=$9,total_land_area_m2=$10,total_units=$11,
       sold_units=$12,revenue_target_vnd=$13,start_date=$14,presale_date=$15,handover_date=$16,
       description=$17,notes=$18,business_plan_json=$19,marketing_plan_json=$20,
       sales_plan_json=$21,updated_at=$22 WHERE id=$23`,
      [text(merged.code).slice(0, 40), text(merged.name).slice(0, 240), projectType, status,
        text(merged.location_address).slice(0, 500), text(merged.district).slice(0, 120),
        text(merged.city).slice(0, 120), text(merged.developer_name).slice(0, 240),
        text(merged.investor_name).slice(0, 240), merged.total_land_area_m2 ?? null,
        Number(merged.total_units ?? 0), Number(merged.sold_units ?? 0), Number(merged.revenue_target_vnd ?? 0),
        text(merged.start_date).slice(0, 10), text(merged.presale_date).slice(0, 10),
        text(merged.handover_date).slice(0, 10), text(merged.description).slice(0, 4000),
        text(merged.notes).slice(0, 4000), JSON.stringify(payload.business_plan ?? prev.business_plan),
        JSON.stringify(payload.marketing_plan ?? prev.marketing_plan), JSON.stringify(payload.sales_plan ?? prev.sales_plan),
        catalogTs(), projectId],
    );
    return (await this.fetchProject(projectId))!;
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.query('DELETE FROM crm_re_projects WHERE id=$1', [projectId]);
  }

  private async staffMap(ids: number[]): Promise<Record<number, Record<string, unknown>>> {
    const clean = [...new Set(ids.filter((id) => id > 0))];
    if (!clean.length) return {};
    const result = await this.query('SELECT id,name,COALESCE(job_title,\'\') job_title,COALESCE(department,\'\') department FROM crm_staff WHERE id=ANY($1)', [clean]);
    return Object.fromEntries(result.rows.map((r) => [Number(r.id), r]));
  }

  private enrichProduct(row: Record<string, unknown>, staff: Record<number, Record<string, unknown>>): Record<string, unknown> {
    const d: Record<string, unknown> = { ...row, id: Number(row.id), project_id: Number(row.project_id) };
    const status = text(d.status) || 'available';
    d.status_label = PRODUCT_STATUS_LABELS[status] ?? status;
    d.product_line_label = PRODUCT_LINE_LABELS[text(d.product_line)] ?? (text(d.product_line) || '—');
    d.typology_label = PRODUCT_TYPOLOGY_LABELS[text(d.typology)] ?? (text(d.typology) || '—');
    const person = staff[Number(d.sales_staff_id ?? 0)];
    d.sales_staff_name = text(person?.name); d.sales_staff_title = text(person?.job_title);
    return d;
  }

  async listProducts(projectId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.query(
      'SELECT * FROM crm_re_project_products WHERE project_id=$1 ORDER BY zone,product_line,tower,unit_code',
      [projectId],
    );
    const staff = await this.staffMap(result.rows.map((r) => Number(r.sales_staff_id ?? 0)));
    return result.rows.map((r) => this.enrichProduct(r, staff));
  }

  async saveProduct(projectId: number, payload: SaveProductBody, productId?: number): Promise<Record<string, unknown>> {
    let status = text(payload.status) || 'available';
    if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) status = 'available';
    let line = text(payload.product_line);
    if (line && !(PRODUCT_LINES as readonly string[]).includes(line)) line = 'other';
    let typology = text(payload.typology);
    if (typology && !(PRODUCT_TYPOLOGIES as readonly string[]).includes(typology)) typology = 'other';
    const values: unknown[] = [
      text(payload.unit_code).slice(0, 40), text(payload.tower).slice(0, 40), text(payload.floor).slice(0, 20),
      line, text(payload.zone).slice(0, 60), typology,
      payload.is_corner === true || payload.is_corner === 1 || payload.is_corner === '1' ||
        payload.is_corner === 'true' || payload.is_corner === 'on' ? 1 : 0,
      Number(payload.sales_staff_id ?? 0) > 0 ? Number(payload.sales_staff_id) : null,
      text(payload.product_type).slice(0, 80), payload.area_m2 ?? null, payload.bedrooms ?? null,
      text(payload.direction).slice(0, 40), text(payload.view_type).slice(0, 80),
      Number(payload.list_price_vnd ?? 0), Number(payload.net_price_vnd ?? 0), status,
      text(payload.notes).slice(0, 2000), text(payload.price_batch).slice(0, 80), catalogTs(),
    ];
    let id: number;
    if (productId) {
      await this.query(
        `UPDATE crm_re_project_products SET unit_code=$1,tower=$2,floor=$3,product_line=$4,zone=$5,
         typology=$6,is_corner=$7,sales_staff_id=$8,product_type=$9,area_m2=$10,bedrooms=$11,
         direction=$12,view_type=$13,list_price_vnd=$14,net_price_vnd=$15,status=$16,notes=$17,
         price_batch=$18,updated_at=$19 WHERE id=$20 AND project_id=$21`,
        [...values, productId, projectId],
      );
      id = productId;
    } else {
      const result = await this.query(
        `INSERT INTO crm_re_project_products(project_id,unit_code,tower,floor,product_line,zone,typology,
         is_corner,sales_staff_id,product_type,area_m2,bedrooms,direction,view_type,list_price_vnd,
         net_price_vnd,status,notes,price_batch,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20) RETURNING id`,
        [projectId, ...values],
      );
      id = Number(result.rows[0].id);
    }
    const row = await this.query('SELECT * FROM crm_re_project_products WHERE id=$1', [id]);
    if (!row.rows[0]) throw new Error('Không lưu được sản phẩm.');
    return this.enrichProduct(row.rows[0], await this.staffMap([Number(row.rows[0].sales_staff_id ?? 0)]));
  }

  async deleteProduct(projectId: number, productId: number): Promise<void> {
    await this.query('DELETE FROM crm_re_project_products WHERE id=$1 AND project_id=$2', [productId, projectId]);
  }

  private enrichKpi(row: Record<string, unknown>, staff: Record<number, Record<string, unknown>>): Record<string, unknown> {
    const d: Record<string, unknown> = { ...row, id: Number(row.id), project_id: Number(row.project_id) };
    const category = text(d.category); const target = Number(d.target_value ?? 0); const actual = Number(d.actual_value ?? 0);
    const track = (KPI_TRACK_STATUSES as readonly string[]).includes(text(d.track_status)) ? text(d.track_status) : 'active';
    const person = staff[Number(d.owner_staff_id ?? 0)];
    d.category_label = KPI_CATEGORY_LABELS[category] ?? category; d.achievement_pct = target ? Math.round(actual / target * 1000) / 10 : 0;
    d.track_status = track; d.track_status_label = KPI_TRACK_STATUS_LABELS[track] ?? track;
    d.owner_display = text(person?.name) || text(d.owner_name); d.owner_job_title = text(person?.job_title);
    d.owner_department = text(person?.department); d.synced_to_staff = Number(d.staff_kpi_id ?? 0) > 0;
    return d;
  }

  async listKpis(projectId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.query('SELECT * FROM crm_re_project_kpis WHERE project_id=$1 ORDER BY period_month DESC,owner_staff_id,id', [projectId]);
    const staff = await this.staffMap(result.rows.map((r) => Number(r.owner_staff_id ?? 0)));
    return result.rows.map((r) => this.enrichKpi(r, staff));
  }

  private async resolveMetric(payload: Record<string, unknown>, name: string, unit: string) {
    const id = Number(payload.metric_id ?? 0);
    if (id > 0) {
      const found = await this.query('SELECT id,code,name,unit FROM crm_kpi_metrics WHERE id=$1 AND active=1', [id]);
      if (found.rows[0]) return found.rows[0];
    }
    const codes = [text(payload.metric_code), ...KPI_METRIC_TEMPLATES
      .filter((t) => t.code === payload.metric_code || t.metric_name === name).map((t) => t.crm_code)].filter(Boolean);
    for (const code of codes) {
      const found = await this.query('SELECT id,code,name,unit FROM crm_kpi_metrics WHERE lower(trim(code))=lower($1) AND active=1', [code]);
      if (found.rows[0]) return found.rows[0];
    }
    return { id: null, code: text(payload.metric_code).slice(0, 40), name, unit };
  }

  private async syncKpi(kpiId: number, projectId: number, ts = catalogTs()): Promise<boolean> {
    const found = await this.query('SELECT * FROM crm_re_project_kpis WHERE id=$1 AND project_id=$2', [kpiId, projectId]);
    const row = found.rows[0];
    if (!row || Number(row.owner_staff_id ?? 0) <= 0 || Number(row.metric_id ?? 0) <= 0) return false;
    const { year, month } = parsePeriodMonth(text(row.period_month));
    if (year == null || month == null) return false;
    const project = await this.fetchProject(projectId);
    const note = `[Dự án BĐS: ${project?.name ?? ''} (#${projectId})] ${text(row.notes).trim()}`.trim().slice(0, 2000);
    try {
      const saved = await this.query(
        `INSERT INTO crm_staff_kpi(staff_id,metric_id,year,month,target_value,actual_value,status,note,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT(staff_id,metric_id,year,month) DO UPDATE SET target_value=EXCLUDED.target_value,
         actual_value=EXCLUDED.actual_value,status=EXCLUDED.status,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at
         RETURNING id`,
        [Number(row.owner_staff_id), Number(row.metric_id), year, month, Number(row.target_value ?? 0),
          Number(row.actual_value ?? 0), mapReTrackToStaffStatus(text(row.track_status)), note,
          new Date().toISOString().slice(0, 10), ts],
      );
      await this.query('UPDATE crm_re_project_kpis SET staff_kpi_id=$1,updated_at=$2 WHERE id=$3', [saved.rows[0].id, ts, kpiId]);
      return true;
    } catch {
      return false;
    }
  }

  async saveKpi(projectId: number, payload: Record<string, unknown>, kpiId?: number, ts = catalogTs()): Promise<Record<string, unknown>> {
    let category = text(payload.category) || 'sales';
    if (!(KPI_CATEGORIES as readonly string[]).includes(category)) category = 'sales';
    const rawName = text(payload.metric_name).trim();
    if (!rawName) throw new Error('Thiếu tên chỉ tiêu KPI.');
    const staffId = Number(payload.owner_staff_id ?? 0) > 0 ? Number(payload.owner_staff_id) : null;
    let ownerName = text(payload.owner_name).trim();
    if (staffId) {
      const staff = await this.staffMap([staffId]); ownerName = text(staff[staffId]?.name) || ownerName;
    }
    let track = text(payload.track_status) || 'active';
    if (!(KPI_TRACK_STATUSES as readonly string[]).includes(track)) track = 'active';
    const metric = await this.resolveMetric(payload, rawName, text(payload.unit).slice(0, 40));
    const values = [category, text(metric.name).slice(0, 200), Number(payload.target_value ?? 0),
      Number(payload.actual_value ?? 0), text(metric.unit).slice(0, 40), text(payload.period_month).slice(0, 7),
      Number(payload.weight_pct ?? 0), staffId, ownerName.slice(0, 120), track, text(metric.code), metric.id,
      text(payload.notes).slice(0, 2000), ts];
    let id: number;
    if (kpiId) {
      await this.query(
        `UPDATE crm_re_project_kpis SET category=$1,metric_name=$2,target_value=$3,actual_value=$4,
         unit=$5,period_month=$6,weight_pct=$7,owner_staff_id=$8,owner_name=$9,track_status=$10,
         metric_code=$11,metric_id=$12,notes=$13,updated_at=$14 WHERE id=$15 AND project_id=$16`,
        [...values, kpiId, projectId],
      ); id = kpiId;
    } else {
      const saved = await this.query(
        `INSERT INTO crm_re_project_kpis(project_id,category,metric_name,target_value,actual_value,unit,
         period_month,weight_pct,owner_staff_id,owner_name,track_status,metric_code,metric_id,notes,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
        [projectId, ...values],
      ); id = Number(saved.rows[0].id);
    }
    if (staffId && metric.id) await this.syncKpi(id, projectId, ts);
    const row = (await this.listKpis(projectId)).find((r) => Number(r.id) === id);
    if (!row) throw new Error('Không lưu được KPI.');
    return row;
  }

  async deleteKpi(projectId: number, kpiId: number): Promise<void> {
    await this.query('DELETE FROM crm_re_project_kpis WHERE id=$1 AND project_id=$2', [kpiId, projectId]);
  }

  async listCrmKpiMetrics(reOnly = false): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.query(`SELECT * FROM crm_kpi_metrics WHERE active=1 ${reOnly ? "AND code LIKE 'RE_%'" : ''} ORDER BY sort_order,lower(name)`);
      return result.rows;
    } catch { return []; }
  }

  async syncProjectKpisToStaff(projectId: number, ts = catalogTs()): Promise<Record<string, unknown>> {
    const result = await this.query('SELECT id FROM crm_re_project_kpis WHERE project_id=$1 ORDER BY id', [projectId]);
    let synced = 0;
    for (const row of result.rows) if (await this.syncKpi(Number(row.id), projectId, ts)) synced += 1;
    return { synced, skipped: result.rows.length - synced, total: result.rows.length };
  }

  async pullProjectKpisFromStaff(projectId: number, ts = catalogTs()): Promise<Record<string, unknown>> {
    const result = await this.query(
      `UPDATE crm_re_project_kpis r SET actual_value=s.actual_value,
       track_status=CASE s.status WHEN 'draft' THEN 'draft' WHEN 'at_risk' THEN 'active'
         WHEN 'achieved' THEN 'completed' WHEN 'missed' THEN 'cancelled' ELSE 'active' END,
       updated_at=$2 FROM crm_staff_kpi s WHERE r.project_id=$1 AND r.staff_kpi_id=s.id RETURNING r.id`,
      [projectId, ts],
    );
    const total = await this.query('SELECT COUNT(*)::int c FROM crm_re_project_kpis WHERE project_id=$1 AND staff_kpi_id IS NOT NULL', [projectId]);
    return { updated: result.rowCount ?? 0, total_linked: Number(total.rows[0]?.c ?? 0) };
  }

  async refreshProjectReLeadsNewKpi(projectId: number, options: { periodMonth?: string; ts?: string; syncStaff?: boolean } = {}): Promise<Record<string, unknown>> {
    await this.validateProjectExists(projectId);
    const period = text(options.periodMonth).slice(0, 7) || currentPeriodMonth();
    const ts = options.ts ?? catalogTs();
    const count = await this.query(
      `SELECT COUNT(*)::int c FROM crm_leads WHERE re_project_id=$1 AND COALESCE(is_duplicate,0)=0
       AND NOT (status = ANY($2::text[])) AND substring(COALESCE(created_at::text,''),1,7)=$3`,
      [projectId, [...RE_LEADS_NEW_EXCLUDED_STATUSES], period],
    ).catch(() => ({ rows: [{ c: 0 }] } as any));
    const actual = Number(count.rows[0]?.c ?? 0);
    const existing = await this.query(
      'SELECT id FROM crm_re_project_kpis WHERE project_id=$1 AND metric_code=$2 AND period_month=$3 ORDER BY id DESC LIMIT 1',
      [projectId, RE_LEADS_NEW_METRIC_CODE, period],
    );
    let id = existing.rows[0] ? Number(existing.rows[0].id) : 0;
    if (id) await this.query('UPDATE crm_re_project_kpis SET actual_value=$1,updated_at=$2 WHERE id=$3', [actual, ts, id]);
    else {
      const template = KPI_METRIC_TEMPLATES.find((item) => item.crm_code === RE_LEADS_NEW_METRIC_CODE);
      if (template) {
        const saved = await this.query(
          `INSERT INTO crm_re_project_kpis(project_id,category,metric_name,target_value,actual_value,unit,
           period_month,weight_pct,owner_name,track_status,metric_code,notes,created_at,updated_at)
           VALUES($1,$2,$3,0,$4,$5,$6,$7,'','active',$8,'',$9,$9) RETURNING id`,
          [projectId, template.category, template.metric_name, actual, template.unit, period,
            template.weight_pct, RE_LEADS_NEW_METRIC_CODE, ts],
        ); id = Number(saved.rows[0].id);
      }
    }
    if (id && options.syncStaff !== false) await this.syncKpi(id, projectId, ts);
    return { updated: id > 0, kpi_id: id || null, actual, period_month: period, project_id: projectId };
  }

  private enrichRisk(row: Record<string, unknown>): Record<string, unknown> {
    const category = text(row.category); const level = text(row.risk_level);
    return { ...row, id: Number(row.id), project_id: Number(row.project_id),
      category_label: RISK_CATEGORY_LABELS[category] ?? category, risk_level_label: RISK_LEVEL_LABELS[level] ?? level,
      score: Math.round(Number(row.probability_pct ?? 0) * Number(row.impact_pct ?? 0) / 100 * 10) / 10 };
  }

  async listRisks(projectId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.query('SELECT * FROM crm_re_project_risks WHERE project_id=$1 ORDER BY risk_level DESC,id', [projectId]);
    return result.rows.map((r) => this.enrichRisk(r));
  }

  async saveRisk(projectId: number, payload: Record<string, unknown>, riskId?: number, ts = catalogTs()): Promise<Record<string, unknown>> {
    const title = text(payload.title).trim(); if (!title) throw new Error('Thiếu tiêu đề rủi ro.');
    const category = (RISK_CATEGORIES as readonly string[]).includes(text(payload.category)) ? text(payload.category) : 'market';
    const level = (RISK_LEVELS as readonly string[]).includes(text(payload.risk_level)) ? text(payload.risk_level) : 'medium';
    const values = [category, title.slice(0, 200), text(payload.description).slice(0, 4000),
      Number(payload.probability_pct ?? 0), Number(payload.impact_pct ?? 0), level,
      text(payload.mitigation).slice(0, 4000), text(payload.owner_name).slice(0, 120),
      (text(payload.status) || 'open').slice(0, 40), text(payload.due_date).slice(0, 10), ts];
    let id: number;
    if (riskId) {
      await this.query(
        `UPDATE crm_re_project_risks SET category=$1,title=$2,description=$3,probability_pct=$4,
         impact_pct=$5,risk_level=$6,mitigation=$7,owner_name=$8,status=$9,due_date=$10,
         updated_at=$11 WHERE id=$12 AND project_id=$13`, [...values, riskId, projectId],
      ); id = riskId;
    } else {
      const saved = await this.query(
        `INSERT INTO crm_re_project_risks(project_id,category,title,description,probability_pct,impact_pct,
         risk_level,mitigation,owner_name,status,due_date,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`, [projectId, ...values],
      ); id = Number(saved.rows[0].id);
    }
    const row = await this.query('SELECT * FROM crm_re_project_risks WHERE id=$1', [id]);
    if (!row.rows[0]) throw new Error('Không lưu được rủi ro.');
    return this.enrichRisk(row.rows[0]);
  }

  async deleteRisk(projectId: number, riskId: number): Promise<void> {
    await this.query('DELETE FROM crm_re_project_risks WHERE id=$1 AND project_id=$2', [riskId, projectId]);
  }

  private enrichBudget(row: Record<string, unknown>): Record<string, unknown> {
    const planned = Number(row.planned_vnd ?? 0); const actual = Number(row.actual_vnd ?? 0); const category = text(row.category);
    return { ...row, id: Number(row.id), project_id: Number(row.project_id),
      category_label: BUDGET_CATEGORY_LABELS[category] ?? category, variance_vnd: actual - planned,
      variance_pct: planned ? Math.round((actual - planned) / planned * 1000) / 10 : 0 };
  }

  async listBudgetLines(projectId: number): Promise<Array<Record<string, unknown>>> {
    const result = await this.query('SELECT * FROM crm_re_project_budget_lines WHERE project_id=$1 ORDER BY period_month,category,id', [projectId]);
    return result.rows.map((r) => this.enrichBudget(r));
  }

  async saveBudgetLine(projectId: number, payload: Record<string, unknown>, lineId?: number, ts = catalogTs()): Promise<Record<string, unknown>> {
    const item = text(payload.line_item).trim(); if (!item) throw new Error('Thiếu hạng mục ngân sách.');
    const category = (BUDGET_CATEGORIES as readonly string[]).includes(text(payload.category)) ? text(payload.category) : 'revenue';
    const values = [category, item.slice(0, 200), text(payload.period_month).slice(0, 7),
      Number(payload.planned_vnd ?? 0), Number(payload.actual_vnd ?? 0), text(payload.notes).slice(0, 2000), ts];
    let id: number;
    if (lineId) {
      await this.query(
        `UPDATE crm_re_project_budget_lines SET category=$1,line_item=$2,period_month=$3,planned_vnd=$4,
         actual_vnd=$5,notes=$6,updated_at=$7 WHERE id=$8 AND project_id=$9`, [...values, lineId, projectId],
      ); id = lineId;
    } else {
      const saved = await this.query(
        `INSERT INTO crm_re_project_budget_lines(project_id,category,line_item,period_month,planned_vnd,
         actual_vnd,notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
        [projectId, ...values],
      ); id = Number(saved.rows[0].id);
    }
    const row = await this.query('SELECT * FROM crm_re_project_budget_lines WHERE id=$1', [id]);
    if (!row.rows[0]) throw new Error('Không lưu được dòng ngân sách.');
    return this.enrichBudget(row.rows[0]);
  }

  async deleteBudgetLine(projectId: number, lineId: number): Promise<void> {
    await this.query('DELETE FROM crm_re_project_budget_lines WHERE id=$1 AND project_id=$2', [lineId, projectId]);
  }

  async fetchProjectSummary(projectId: number): Promise<Record<string, unknown>> {
    const [project, products, kpis, risks, budget] = await Promise.all([
      this.fetchProject(projectId), this.listProducts(projectId), this.listKpis(projectId),
      this.listRisks(projectId), this.listBudgetLines(projectId),
    ]);
    if (!project) throw new Error('Không tìm thấy dự án.');
    const sum = (category: (row: Record<string, unknown>) => boolean, field: string) =>
      budget.filter(category).reduce((n, row) => n + Number(row[field] ?? 0), 0);
    const revPlanned = sum((r) => r.category === 'revenue', 'planned_vnd');
    const revActual = sum((r) => r.category === 'revenue', 'actual_vnd');
    const costPlanned = sum((r) => r.category !== 'revenue', 'planned_vnd');
    const costActual = sum((r) => r.category !== 'revenue', 'actual_vnd');
    const inventory = computeProductInventoryStats(products); const board = computeKpiBoardStats(kpis);
    return {
      project, product_count: products.length, products_available: products.filter((p) => p.status === 'available').length,
      products_sold: products.filter((p) => p.status === 'sold').length,
      product_lines_count: ((inventory.by_product_line as unknown[]) ?? []).length,
      product_zones_count: ((inventory.by_zone as unknown[]) ?? []).length, kpi_count: kpis.length,
      kpi_with_owner_count: kpis.filter((k) => Number(k.owner_staff_id ?? 0) || text(k.owner_name).trim()).length,
      kpi_avg_achievement_pct: kpis.length ? Math.round(kpis.reduce((n, k) => n + Number(k.achievement_pct ?? 0), 0) / kpis.length * 10) / 10 : 0,
      kpi_weight_total_pct: board.weight_total_pct ?? 0, inventory, kpi_board: board, risk_count: risks.length,
      high_risk_count: risks.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length,
      budget_revenue_planned_vnd: revPlanned, budget_revenue_actual_vnd: revActual,
      budget_cost_planned_vnd: costPlanned, budget_cost_actual_vnd: costActual,
      profit_planned_vnd: revPlanned - costPlanned, profit_actual_vnd: revActual - costActual,
    };
  }

  async listProjectZones(projectId: number): Promise<string[]> {
    const result = await this.query(
      `SELECT DISTINCT trim(zone) z FROM crm_re_project_products WHERE project_id=$1 AND trim(COALESCE(zone,''))<>'' ORDER BY z`,
      [projectId],
    );
    return result.rows.map((r) => text(r.z)).filter(Boolean);
  }

  async inventoryByZoneSummary(projectId: number): Promise<Array<Record<string, unknown>>> {
    const products = await this.listProducts(projectId); const inventory = computeProductInventoryStats(products);
    const byLine = Object.fromEntries(((inventory.by_product_line as Array<Record<string, unknown>>) ?? []).map((r) => [text(r.key), r]));
    return ((inventory.by_zone as Array<Record<string, unknown>>) ?? []).map((zone) => {
      const lines: Record<string, number> = {};
      for (const p of products.filter((x) => (text(x.zone).trim() || 'Chưa phân khu') === text(zone.key))) {
        const key = text(p.product_line) || 'other'; lines[key] = (lines[key] ?? 0) + 1;
      }
      return { ...zone, product_lines: Object.entries(lines).sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ product_line: key, label: PRODUCT_LINE_LABELS[key] ?? key, count, stats: byLine[key] })) };
    });
  }

  async listPriceBatches(projectId: number): Promise<string[]> {
    const result = await this.query(
      `SELECT DISTINCT trim(price_batch) b FROM crm_re_project_products
       WHERE project_id=$1 AND trim(COALESCE(price_batch,''))<>'' ORDER BY b DESC`, [projectId],
    );
    return result.rows.map((r) => text(r.b)).filter(Boolean);
  }

  async inventoryByPriceBatchSummary(projectId: number): Promise<Array<Record<string, unknown>>> {
    const buckets: Record<string, Record<string, unknown>> = {};
    for (const product of await this.listProducts(projectId)) {
      const key = text(product.price_batch).trim() || 'Chưa gán đợt';
      const bucket = buckets[key] ??= { key, label: key, total: 0, available: 0, sold: 0, hold: 0, booked: 0 };
      bucket.total = Number(bucket.total) + 1;
      const status = text(product.status); if (status in bucket) bucket[status] = Number(bucket[status]) + 1;
    }
    return Object.values(buckets);
  }

  private mapPriceList(row: Record<string, unknown>): RePriceListRow {
    const status = (PRICE_LIST_STATUSES as readonly string[]).includes(text(row.status)) ? text(row.status) : 'draft';
    return {
      id: Number(row.id), project_id: Number(row.project_id), version_code: text(row.version_code),
      name: text(row.name), effective_date: text(row.effective_date), status,
      status_label: PRICE_LIST_STATUS_LABELS[status] ?? status, notes: text(row.notes),
      applied_at: text(row.applied_at), applied_by: text(row.applied_by), created_by: text(row.created_by),
      created_at: text(row.created_at), updated_at: text(row.updated_at), item_count: Number(row.item_count ?? 0),
    };
  }

  async listPriceLists(projectId: number): Promise<RePriceListRow[]> {
    const result = await this.query(
      `SELECT p.*,(SELECT COUNT(*)::int FROM crm_re_price_list_items i WHERE i.price_list_id=p.id) item_count
       FROM crm_re_price_lists p WHERE p.project_id=$1 ORDER BY p.effective_date DESC,p.updated_at DESC,p.id DESC`,
      [projectId],
    );
    return result.rows.map((r) => this.mapPriceList(r));
  }

  async fetchPriceList(projectId: number, listId: number): Promise<RePriceListRow | null> {
    const result = await this.query(
      `SELECT p.*,(SELECT COUNT(*)::int FROM crm_re_price_list_items i WHERE i.price_list_id=p.id) item_count
       FROM crm_re_price_lists p WHERE p.id=$1 AND p.project_id=$2`, [listId, projectId],
    );
    return result.rows[0] ? this.mapPriceList(result.rows[0]) : null;
  }

  async listPriceListItems(priceListId: number, limit = 500, offset = 0): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const [rows, total] = await Promise.all([
      this.query('SELECT * FROM crm_re_price_list_items WHERE price_list_id=$1 ORDER BY lower(unit_code) LIMIT $2 OFFSET $3',
        [priceListId, Math.max(1, Math.min(limit, 2000)), Math.max(0, offset)]),
      this.query('SELECT COUNT(*)::int c FROM crm_re_price_list_items WHERE price_list_id=$1', [priceListId]),
    ]);
    return { items: rows.rows.map((r) => ({ ...r, id: Number(r.id), price_list_id: Number(r.price_list_id),
      list_price_vnd: Number(r.list_price_vnd ?? 0), net_price_vnd: Number(r.net_price_vnd ?? 0) })),
      total: Number(total.rows[0]?.c ?? 0) };
  }

  async savePriceList(projectId: number, payload: SavePriceListBody, listId?: number, createdBy = ''): Promise<RePriceListRow> {
    await this.validateProjectExists(projectId);
    const version = text(payload.version_code ?? payload.code).trim().slice(0, 80);
    if (!version) throw new Error('Thiếu mã version (version_code).');
    const ts = catalogTs(); let id: number;
    try {
      if (listId) {
        const current = await this.fetchPriceList(projectId, listId);
        if (!current) throw new Error('Không tìm thấy bảng giá.');
        let status = current.status;
        if (payload.status != null) {
          const next = text(payload.status).toLowerCase();
          if (!(PRICE_LIST_STATUSES as readonly string[]).includes(next)) throw new Error(`Trạng thái không hợp lệ: ${payload.status}`);
          if (next === 'active' && current.status !== 'active') throw new Error('Dùng «Áp dụng bảng giá» để kích hoạt — không đổi status trực tiếp.');
          if (current.status !== 'active') status = next;
        }
        await this.query(
          `UPDATE crm_re_price_lists SET version_code=$1,name=$2,effective_date=$3,status=$4,
           notes=$5,updated_at=$6 WHERE id=$7 AND project_id=$8`,
          [version, (text(payload.name) || version).slice(0, 200), text(payload.effective_date).slice(0, 10),
            status, text(payload.notes).slice(0, 2000), ts, listId, projectId],
        ); id = listId;
      } else {
        const saved = await this.query(
          `INSERT INTO crm_re_price_lists(project_id,version_code,name,effective_date,status,notes,
           applied_at,applied_by,created_by,created_at,updated_at)
           VALUES($1,$2,$3,$4,'draft',$5,'','',$6,$7,$7) RETURNING id`,
          [projectId, version, (text(payload.name) || version).slice(0, 200),
            text(payload.effective_date).slice(0, 10), text(payload.notes).slice(0, 2000), createdBy.slice(0, 120), ts],
        ); id = Number(saved.rows[0].id);
      }
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new Error(`Mã version «${version}» đã tồn tại.`);
      throw e;
    }
    return (await this.fetchPriceList(projectId, id))!;
  }

  async deletePriceList(projectId: number, listId: number): Promise<void> {
    const row = await this.fetchPriceList(projectId, listId);
    if (!row) throw new Error('Không tìm thấy bảng giá.');
    if (row.status === 'active') throw new Error('Không xóa bảng giá đang áp dụng — lưu trữ hoặc áp bảng khác trước.');
    await this.query('DELETE FROM crm_re_price_lists WHERE id=$1 AND project_id=$2', [listId, projectId]);
  }

  async listAllVersionCodes(projectId: number): Promise<string[]> {
    const [lists, batches] = await Promise.all([this.listPriceLists(projectId), this.listPriceBatches(projectId)]);
    return [...new Set([...lists.map((r) => r.version_code), ...batches].filter(Boolean))]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  async computeProjectWorkflow(projectId: number): Promise<Record<string, unknown>> {
    const [project, summary] = await Promise.all([this.fetchProject(projectId), this.fetchProjectSummary(projectId)]);
    if (!project) throw new Error('Không tìm thấy dự án.');
    return buildProjectWorkflow(projectId, project, summary);
  }

  async fetchProjectExportData(projectId: number): Promise<{
    project: ReProjectRow; summary: Record<string, unknown>; workflow: Record<string, unknown>;
    kpis: Array<Record<string, unknown>>; products: Array<Record<string, unknown>>;
    risks: Array<Record<string, unknown>>; budget: Array<Record<string, unknown>>;
  }> {
    const project = await this.fetchProject(projectId);
    if (!project) throw new Error('Không tìm thấy dự án.');
    const [summary, workflow, kpis, products, risks, budget] = await Promise.all([
      this.fetchProjectSummary(projectId), this.computeProjectWorkflow(projectId), this.listKpis(projectId),
      this.listProducts(projectId), this.listRisks(projectId), this.listBudgetLines(projectId),
    ]);
    return { project, summary, workflow, kpis, products, risks, budget };
  }
}
