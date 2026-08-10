import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OpsProfilePgRepository } from '../ops/ops-profile-pg.repository';
import { OpsRouteMapLoader } from '../ops/ops-route-map.loader';
import { OpsService } from '../ops/ops.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { ProposalsSqliteRepository } from './proposals-sqlite.repository';
import {
  normalizeQuoteTier,
  quoteExportFilename,
  quotePdfBuffer,
  resolveTierPricing,
  type QuotePackageTier,
} from './quote-pricing.util';
import {
  CreateProposalBody,
  PatchProposalStatusBody,
  PROPOSAL_STATUS_FLOW,
  ProposalStatus,
  PutQuoteLinesBody,
  QuoteLineInput,
} from './proposals.types';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly sqlite: ProposalsSqliteRepository,
    private readonly routeMap: OpsRouteMapLoader,
    private readonly profiles: OpsProfilePgRepository,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly ops: OpsService,
    private readonly config: AppConfigService,
  ) {}

  list(customerIdRaw?: string) {
    const customerId = Number(customerIdRaw ?? 0);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      throw new BadRequestException({ error: 'Cần customer_id' });
    }
    const proposals = this.sqlite.listByCustomer(customerId).map((p) => ({
      ...p,
      line_count: this.sqlite.listLines(p.id).length,
    }));
    return { proposals };
  }

  detail(proposalId: number) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {
      ...proposal,
      lines: this.sqlite.listLines(proposalId),
    };
  }

  getLines(proposalId: number) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    return { proposal_id: proposalId, lines: this.sqlite.listLines(proposalId) };
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
    const entry = this.resolveDvEntry(line.dv_code);
    const tier = normalizeQuoteTier(line.package_tier);
    if (!tier) {
      throw new BadRequestException({ error: 'invalid_package_tier', tier: line.package_tier });
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

  async create(body: CreateProposalBody) {
    const customerId = Number(body.customer_id ?? 0);
    if (!customerId) {
      throw new BadRequestException({ error: 'Thiếu customer_id' });
    }
    const lines = body.lines ?? [];
    const slugs = (body.service_slugs ?? []).map((s) => String(s).trim()).filter(Boolean);
    if (!lines.length && !slugs.length) {
      throw new BadRequestException({ error: 'Thiếu lines hoặc service_slugs' });
    }

    const created = this.sqlite.create(body);
    if (lines.length) {
      const resolved = await Promise.all(lines.map((line) => this.resolveLinePricing(line)));
      this.sqlite.replaceLines(created.id, resolved);
    }
    return this.detail(created.id);
  }

  async putLines(proposalId: number, body: PutQuoteLinesBody) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    if (proposal.status === 'accepted') {
      throw new BadRequestException({ error: 'proposal_already_accepted' });
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw new BadRequestException({ error: 'lines_required' });
    }
    const resolved = await Promise.all(body.lines.map((line) => this.resolveLinePricing(line)));
    const items = this.sqlite.replaceLines(proposalId, resolved, body.price_adjustment_reason);
    return { proposal_id: proposalId, lines: items, total_vnd: items.reduce((s, l) => s + l.final_price_vnd, 0) };
  }

  patchStatus(proposalId: number, body: PatchProposalStatusBody, actorEmail = 'staff') {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const next = body.status;
    const allowed = PROPOSAL_STATUS_FLOW[proposal.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException({
        error: 'invalid_status_transition',
        from: proposal.status,
        to: next,
      });
    }
    if (next === 'accepted') {
      return this.acceptProposal(proposalId, Boolean(body.spawn_week), actorEmail, body.price_adjustment_reason);
    }
    const updated = this.sqlite.patchStatus(proposalId, next, body.price_adjustment_reason);
    return { proposal: updated, lines: this.sqlite.listLines(proposalId) };
  }

  private async acceptProposal(
    proposalId: number,
    spawnWeek: boolean,
    actorEmail: string,
    priceAdjustmentReason?: string,
  ) {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const lines = this.sqlite.listLines(proposalId);
    if (!lines.length) {
      throw new BadRequestException({ error: 'quote_lines_required_for_accept' });
    }

    const lifecycles: Array<{ line_id: number; lifecycle_id: number; dv_code: string }> = [];
    for (const line of lines) {
      if (line.lifecycle_id) {
        lifecycles.push({ line_id: line.id, lifecycle_id: line.lifecycle_id, dv_code: line.dv_code });
        continue;
      }
      const note = `Quote #${proposalId} · ${line.dv_code} ${line.package_tier} · ${line.final_price_vnd.toLocaleString('vi-VN')} VND`;
      const created = await this.lifecycle.create({
        customer_id: proposal.customer_id,
        service_slug: line.service_slug,
      });
      this.sqlite.activateLifecycle(created.id, 'onboard', note);
      this.sqlite.setLineLifecycle(line.id, created.id);
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
      this.sqlite.setProposalLifecycle(proposalId, lifecycles[0].lifecycle_id);
    }

    const updated = this.sqlite.patchStatus(proposalId, 'accepted', priceAdjustmentReason);
    return {
      proposal: updated,
      lines: this.sqlite.listLines(proposalId),
      lifecycles,
    };
  }

  async exportQuote(proposalId: number, format: 'pdf' | 'docx' = 'pdf') {
    const proposal = this.sqlite.getById(proposalId);
    if (!proposal) throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    const lines = this.sqlite.listLines(proposalId);
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
      const body = `PTT Quote #${proposalId}\n${this.sqlite.getCustomerName(proposal.customer_id)}\n\n${text}\n\nTotal: ${proposal.total_vnd.toLocaleString('vi-VN')} VND`;
      return new StreamableFile(Buffer.from(body, 'utf8'), {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        disposition: `attachment; filename="${quoteExportFilename(proposalId, 'docx')}"`,
      });
    }

    const pdf = quotePdfBuffer({
      proposalId,
      customerName: this.sqlite.getCustomerName(proposal.customer_id),
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

  getCatalogForQuote() {
    const map = this.routeMap.getMap();
    return {
      schema_version: map.schema_version,
      package_tiers: ['basic', 'standard', 'premium'] as QuotePackageTier[],
      services: map.services.map((s) => ({
        dv_code: s.code,
        name: s.name_vi,
        service_slug: s.service_slugs.primary,
        readiness: s.readiness,
        depends_on_dv: s.depends_on_dv ?? [],
      })),
    };
  }

  generate(proposalId: number) {
    const proposal = this.sqlite.getById(proposalId);
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

  remove(proposalId: number) {
    const ok = this.sqlite.delete(proposalId);
    if (!ok) {
      throw new NotFoundException({ error: 'Không tìm thấy đề xuất' });
    }
    return {};
  }
}
