import { ConflictException, Injectable } from '@nestjs/common';
import { CreateLeadV1Body } from '../leads.types';
import { LeadAutoAssignService } from './lead-auto-assign.service';
import { LeadDedupRepository } from './lead-dedup.repository';
import { normalizeEmail, normalizePhone } from './lead-contact.util';
import { LeadIngestRulesRepository } from './lead-ingest-rules.repository';

export interface EnrichedCreateLeadBody extends CreateLeadV1Body {
  is_duplicate?: boolean;
  meta?: Record<string, unknown>;
}

@Injectable()
export class LeadCreateEnrichmentService {
  constructor(
    private readonly dedup: LeadDedupRepository,
    private readonly rulesRepo: LeadIngestRulesRepository,
    private readonly autoAssign: LeadAutoAssignService,
  ) {}

  async enrich(body: CreateLeadV1Body): Promise<EnrichedCreateLeadBody> {
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    const meta: Record<string, unknown> = {
      nest_write: true,
      created_via: 'POST /api/v1/leads',
      ingest_path: 'nest_manual',
    };

    const existingExternal = await this.dedup.findByExternalId({
      clientId: body.client_id,
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

    const dupMatches = await this.dedup.findContactDuplicates({ phone, email });
    const isDuplicate = dupMatches.length > 0;
    const duplicateOfId = isDuplicate ? dupMatches[0].lead_id : null;
    if (duplicateOfId) {
      meta.duplicate_of_id = duplicateOfId;
      meta.dedup_matches = dupMatches.slice(0, 3).map((row) => row.lead_id);
    }

    let ownerId = body.owner_id ?? null;
    let assignStrategy = '';
    const explicitOwner = ownerId != null && Number(ownerId) > 0;

    if (!explicitOwner && !isDuplicate) {
      const industrySlug = body.client_id
        ? await this.rulesRepo.fetchClientIndustry(body.client_id)
        : null;
      meta.industry_slug = industrySlug ?? null;
      const assign = await this.autoAssign.assignOwner({
        industrySlug,
        serviceSlug: 'lead-gen',
      });
      if (assign) {
        ownerId = assign.owner_id;
        assignStrategy = assign.strategy;
        meta.assign_strategy = assign.strategy;
        meta.assign_pool_key = assign.pool_key;
        meta.auto_assigned_at = new Date().toISOString();
      } else if (await this.rulesRepo.fetchSnapshot()) {
        meta.assign_failed = true;
        meta.assign_failed_at = new Date().toISOString();
        meta.assign_failed_reason = 'Không tìm được nhân viên phù hợp (assign-scopes / snapshot)';
      }
    }

    if (assignStrategy) {
      meta.assign_strategy = assignStrategy;
    }

    return {
      ...body,
      phone: phone || body.phone,
      email: email || body.email,
      owner_id: ownerId,
      status: body.status?.trim() || 'moi',
      is_duplicate: isDuplicate,
      meta,
    };
  }
}
