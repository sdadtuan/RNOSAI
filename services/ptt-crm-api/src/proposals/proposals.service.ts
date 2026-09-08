import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OpsProfilePgRepository } from '../ops/ops-profile-pg.repository';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import { OpsService } from '../ops/ops.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import { SpcService } from '../spc/spc.service';
import { skuFromDvTier } from '../spc/spc-sku.util';
import { ProposalsPgRepository } from './proposals-pg.repository';
import {
  normalizeQuoteTier,
  quoteExportFilename,
  quotePdfBuffer,
  resolveTierPricing,
  type QuotePackageTier,
} from './quote-pricing.util';
import {
  buildAutoQuoteLineInputs,
  loadDealRoomServiceDvMap,
  resolveServiceDvMapping,
} from './deal-room-quote.util';
import {
  CreateProposalBody,
  PatchProposalStatusBody,
  PROPOSAL_STATUS_FLOW,
  ProposalStatus,
  PutQuoteLinesBody,
  QuoteLineInput,
} from './proposals.types';
import { requireLostReason } from './quote-lost-reason.util';
import { canTransition } from './quote-status.util';
import type { QuoteStatus } from './quote.types';
import { isQuoteOsCreate, QuoteCreateService } from './quote-create.service';
import {
  isQuoteBuilderTarget,
  QuoteBuilderActor,
  QuoteBuilderService,
} from './quote-builder.service';
import { QuoteCatalogService } from './quote-catalog.service';
import { QuoteConvertActor, QuoteConvertService } from './quote-convert.service';
import { QuoteListQuery, QuoteListService } from './quote-list.service';
import type { QuoteHeaderPatch } from './quote-versions.repository';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly repo: ProposalsPgRepository,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly profiles: OpsProfilePgRepository,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly ops: OpsService,
    private readonly config: AppConfigService,
    private readonly funnel: LeadsFunnelService,
    private readonly spc: SpcService,
    private readonly quoteCreate: QuoteCreateService,
    private readonly quoteList: QuoteListService,
    private readonly quoteBuilder: QuoteBuilderService,
    private readonly quoteCatalog: QuoteCatalogService,
    private readonly quoteConvert: QuoteConvertService,
  ) {}

  private async assertG4ForLeadContext(leadId: number): Promise<void> {
    if (!this.config.dealRoomGateStrict) return;
    const gateResp = await this.funnel.getPresalesProposalGate(leadId);
    if (!gateResp.gate.ok) {
      throw new BadRequestException({
        error: 'g4_blocked',
        messages: gateResp.gate.messages,
        message:
          gateResp.gate.messages[0] ?? 'Hoàn thành G4 R5 trước khi tạo báo giá (BR-SCLOSE-001).',
      });
    }
  }

  async list(customerIdRaw?: string, leadIdRaw?: string, scoped?: QuoteListQuery) {
    const leadId = Number(leadIdRaw ?? 0);
    if (Number.isFinite(leadId) && leadId > 0) {
      const rows = await this.repo.listByLeadId(leadId);
      const proposals = await Promise.all(
        rows.map(async (proposal) => ({
          ...proposal,
          line_count: (await this.repo.listLines(proposal.id)).length,
        })),
      );
      return { proposals };
    }
    const customerId = Number(customerIdRaw ?? 0);
    if (Number.isFinite(customerId) && customerId > 0) {
      const rows = await this.repo.listByCustomer(customerId);
      const proposals = await Promise.all(
        rows.map(async (proposal) => ({
          ...proposal,
          line_count: (await this.repo.listLines(proposal.id)).length,
        })),
      );
      return { proposals };
    }
    if (scoped) {
      return this.quoteList.list(scoped);
    }
    throw new BadRequestException({ error: 'Cần customer_id hoặc lead_id' });
  }

  async detail(proposalId: number) {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {
      ...proposal,
      lines: await this.listMappedLines(proposalId, proposal),
    };
  }

  async getLines(proposalId: number) {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    return { proposal_id: proposalId, lines: await this.listMappedLines(proposalId, proposal) };
  }

  private listMappedLines(
    proposalId: number,
    proposal: { quote_code?: string | null; current_version_id?: string | null },
  ) {
    if (proposal.quote_code || proposal.current_version_id) {
      return this.repo.listLines(proposalId, { quoteOs: true });
    }
    return this.repo.listLines(proposalId);
  }

  private resolveDvEntry(dvCode: string) {
    const code = String(dvCode ?? '').trim().toUpperCase();
    const entry = this.routeMap.getMap().services.find((s) => s.code === code);
    if (!entry) {
      throw new BadRequestException({ error: 'dv_not_found', dv_code: code });
    }
    return entry;
  }

  private async resolveLinePricing(line: QuoteLineInput) {
    if (line.sku_code?.trim()) {
      try {
        return await this.spc.resolveQuoteLineFromSku(
          line.sku_code,
          line.final_price_vnd,
          line.scope_notes,
        );
      } catch (err) {
        if (!line.dv_code || !line.package_tier) throw err;
      }
    }
    const dvCode = String(line.dv_code ?? '').trim().toUpperCase();
    if (!dvCode) {
      throw new BadRequestException({ error: 'dv_or_sku_required' });
    }
    const entry = this.resolveDvEntry(dvCode);
    const tier = normalizeQuoteTier(line.package_tier ?? 'standard');
    if (!tier) {
      throw new BadRequestException({ error: 'invalid_package_tier', tier: line.package_tier });
    }
    const skuCode = line.sku_code?.trim() || skuFromDvTier(entry.code, tier);
    try {
      return await this.spc.resolveQuoteLineFromSku(
        skuCode,
        line.final_price_vnd,
        line.scope_notes,
      );
    } catch {
      // fallback legacy tier_pricing
    }
    let tierPricing: Record<string, unknown> = {};
    try {
      const profile = await this.profiles.getByDvCode(entry.code);
      tierPricing = (profile?.tier_pricing ?? {}) as Record<string, unknown>;
    } catch {
      tierPricing = {};
    }
    const reference = resolveTierPricing(tierPricing, tier);
    const finalPrice =
      line.final_price_vnd != null && Number.isFinite(Number(line.final_price_vnd))
        ? Math.max(0, Number(line.final_price_vnd))
        : reference.suggested_vnd;
    return {
      sku_code: skuCode,
      dv_code: entry.code,
      package_tier: tier,
      service_slug: entry.service_slugs.primary,
      dv_name: entry.name_vi,
      reference_price_min: reference.min_vnd,
      reference_price_max: reference.max_vnd,
      final_price_vnd: finalPrice,
      scope_notes: String(line.scope_notes ?? ''),
    };
  }

  async create(
    body: CreateProposalBody,
    actor?: { staffId?: number; staffAuthVia?: 'internal' | 'jwt'; idempotencyKey?: string },
  ) {
    if (isQuoteOsCreate(body)) {
      const staffId = Number(actor?.staffId ?? 0);
      if (actor?.staffAuthVia !== 'internal' && !(staffId > 0)) {
        throw new ForbiddenException({ error: 'qt_unresolved_staff' });
      }
      return this.quoteCreate.create(body, {
        staffId,
        staffAuthVia: actor?.staffAuthVia,
        idempotencyKey: actor?.idempotencyKey,
      });
    }
    let customerId = Number(body.customer_id ?? 0);
    const leadId = Number(body.lead_id ?? 0);
    let presalesId = Number(body.presales_id ?? 0);
    let serviceSlug = String(body.service_slug ?? '').trim();
    let lines = body.lines ?? [];
    const autoLines = Boolean(body.auto_lines);

    if (Number.isFinite(leadId) && leadId > 0) {
      await this.assertG4ForLeadContext(leadId);
      if (!customerId) {
        const handoffResp = await this.funnel.getPresalesProposalHandoff(leadId);
        customerId = Number(handoffResp.handoff.customer_id ?? 0);
      }
      if (!presalesId) {
        const funnel = await this.funnel.getFunnel(leadId);
        presalesId = Number(funnel.presales?.presales.id ?? 0);
      }
      if (!serviceSlug) {
        const funnel = await this.funnel.getFunnel(leadId);
        serviceSlug = String(funnel.presales?.presales.service_slug ?? '').trim();
      }
    }

    if (!customerId) {
      throw new BadRequestException({
        error: 'customer_required',
        message: 'Lead chưa gắn khách hàng — chọn customer_id hoặc promote lead trước.',
      });
    }

    if (autoLines) {
      const tier = normalizeQuoteTier(body.package_tier ?? 'standard') ?? 'standard';
      lines = await this.buildAutoLines(serviceSlug, tier);
    }

    const slugs = (body.service_slugs ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (!lines.length && !slugs.length && !autoLines) {
      throw new BadRequestException({ error: 'Thiếu lines hoặc service_slugs' });
    }
    if (serviceSlug && !slugs.length) {
      slugs.push(serviceSlug);
    }

    const created = await this.repo.create({
      ...body,
      customer_id: customerId,
      lead_id: leadId > 0 ? leadId : undefined,
      presales_id: presalesId > 0 ? presalesId : undefined,
      service_slugs: slugs,
    });
    if (lines.length) {
      const resolved = await Promise.all(lines.map((line) => this.resolveLinePricing(line)));
      await this.repo.replaceLines(created.id, resolved);
    }
    return await this.detail(created.id);
  }

  private async buildAutoLines(serviceSlug: string, tier: QuotePackageTier) {
    const map = this.routeMap.getMap();
    const dvMap = loadDealRoomServiceDvMap();
    const mapping = resolveServiceDvMapping(serviceSlug, map, dvMap);
    let tierPricing: Record<string, unknown> = {};
    try {
      const profile = await this.profiles.getByDvCode(mapping.primary_dv);
      tierPricing = (profile?.tier_pricing ?? {}) as Record<string, unknown>;
    } catch {
      tierPricing = {};
    }
    return buildAutoQuoteLineInputs(mapping, tierPricing, tier);
  }

  async putLines(proposalId: number, body: PutQuoteLinesBody, actor?: QuoteBuilderActor) {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    if (proposal.status === 'accepted') {
      throw new BadRequestException({ error: 'proposal_already_accepted' });
    }
    if (isQuoteBuilderTarget(proposal, body)) {
      return this.quoteBuilder.putLines(
        proposalId,
        body,
        actor ?? { staffId: 0, staffAuthVia: 'internal', hasFinance: false },
      );
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw new BadRequestException({ error: 'lines_required' });
    }
    const resolved = await Promise.all(body.lines.map((line) => this.resolveLinePricing(line)));
    const items = await this.repo.replaceLines(
      proposalId,
      resolved,
      body.price_adjustment_reason,
    );
    return { proposal_id: proposalId, lines: items, total_vnd: items.reduce((s, l) => s + l.final_price_vnd, 0) };
  }

  async patchQuoteHeader(
    proposalId: number,
    body: QuoteHeaderPatch,
    ifMatch: string | undefined,
    actor: QuoteBuilderActor,
  ) {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    if (!proposal.quote_code && !proposal.current_version_id) {
      throw new NotFoundException({ error: 'not_a_quote' });
    }
    return this.quoteBuilder.patchHeader(proposalId, body, ifMatch, actor);
  }

  async recalculateQuote(proposalId: number, vid: string, actor: QuoteBuilderActor) {
    return this.quoteBuilder.recalculate(proposalId, vid, actor);
  }

  async createQuoteVersion(proposalId: number, actor: QuoteBuilderActor) {
    return this.quoteBuilder.createRevision(proposalId, actor);
  }

  async listQuoteVersions(proposalId: number) {
    return this.quoteBuilder.listVersions(proposalId);
  }

  async diffQuoteVersions(proposalId: number, fromN: number, toN: number) {
    return this.quoteBuilder.diffVersions(proposalId, fromN, toN);
  }

  async patchStatus(proposalId: number, body: PatchProposalStatusBody, actorEmail = 'staff') {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const next = body.status;
    const lostReason = next === 'rejected' ? requireLostReason(body.lost_reason) : null;
    if (next === 'accepted') {
      return this.acceptProposal(
        proposalId,
        Boolean(body.spawn_week),
        actorEmail,
        body.price_adjustment_reason,
      );
    }
    const current = String(proposal.status ?? '');
    const legacyAllowed = PROPOSAL_STATUS_FLOW[current as ProposalStatus];
    const allowed = legacyAllowed
      ? legacyAllowed.includes(next)
      : canTransition(current as QuoteStatus, next as QuoteStatus);
    if (!allowed) {
      throw new BadRequestException({
        error: 'invalid_status_transition',
        from: proposal.status,
        to: next,
      });
    }
    const updated = await this.repo.patchStatus(
      proposalId,
      next,
      body.price_adjustment_reason,
      lostReason,
    );
    return { proposal: updated, lines: await this.repo.listLines(proposalId), lifecycles: [] };
  }

  async convert(proposalId: number, vid: string, actor: QuoteConvertActor) {
    return this.quoteConvert.convert(proposalId, vid, actor);
  }

  private async acceptProposal(
    proposalId: number,
    spawnWeek: boolean,
    actorEmail: string,
    priceAdjustmentReason?: string,
  ) {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    if (proposal.status !== 'accepted') {
      const allowed = PROPOSAL_STATUS_FLOW[proposal.status as ProposalStatus] ?? [];
      if (!allowed.includes('accepted')) {
        throw new BadRequestException({
          error: 'invalid_status_transition',
          from: proposal.status,
          to: 'accepted',
        });
      }
    }

    const versionId = String(proposal.current_version_id ?? '').trim();
    if (!proposal.quote_code && !versionId) {
      return this.acceptDealRoomInline(proposal, spawnWeek, actorEmail, priceAdjustmentReason);
    }

    const previousStatus = proposal.status;
    const updated =
      previousStatus === 'accepted'
        ? proposal
        : await this.repo.patchStatus(proposalId, 'accepted', priceAdjustmentReason);

    try {
      if (!versionId) {
        throw new NotFoundException({ error: 'version_not_found' });
      }
      const conversion = await this.quoteConvert.convert(proposalId, versionId, {
        staffId: 0,
        staffAuthVia: 'internal',
        idempotencyKey: `legacy-accept:${proposalId}`,
      });
      return {
        proposal: updated,
        lines: await this.repo.listLines(proposalId),
        lifecycles: conversion.lifecycles,
      };
    } catch (err) {
      if (previousStatus !== 'accepted') {
        await this.repo.patchStatus(proposalId, previousStatus as ProposalStatus);
      }
      throw err;
    }
  }

  private async acceptDealRoomInline(
    proposal: { id: number; customer_id: number },
    spawnWeek: boolean,
    actorEmail: string,
    priceAdjustmentReason?: string,
  ) {
    const proposalId = proposal.id;
    const lines = await this.repo.listLines(proposalId);
    if (!lines.length) {
      throw new BadRequestException({ error: 'quote_lines_required_for_accept' });
    }

    const lifecycles: Array<{ line_id: number; lifecycle_id: number; dv_code: string }> = [];
    for (const line of lines) {
      if (line.lifecycle_id) {
        lifecycles.push({
          line_id: line.id,
          lifecycle_id: line.lifecycle_id,
          dv_code: line.dv_code,
        });
        continue;
      }
      const note = `Quote #${proposalId} · ${line.dv_code} ${line.package_tier} · ${line.final_price_vnd.toLocaleString('vi-VN')} VND`;
      const created = await this.lifecycle.create({
        customer_id: proposal.customer_id,
        service_slug: line.service_slug,
      });
      await this.repo.activateLifecycle(created.id, 'onboard', note);
      await this.repo.setLineLifecycle(line.id, created.id);
      const skuCode =
        line.sku_code?.trim() ||
        skuFromDvTier(line.dv_code, normalizeQuoteTier(line.package_tier) ?? 'standard');
      try {
        await this.lifecycle.setCommercialSku(created.id, skuCode);
      } catch {
        await this.repo.setLifecycleSkuCode(created.id, skuCode);
      }
      lifecycles.push({ line_id: line.id, lifecycle_id: created.id, dv_code: line.dv_code });

      if (spawnWeek && this.config.opsWeeklySpawnEnabled && this.config.opsDvEnabled) {
        try {
          await this.ops.spawnWeek(created.id, actorEmail);
        } catch {
          // spawn optional — lifecycle still created
        }
      }
    }

    if (lifecycles.length === 1) {
      await this.repo.setProposalLifecycle(proposalId, lifecycles[0].lifecycle_id);
    }

    const updated = await this.repo.patchStatus(proposalId, 'accepted', priceAdjustmentReason);
    return {
      proposal: updated,
      lines: await this.repo.listLines(proposalId),
      lifecycles,
    };
  }

  async exportQuote(proposalId: number, format: 'pdf' | 'docx' = 'pdf') {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const lines = await this.repo.listLines(proposalId);
    const map = this.routeMap.getMap();
    const exportLines = lines.map((line) => {
      const entry = map.services.find((s) => s.code === line.dv_code);
      return {
        dv_code: line.dv_code,
        dv_name: entry?.name_vi ?? line.dv_code,
        package_tier: line.package_tier,
        final_price_vnd: line.final_price_vnd,
      };
    });

    if (format === 'docx') {
      const text = exportLines
        .map(
          (l) =>
            `${l.dv_code} ${l.dv_name} (${l.package_tier}): ${l.final_price_vnd.toLocaleString('vi-VN')} VND`,
        )
        .join('\n');
      const body = `PTT Quote #${proposalId}\n${await this.repo.getCustomerName(proposal.customer_id)}\n\n${text}\n\nTotal: ${proposal.total_vnd.toLocaleString('vi-VN')} VND`;
      return new StreamableFile(Buffer.from(body, 'utf8'), {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: `attachment; filename="${quoteExportFilename(proposalId, 'docx')}"`,
      });
    }

    const pdf = quotePdfBuffer({
      proposalId,
      customerName: await this.repo.getCustomerName(proposal.customer_id),
      lines: exportLines,
      total_vnd: proposal.total_vnd,
      status: proposal.status,
      valid_until: proposal.valid_until,
    });
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${quoteExportFilename(proposalId, 'pdf')}"`,
    });
  }

  async getCatalogForQuote(
    serviceSlugRaw?: string,
    opts?: { hasFinance?: boolean; includeRates?: boolean },
  ) {
    return this.quoteCatalog.get(serviceSlugRaw, opts);
  }

  snapshotCatalogPackage(packageKey: string, quoteDate?: string) {
    return this.quoteCatalog.snapshotPackage(packageKey, quoteDate);
  }

  listCatalogRateCards(quoteDate?: string, hasFinance = false) {
    return this.quoteCatalog.listRateCards(quoteDate, hasFinance);
  }

  importCatalog(input: { filename?: string; csv?: string; json?: unknown; created_by: number }) {
    return this.quoteCatalog.importCatalog(input);
  }

  async generate(proposalId: number) {
    const proposal = await this.repo.getById(proposalId);
    if (!proposal) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {
      ok: true,
      stub: true,
      proposal_id: proposalId,
      sections: {},
      message: 'AI proposal stub — configure ANTHROPIC_API_KEY',
    };
  }

  async remove(proposalId: number) {
    const ok = await this.repo.delete(proposalId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {};
  }
}
