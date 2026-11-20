import { ConflictException, Injectable, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { CreateLeadV1Body } from '../leads.types';
import { PTT_OPERATING_COMPANY_ID } from '../../b2b-projects/b2b-projects.constants';
import { B2bFirstAssignService } from '../../b2b-projects/b2b-first-assign.service';
import { LeadAutoAssignService } from './lead-auto-assign.service';
import { LeadDedupRepository, type LeadDuplicateMatch } from './lead-dedup.repository';
import { normalizeEmail, normalizePhone } from './lead-contact.util';
import { LeadIngestRulesRepository } from './lead-ingest-rules.repository';
import { isEligibleLeadOwner } from '../../ae-team/eligible-lead-owner';
import {
  isSalesStaff,
  listSalesOrder,
  loadPausedSales,
  pickFirstSale,
} from '../../lead-fr-sla/lead-claim-round.util';

/** Round-robin pointer for the first Sale of a new lead (stored in crm_ingest_rules_snapshot). */
const SALES_FIRST_POOL_KEY = (projectId: string | null) =>
  projectId ? `sales_first:proj:${projectId}` : 'sales_first:global';

export interface EnrichedCreateLeadBody extends CreateLeadV1Body {
  is_duplicate?: boolean;
  meta?: Record<string, unknown>;
  owner_company_id?: string | null;
  b2b_first_assign?: {
    projectId: string;
    strategy: string;
    reason: string;
    confidence: number | null;
  };
}

@Injectable()
export class LeadCreateEnrichmentService {
  constructor(
    private readonly dedup: LeadDedupRepository,
    private readonly rulesRepo: LeadIngestRulesRepository,
    private readonly autoAssign: LeadAutoAssignService,
    private readonly b2bFirstAssign: B2bFirstAssignService,
    private readonly appConfig: AppConfigService,
  ) {}

  async enrich(body: CreateLeadV1Body): Promise<EnrichedCreateLeadBody> {
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    const seedMeta =
      body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta)
        ? { ...body.meta }
        : {};
    const meta: Record<string, unknown> = {
      ...seedMeta,
      nest_write: true,
      created_via: String(seedMeta.created_via ?? 'POST /api/v1/leads'),
      ingest_path: String(seedMeta.ingest_path ?? 'nest_manual'),
    };

    const isB2bFlow =
      body.lead_flow_kind === 'b2b_prospect' ||
      (!body.lead_flow_kind && !String(body.client_id ?? '').trim());

    let clientId = body.client_id ?? null;
    let b2bProjectId = body.b2b_project_id ?? null;
    let ownerCompanyId: string | null = body.owner_company_id ?? null;

    if (this.appConfig.b2bProjectOs && isB2bFlow) {
      if (!String(b2bProjectId ?? '').trim()) {
        throw new BadRequestException({ error: 'b2b_project_required' });
      }
      ownerCompanyId = PTT_OPERATING_COMPANY_ID;
      clientId = null;
    }

    const existingExternal = await this.dedup.findByExternalId({
      clientId: clientId ?? undefined,
      channel: body.channel,
      externalLeadId: body.external_lead_id,
    });
    if (existingExternal) {
      throw new ConflictException({
        error: 'duplicate_external_id',
        message: `Lead external ID đã tồn tại (#${existingExternal})`,
        lead_id: existingExternal,
      });
    }

    const createdAfter =
      typeof this.dedup.contactDedupeSince === 'function'
        ? await this.dedup.contactDedupeSince()
        : undefined;
    const dupMatches = await this.dedup.findContactDuplicates({
      phone,
      email,
      b2bProjectId: b2bProjectId ?? undefined,
      createdAfter,
    });
    let isDuplicate = dupMatches.length > 0;
    let dupMatch: LeadDuplicateMatch | null = isDuplicate ? dupMatches[0] : null;
    if (dupMatch) {
      meta.duplicate_of_id = dupMatch.lead_id;
      meta.dedup_matches = dupMatches.slice(0, 3).map((row) => row.lead_id);
    } else if (phone || email) {
      const lostMatches = await this.dedup.findLostContact({
        phone,
        email,
        b2bProjectId: b2bProjectId ?? undefined,
      });
      if (lostMatches.length > 0) {
        isDuplicate = true;
        dupMatch = lostMatches[0];
        meta.duplicate_of_id = dupMatch.lead_id;
        meta.dedup_matches = lostMatches.slice(0, 3).map((row) => row.lead_id);
        meta.dedup_reason = 'lost_contact';
      }
    }
    let ownerId = body.owner_id ?? null;
    let assignStrategy = '';
    let b2bFirstAssignMeta: EnrichedCreateLeadBody['b2b_first_assign'];
    const hasSqlQuery = typeof (this.rulesRepo as { query?: unknown }).query === 'function';
    const sqlQuery = (sql: string, params: unknown[] = []) => this.rulesRepo.query(sql, params);
    // Doc V5.1 §01: CRM auto-gives every new lead to Sales #1. An owner sent by the creator
    // (Admin / AM / GĐKD / unticked Sale) is not kept unless that owner is an eligible Sale.
    let explicitOwner = ownerId != null && Number(ownerId) > 0;
    if (explicitOwner && hasSqlQuery) {
      const candidateId = Number(ownerId);
      const saleOk = await isSalesStaff(sqlQuery, candidateId).catch(() => false);
      const eligibleOk = saleOk ? await isEligibleLeadOwner(sqlQuery, candidateId).catch(() => false) : false;
      if (!saleOk || !eligibleOk) {
        meta.assign_override_from = candidateId;
        explicitOwner = false;
        ownerId = null;
      }
    }

    if (
      !explicitOwner &&
      !isDuplicate &&
      this.appConfig.b2bProjectOs &&
      isB2bFlow &&
      b2bProjectId
    ) {
      const scoreRaw = (body as CreateLeadV1Body & { meta?: Record<string, unknown> }).meta
        ?.lead_score;
      const score =
        typeof scoreRaw === 'number'
          ? scoreRaw
          : typeof scoreRaw === 'string' && scoreRaw.trim()
            ? Number(scoreRaw)
            : null;
      const assign = await this.b2bFirstAssign.assign({
        projectId: b2bProjectId,
        score: Number.isFinite(score) ? score : null,
        channel: body.channel,
        source: body.source,
        phone: phone || body.phone,
      });
      if (assign.ownerId) {
        ownerId = assign.ownerId;
        assignStrategy = assign.strategy;
        meta.assign_strategy = assign.strategy;
        meta.assign_reason = assign.reason;
        if (assign.confidence != null) meta.assign_confidence = assign.confidence;
        meta.auto_assigned_at = new Date().toISOString();
        b2bFirstAssignMeta = {
          projectId: b2bProjectId,
          strategy: assign.strategy,
          reason: assign.reason,
          confidence: assign.confidence,
        };
      } else {
        meta.assign_failed = true;
        meta.assign_failed_at = new Date().toISOString();
        meta.assign_failed_reason = assign.reason || 'empty_pool';
      }
    } else if (!explicitOwner && !isDuplicate) {
      const industrySlug = clientId
        ? await this.rulesRepo.fetchClientIndustry(clientId)
        : null;
      meta.industry_slug = industrySlug ?? null;
      // Real Sales pool (crm_staff + Sales positions, configured order), not the empty snapshot.
      const projectKey = String(b2bProjectId ?? '').trim() || null;
      const pool = await listSalesOrder(sqlQuery, projectKey);
      const paused = await loadPausedSales(sqlQuery);
      const snapshot = await this.rulesRepo.fetchSnapshot().catch(() => null);
      const poolKey = SALES_FIRST_POOL_KEY(pool.source === 'project' ? projectKey : null);
      const last = snapshot?.assignment_state.find((row) => row.pool_key === poolKey)?.last_staff_id ?? null;
      const picked = pickFirstSale(pool.order, last, paused);
      if (picked != null) {
        ownerId = picked;
        assignStrategy = 'sales_round_robin';
        meta.assign_strategy = assignStrategy;
        meta.assign_reason = 'initial_assign';
        meta.assign_pool_key = poolKey;
        meta.assign_pool_source = pool.source;
        meta.auto_assigned_at = new Date().toISOString();
        await this.rulesRepo.persistAssignmentState(poolKey, picked).catch(() => undefined);
      } else {
        meta.assign_failed = true;
        meta.assign_failed_at = new Date().toISOString();
        meta.assign_failed_reason = 'Không có Sales đang nhận lead';
      }
    }

    if (isDuplicate && dupMatch?.owner_id != null && Number(dupMatch.owner_id) > 0) {
      const dupOwnerId = Number(dupMatch.owner_id);
      const dupOwnerEligible = hasSqlQuery
        ? await isEligibleLeadOwner(sqlQuery, dupOwnerId).catch(() => false)
        : true;
      if (dupOwnerEligible) {
        ownerId = dupOwnerId;
        assignStrategy = 'duplicate_owner';
        meta.assign_strategy = 'duplicate_owner';
        meta.assign_reason = `duplicate_of_${dupMatch.lead_id}`;
        meta.auto_assigned_at = new Date().toISOString();
      } else {
        ownerId = null;
        assignStrategy = 'duplicate_owner_ineligible';
        meta.assign_strategy = 'duplicate_owner_ineligible';
        meta.assign_reason = `duplicate_of_${dupMatch.lead_id}`;
        meta.duplicate_ineligible_owner_id = dupOwnerId;
      }
    }

    if (assignStrategy) {
      meta.assign_strategy = assignStrategy;
    }

    if (body.lead_flow_kind === 'spa_operational' || body.lead_flow_kind === 'b2b_prospect') {
      meta.lead_flow_kind = body.lead_flow_kind;
    }

    return {
      ...body,
      phone: phone || body.phone,
      email: email || body.email,
      client_id: clientId,
      b2b_project_id: b2bProjectId,
      owner_company_id: ownerCompanyId,
      owner_id: ownerId,
      status: body.status?.trim() || 'moi',
      is_duplicate: isDuplicate,
      meta,
      b2b_first_assign: b2bFirstAssignMeta,
    };
  }
}
