import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { QT_QUOTE_QUERY, QuoteAuditRepository, QuoteQueryPort } from './quote-audit.repository';
import { formatQuoteCode } from './quote-code.util';
import type { QuoteStatus } from './quote.types';

export const QUOTE_TYPES = [
  'new_business',
  'renewal',
  'upsell',
  'retainer',
  'campaign',
  'project',
  'change_request',
] as const;

export type QuoteType = (typeof QUOTE_TYPES)[number];
export type QuoteCreateSource = 'lead' | 'am360' | 'blank';

export type QuoteCreateInput = {
  source?: QuoteCreateSource;
  lead_id?: number;
  agency_client_id?: string;
  customer_id?: number;
  title?: string;
  quote_type?: string;
};

export type QuoteCreateActor = {
  staffId: number;
  idempotencyKey?: string;
};

export type QuoteCreateResult = {
  proposal: {
    id: number;
    quote_code: string;
    status: QuoteStatus;
    current_version_id: string;
  };
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bad(error: string): never {
  throw new BadRequestException({ error });
}

function finiteId(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function asUuid(value: unknown): string | null {
  const id = String(value ?? '').trim();
  if (!id) return null;
  if (!UUID_RE.test(id)) return null;
  return id;
}

export function isQuoteOsCreate(body: QuoteCreateInput | null | undefined): boolean {
  if (!body) return false;
  const title = String(body.title ?? '').trim();
  const client = String(body.agency_client_id ?? '').trim();
  const source = String(body.source ?? '').trim();
  return Boolean(title || client || source);
}

@Injectable()
export class QuoteCreateService {
  constructor(
    @Inject(QT_QUOTE_QUERY) private readonly db: QuoteQueryPort,
    private readonly audit: QuoteAuditRepository,
  ) {}

  async create(input: QuoteCreateInput, actor: QuoteCreateActor): Promise<QuoteCreateResult> {
    const key = String(actor.idempotencyKey ?? '').trim();
    if (!key) bad('idempotency_key_required');

    const replayed = await this.findByIdempotencyKey(key);
    if (replayed) return replayed;

    const title = String(input.title ?? '').trim();
    if (!title) bad('title_required');

    const quoteType = String(input.quote_type ?? 'new_business').trim();
    if (!(QUOTE_TYPES as readonly string[]).includes(quoteType)) bad('invalid_quote_type');

    const source = this.resolveSource(input);
    const resolved = await this.resolveClient(source, input);
    const ownerStaffId = resolved.ownerStaffId || actor.staffId || 0;

    const seqRow = await this.db.query(`SELECT nextval('crm_quote_code_seq') AS seq`);
    const seq = Number(seqRow.rows[0]?.seq ?? seqRow.rows[0]?.nextval ?? 0);
    if (!Number.isFinite(seq) || seq <= 0) bad('quote_code_alloc_failed');
    const quoteCode = formatQuoteCode(new Date().getFullYear(), seq);
    const now = new Date().toISOString();

    const inserted = await this.db.query(
      `INSERT INTO crm_proposals (
         customer_id, lead_id, service_slugs, total_vnd, timeline_months, notes, ai_output,
         status, title, quote_type, quote_code, agency_client_id, owner_staff_id,
         issuing_entity, currency_code, timezone, price_adjustment_reason, created_at, updated_at
       ) VALUES (
         $1, $2, '[]', 0, 1, '', '{}',
         'draft', $3, $4, $5, $6, $7,
         'PTT-HCM', 'VND', 'Asia/Ho_Chi_Minh', '', $8, $8
       )
       RETURNING id, quote_code, status, current_version_id`,
      [
        resolved.customerId || null,
        resolved.leadId || null,
        title,
        quoteType,
        quoteCode,
        resolved.agencyClientId,
        ownerStaffId || null,
        now,
      ],
    );
    const proposalId = Number(inserted.rows[0]?.id ?? 0);
    if (!proposalId) bad('insert_failed');

    const version = await this.db.query(
      `INSERT INTO crm_quote_versions (proposal_id, n, state, snapshot_json, created_by)
       VALUES ($1, 1, 'working', '{}', $2)
       RETURNING id, n, state`,
      [proposalId, ownerStaffId || 0],
    );
    const versionId = String(version.rows[0]?.id ?? '');
    if (!versionId) bad('version_insert_failed');

    const updated = await this.db.query(
      `UPDATE crm_proposals
          SET current_version_id = $1, updated_at = $2
        WHERE id = $3
        RETURNING id, quote_code, status, current_version_id`,
      [versionId, now, proposalId],
    );
    const row = updated.rows[0] ?? inserted.rows[0];
    const result: QuoteCreateResult = {
      proposal: {
        id: proposalId,
        quote_code: String(row?.quote_code ?? quoteCode),
        status: 'draft',
        current_version_id: String(row?.current_version_id ?? versionId),
      },
    };

    await this.audit.insert({
      proposal_id: proposalId,
      version_id: versionId,
      actor_staff_id: actor.staffId || null,
      action: 'quote.created',
      resource: 'quote',
      snapshot_json: {
        idempotency_key: key,
        source,
        quote_code: result.proposal.quote_code,
        agency_client_id: resolved.agencyClientId,
        lead_id: resolved.leadId || null,
        title,
      },
    });
    return result;
  }

  private resolveSource(input: QuoteCreateInput): QuoteCreateSource {
    const raw = String(input.source ?? '').trim();
    if (raw === 'lead' || raw === 'am360' || raw === 'blank') return raw;
    if (finiteId(input.lead_id)) return 'lead';
    if (String(input.agency_client_id ?? '').trim()) return 'am360';
    return 'blank';
  }

  private async resolveClient(
    source: QuoteCreateSource,
    input: QuoteCreateInput,
  ): Promise<{
    agencyClientId: string | null;
    customerId: number;
    leadId: number;
    ownerStaffId: number;
  }> {
    if (source === 'lead') {
      const leadId = finiteId(input.lead_id);
      if (!leadId) bad('lead_id_required');
      const lead = await this.loadLead(leadId);
      const fromBody = asUuid(input.agency_client_id);
      const fromLead = asUuid(lead.agency_client_id);
      const agencyClientId = fromBody ?? fromLead;
      const customerId = finiteId(input.customer_id) || finiteId(lead.converted_customer_id);
      if (!agencyClientId && !customerId) bad('lead_client_required');
      if (fromBody || fromLead) await this.requireClient(agencyClientId);
      return {
        agencyClientId,
        customerId,
        leadId,
        ownerStaffId: finiteId(lead.owner_id),
      };
    }

    const agencyClientId = asUuid(input.agency_client_id);
    if (!agencyClientId) {
      if (String(input.agency_client_id ?? '').trim()) bad('client_not_found');
      bad('agency_client_id_required');
    }
    await this.requireClient(agencyClientId);
    return {
      agencyClientId,
      customerId: finiteId(input.customer_id),
      leadId: finiteId(input.lead_id),
      ownerStaffId: 0,
    };
  }

  private async loadLead(leadId: number): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `SELECT sqlite_lead_id, agency_client_id::text AS agency_client_id,
              converted_customer_id, owner_id, full_name
         FROM crm_leads
        WHERE sqlite_lead_id = $1
        LIMIT 1`,
      [leadId],
    );
    if (!result.rows[0]) bad('lead_not_found');
    return result.rows[0];
  }

  private async requireClient(clientId: string | null): Promise<void> {
    if (!clientId || !UUID_RE.test(clientId)) bad('client_not_found');
    const found = await this.db.query(`SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1`, [
      clientId,
    ]);
    if (!found.rows[0]) bad('client_not_found');
  }

  private async findByIdempotencyKey(key: string): Promise<QuoteCreateResult | null> {
    const result = await this.db.query(
      `SELECT a.proposal_id, a.version_id, p.quote_code, p.status, p.current_version_id
         FROM crm_quote_activity a
         JOIN crm_proposals p ON p.id = a.proposal_id
        WHERE a.action = 'quote.created'
          AND a.snapshot_json->>'idempotency_key' = $1
        LIMIT 1`,
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      proposal: {
        id: Number(row.proposal_id),
        quote_code: String(row.quote_code ?? ''),
        status: 'draft',
        current_version_id: String(row.current_version_id ?? row.version_id ?? ''),
      },
    };
  }
}
