import type { Pool, PoolClient } from 'pg';
import { addWorkingHours, type WorkingHoursConfig } from '../lead-sla-settings/lead-sla-working-hours.util';
import { defaultLeadSlaSettingsPayload } from '../lead-sla-settings/lead-sla-settings.defaults';
import { deliveryHours } from '../leads-funnel/quote-delivery-kpi.util';
import { QUOTE_SHEET_ROLE_LABEL, readStoredQuoteSheet } from '../leads-funnel/quote-sheet.util';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export const QUOTE_TASK_SOURCE = 'quote_item';

/** Catalog phase code or name → lifecycle stage. Does not use legacy service slugs. */
export function lifecycleStageForQuotePhase(phaseCode: string, phaseName = ''): 'onboard' | 'deliver' | 'handover' | 'retain' {
  const code = String(phaseCode ?? '').trim().toUpperCase();
  const name = String(phaseName ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (code === 'K' || name.includes('khoi dong')) return 'onboard';
  if (code === 'B' || name.includes('nghiem thu') || name.includes('ban giao')) return 'handover';
  if (code === 'V' || name.includes('van hanh') || name.includes('duy tri')) return 'retain';
  return 'deliver';
}

export function quotePhaseSortKey(phaseCode: string): number {
  const order: Record<string, number> = { K: 1, N: 2, P: 3, S: 4, T: 5, D: 6, B: 7, V: 8 };
  return order[String(phaseCode ?? '').trim().toUpperCase()] ?? 50;
}

function ymdSaigon(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Saigon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

async function loadWorkingCalendar(client: Queryable): Promise<{
  workingHours: WorkingHoursConfig;
  holidays: string[];
}> {
  const fallback = defaultLeadSlaSettingsPayload();
  try {
    const result = await client.query(
      `SELECT payload FROM crm_lead_sla_settings WHERE tenant_id = 'default' LIMIT 1`,
    );
    const payload = (result.rows[0] as { payload?: Record<string, unknown> } | undefined)?.payload;
    const raw = (payload?.working_hours ?? fallback.working_hours) as WorkingHoursConfig;
    const days = Array.isArray(raw?.days) && raw.days.length ? raw.days.map((d) => Number(d)) : fallback.working_hours.days;
    const start = String(raw?.start ?? fallback.working_hours.start);
    const end = String(raw?.end ?? fallback.working_hours.end);
    const holidays = Array.isArray(payload?.holidays)
      ? (payload!.holidays as unknown[]).map((h) => String(h).slice(0, 10)).filter(Boolean)
      : fallback.holidays;
    return { workingHours: { days, start, end }, holidays };
  } catch {
    return { workingHours: fallback.working_hours, holidays: fallback.holidays };
  }
}

async function staffNameById(client: Queryable, staffId: number | null): Promise<string> {
  if (staffId == null || staffId <= 0) return '';
  const result = await client.query(`SELECT name FROM crm_staff WHERE id = $1 LIMIT 1`, [staffId]);
  return String((result.rows[0] as { name?: string } | undefined)?.name ?? '').trim();
}

export type SeedQuoteDeliveryTasksInput = {
  leadId: number;
  lifecycleId: number;
  presalesId: number;
  assignedAm: number | null;
  startedAt?: Date | string;
};

export type SeedQuoteDeliveryTasksResult = {
  inserted: number;
  skipped: number;
  total_candidates: number;
};

/**
 * Idempotent: inserts crm_svc_tasks from included quote rows + client_only
 * rows. Existing form_data.source=quote_item + item_code are left untouched.
 */
export async function seedQuoteDeliveryTasks(
  client: Queryable,
  input: SeedQuoteDeliveryTasksInput,
): Promise<SeedQuoteDeliveryTasksResult> {
  const lifecycleId = Number(input.lifecycleId);
  const presalesId = Number(input.presalesId);
  if (!Number.isFinite(lifecycleId) || lifecycleId <= 0 || !Number.isFinite(presalesId) || presalesId <= 0) {
    return { inserted: 0, skipped: 0, total_candidates: 0 };
  }

  const storedResult = await client.query(`SELECT quote_sheet FROM crm_lead_presales WHERE id = $1`, [presalesId]);
  const stored = readStoredQuoteSheet((storedResult.rows[0] as { quote_sheet?: unknown } | undefined)?.quote_sheet);
  const serviceCodes = stored.service_codes ?? [];
  if (!serviceCodes.length) {
    return { inserted: 0, skipped: 0, total_candidates: 0 };
  }

  const existing = await client.query(
    `SELECT form_data->>'item_code' AS item_code
       FROM crm_svc_tasks
      WHERE lifecycle_id = $1
        AND COALESCE(form_data->>'source', '') = $2
        AND COALESCE(form_data->>'item_code', '') <> ''`,
    [lifecycleId, QUOTE_TASK_SOURCE],
  );
  const already = new Set(
    (existing.rows as Array<{ item_code?: string }>).map((row) => String(row.item_code ?? '').trim()).filter(Boolean),
  );

  const itemResult = await client.query(
    `SELECT i.code,
            i.task,
            COALESCE(i.subtask, '') AS subtask,
            COALESCE(i.phase_code, '') AS phase_code,
            COALESCE(ph.name, i.phase_code, '') AS phase_name,
            COALESCE(i.main_role_code, '') AS role_code,
            COALESCE(i.planned_hours, i.est_hours, 0) AS est_hours,
            COALESCE(i.default_qty, 1) AS default_qty,
            COALESCE(i.client_only, FALSE) AS client_only,
            COALESCE(i.billable, TRUE) AS billable
       FROM crm_service_items i
       LEFT JOIN crm_service_phases ph ON ph.code = i.phase_code
      WHERE i.is_active AND i.code IS NOT NULL
        AND i.service_id IN (SELECT id FROM crm_services WHERE is_active AND code = ANY($1::text[]))`,
    [serviceCodes],
  );

  const overrideByCode = new Map(stored.lines.map((line) => [line.item_code, line]));
  type Candidate = {
    item_code: string;
    title: string;
    description: string;
    phase_code: string;
    stage: 'onboard' | 'deliver' | 'handover' | 'retain';
    role_code: string;
    client_only: boolean;
    hours: number;
    qty: number;
    staff_id: number | null;
    sort: number;
  };
  const candidates: Candidate[] = [];
  for (const raw of itemResult.rows as Array<Record<string, unknown>>) {
    const code = String(raw.code ?? '').trim();
    if (!code) continue;
    const clientOnly = Boolean(raw.client_only);
    const override = overrideByCode.get(code);
    const ticked = Boolean(override?.included);
    if (!clientOnly && !ticked) continue;
    const hours = Number(override?.hours ?? raw.est_hours ?? 0);
    const qty = Number(override?.qty ?? raw.default_qty ?? 1);
    const staffId = clientOnly
      ? input.assignedAm
      : override?.staff_id != null && Number(override.staff_id) > 0
        ? Number(override.staff_id)
        : null;
    const phaseCode = String(raw.phase_code ?? '');
    candidates.push({
      item_code: code,
      title: String(raw.task ?? '').trim() || code,
      description: String(raw.subtask ?? '').trim(),
      phase_code: phaseCode,
      stage: lifecycleStageForQuotePhase(phaseCode, String(raw.phase_name ?? '')),
      role_code: clientOnly ? 'client' : String(raw.role_code ?? ''),
      client_only: clientOnly,
      hours: Number.isFinite(hours) && hours > 0 ? hours : 0,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      staff_id: staffId != null && Number.isFinite(staffId) && staffId > 0 ? staffId : null,
      sort: quotePhaseSortKey(phaseCode),
    });
  }

  candidates.sort((a, b) => a.sort - b.sort || a.item_code.localeCompare(b.item_code));

  const calendar = await loadWorkingCalendar(client);
  let cursor = input.startedAt ? new Date(input.startedAt) : new Date();
  if (!Number.isFinite(cursor.getTime())) cursor = new Date();

  const amName = await staffNameById(client, input.assignedAm);
  const staffNames = new Map<number, string>();
  if (input.assignedAm) staffNames.set(input.assignedAm, amName);

  let inserted = 0;
  let skipped = 0;
  const stageIndex: Record<string, number> = { onboard: 0, deliver: 0, handover: 0, retain: 0 };

  // Keep existing step_index unique per stage when backfilling alongside leftover tasks.
  const maxIdx = await client.query(
    `SELECT stage, COALESCE(MAX(step_index), -1)::int AS max_idx
       FROM crm_svc_tasks WHERE lifecycle_id = $1
       GROUP BY stage`,
    [lifecycleId],
  );
  for (const row of maxIdx.rows as Array<{ stage: string; max_idx: number }>) {
    const stage = String(row.stage ?? '');
    if (stage in stageIndex) stageIndex[stage] = Number(row.max_idx) + 1;
  }

  const ts = cursor.toISOString();
  for (const item of candidates) {
    if (already.has(item.item_code)) {
      skipped += 1;
      const labor = deliveryHours(item.hours, item.qty);
      if (labor > 0) cursor = addWorkingHours(cursor, labor, calendar.workingHours, calendar.holidays);
      continue;
    }
    const labor = deliveryHours(item.hours, item.qty);
    if (labor > 0) cursor = addWorkingHours(cursor, labor, calendar.workingHours, calendar.holidays);
    const due = ymdSaigon(cursor);
    let staffId = item.staff_id;
    if (item.client_only) staffId = input.assignedAm;
    let assignee = '';
    if (staffId) {
      if (!staffNames.has(staffId)) staffNames.set(staffId, await staffNameById(client, staffId));
      assignee = staffNames.get(staffId) ?? '';
    }
    if (item.client_only && !assignee && amName) assignee = amName;
    const roleLabel = item.client_only
      ? 'Khách hàng'
      : QUOTE_SHEET_ROLE_LABEL[item.role_code] ?? item.role_code;
    const stepIndex = stageIndex[item.stage] ?? 0;
    stageIndex[item.stage] = stepIndex + 1;
    const formData = {
      source: QUOTE_TASK_SOURCE,
      item_code: item.item_code,
      phase_code: item.phase_code,
      role_code: item.role_code,
      role_label: roleLabel,
      client_only: item.client_only,
      hours: item.hours,
      qty: item.qty,
      assignee,
      owner: assignee,
      assignee_staff_id: staffId,
      due_date: due,
      priority: 'normal',
    };
    const description = item.client_only
      ? [item.description, 'Việc phía khách hàng — AM theo dõi.'].filter(Boolean).join('\n')
      : item.description;
    await client.query(
      `INSERT INTO crm_svc_tasks
         (lifecycle_id, stage, step_index, title, description, form_fields, form_data,
          ai_prompt_key, ai_output, is_done, done_at, done_by, notes, is_custom, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, $6::jsonb, '', '', FALSE, NULL, NULL, '', FALSE, $7::timestamptz, $7::timestamptz)`,
      [lifecycleId, item.stage, stepIndex, item.title.slice(0, 400), description.slice(0, 4000), JSON.stringify(formData), ts],
    );
    inserted += 1;
    already.add(item.item_code);
  }

  return { inserted, skipped, total_candidates: candidates.length };
}

export type BackfillLeadRow = {
  lead_id: number;
  presales_id: number;
  lifecycle_id: number;
  assigned_am: number | null;
};

export async function listTrienKhaiLeadsForTaskBackfill(client: Queryable): Promise<BackfillLeadRow[]> {
  const result = await client.query(
    `SELECT l.sqlite_lead_id AS lead_id,
            ps.id AS presales_id,
            ps.lifecycle_id,
            ps.assigned_am
       FROM crm_lead_presales ps
       INNER JOIN crm_leads l ON l.sqlite_lead_id = ps.lead_id
      WHERE ps.lifecycle_id IS NOT NULL
        AND ps.lifecycle_id > 0
        AND (
          lower(trim(COALESCE(l.status, ''))) = 'trien_khai'
          OR lower(trim(COALESCE(ps.implementation_status, ''))) = 'trien_khai'
        )
      ORDER BY l.sqlite_lead_id`,
  );
  return (result.rows as Array<Record<string, unknown>>).map((row) => ({
    lead_id: Number(row.lead_id),
    presales_id: Number(row.presales_id),
    lifecycle_id: Number(row.lifecycle_id),
    assigned_am: row.assigned_am != null ? Number(row.assigned_am) : null,
  }));
}

/** Also stamp contract_signed_at when a converted / trien_khai row is still missing it. */
export async function ensureContractSignedAt(client: Queryable, presalesId: number, at: Date): Promise<boolean> {
  const result = await client.query(
    `UPDATE crm_lead_presales
        SET contract_signed_at = COALESCE(contract_signed_at, $2::timestamptz),
            updated_at = NOW()
      WHERE id = $1
        AND contract_signed_at IS NULL
      RETURNING id`,
    [presalesId, at.toISOString()],
  );
  return (result.rowCount ?? 0) > 0;
}
