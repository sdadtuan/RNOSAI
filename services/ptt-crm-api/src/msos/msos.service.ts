import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { throwDisabled } from './msos-errors.util';
import { assertAllowedMsosName } from './msos-forbidden-seed.util';
import { MsosRepository } from './msos.repository';
import { decideReserve, type CapacityDecision } from './msos-capacity.util';
import { assertRateBindable } from './msos-rate.util';
import type {
  CapacityBucketInput,
  CreateInventoryInput,
  CreatePartnerInput,
  CreatePlacementInput,
  CreateRateCardInput,
  CreateRateVersionInput,
  MsosCalendarDay,
  MsosHealthDto,
  MsosInventoryRow,
  MsosPartnerRow,
  MsosPlacementRow,
  MsosRateCardRow,
  MsosRateVersionRow,
} from './msos.types';

@Injectable()
export class MsosService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MsosRepository,
  ) {}

  assertEnabled(): void {
    if (!this.config.mediaOsEnabled) {
      throwDisabled();
    }
  }

  getHealth(): MsosHealthDto {
    return {
      ok: true,
      reseller: this.config.mediaOsReseller,
      connector_write: this.config.mediaOsConnectorWrite,
    };
  }

  async listPartners(): Promise<MsosPartnerRow[]> {
    this.assertEnabled();
    return this.repo.listPartners();
  }

  async createPartner(input: CreatePartnerInput): Promise<MsosPartnerRow> {
    this.assertEnabled();
    const legalName = String(input.legal_name ?? '').trim();
    if (!legalName) {
      throw new UnprocessableEntityException({ error: 'legal_name_required' });
    }
    assertAllowedMsosName(legalName);
    return this.repo.createPartner({ ...input, legal_name: legalName });
  }

  async listInventories(): Promise<MsosInventoryRow[]> {
    this.assertEnabled();
    return this.repo.listInventories();
  }

  async createInventory(input: CreateInventoryInput): Promise<MsosInventoryRow> {
    this.assertEnabled();
    const name = String(input.name ?? '').trim();
    if (!name) {
      throw new UnprocessableEntityException({ error: 'name_required' });
    }
    assertAllowedMsosName(name);
    if (input.property_host) {
      assertAllowedMsosName(input.property_host);
    }
    if (input.owner_kind === 'partner' && !input.partner_id) {
      throw new UnprocessableEntityException({ error: 'partner_id_required' });
    }
    if (input.owner_kind === 'ptt' && input.partner_id) {
      throw new UnprocessableEntityException({ error: 'partner_id_forbidden_for_ptt' });
    }
    return this.repo.createInventory({ ...input, name });
  }

  async listPlacements(): Promise<MsosPlacementRow[]> {
    this.assertEnabled();
    return this.repo.listPlacements();
  }

  async createPlacement(input: CreatePlacementInput): Promise<MsosPlacementRow> {
    this.assertEnabled();
    const name = String(input.name ?? '').trim();
    if (!name) {
      throw new UnprocessableEntityException({ error: 'name_required' });
    }
    assertAllowedMsosName(name);
    return this.repo.createPlacement({ ...input, name });
  }

  async createRateCard(input: CreateRateCardInput): Promise<MsosRateCardRow> {
    this.assertEnabled();
    if (input.owner_kind === 'partner' && !input.partner_id) {
      throw new UnprocessableEntityException({ error: 'partner_id_required' });
    }
    if (input.owner_kind === 'ptt' && input.partner_id) {
      throw new UnprocessableEntityException({ error: 'partner_id_forbidden_for_ptt' });
    }
    return this.repo.createRateCard(input);
  }

  async appendRateVersion(rateCardId: string, input: CreateRateVersionInput): Promise<MsosRateVersionRow> {
    this.assertEnabled();
    if (!Number.isFinite(input.unit_price_vnd) || input.unit_price_vnd < 0) {
      throw new UnprocessableEntityException({ error: 'unit_price_invalid' });
    }
    return this.repo.appendRateVersion(rateCardId, input);
  }

  async publishRateVersion(
    rateCardId: string,
    version: number,
    publishedBy: number | null,
  ): Promise<MsosRateVersionRow> {
    this.assertEnabled();
    try {
      const row = await this.repo.publishRateVersion(rateCardId, version, publishedBy);
      assertRateBindable(row.status);
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'rate_version_not_found') {
        throw new UnprocessableEntityException({ error: 'rate_version_not_found' });
      }
      if (msg === 'rate_version_immutable') {
        throw new UnprocessableEntityException({ error: 'rate_version_immutable' });
      }
      throw e;
    }
  }

  async updateRateVersionPrice(
    rateCardId: string,
    version: number,
    unitPriceVnd: number,
  ): Promise<MsosRateVersionRow> {
    this.assertEnabled();
    try {
      return await this.repo.updateRateVersionPrice(rateCardId, version, unitPriceVnd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'rate_version_not_found') {
        throw new UnprocessableEntityException({ error: 'rate_version_not_found' });
      }
      if (msg === 'rate_version_immutable') {
        throw new UnprocessableEntityException({ error: 'rate_version_immutable' });
      }
      throw e;
    }
  }

  async setPlacementCapacity(placementId: string, buckets: CapacityBucketInput[]): Promise<void> {
    this.assertEnabled();
    if (!buckets.length) {
      throw new UnprocessableEntityException({ error: 'capacity_buckets_required' });
    }
    await this.repo.upsertCapacityBuckets(placementId, buckets);
    await this.syncCapacityConflictExceptions(placementId);
  }

  async getPlacementCalendar(placementId: string, from: string, to: string): Promise<MsosCalendarDay[]> {
    this.assertEnabled();
    const days = await this.repo.getPlacementCalendar(placementId, from, to);
    if (days.some((day) => day.conflict)) {
      await this.insertCapacityConflictException(placementId, days);
    }
    return days;
  }

  async evaluateSoftReserve(input: {
    placementId: string;
    total: number;
    reservedHard: number;
    reservedSoft: number;
    addQty: number;
    partnerStatus?: string | null;
  }): Promise<CapacityDecision> {
    this.assertEnabled();
    const partnerStatus =
      input.partnerStatus ?? (await this.repo.getPartnerStatusForPlacement(input.placementId)) ?? 'approved';
    const decision = decideReserve({
      total: input.total,
      reservedHard: input.reservedHard,
      reservedSoft: input.reservedSoft,
      addQty: input.addQty,
      kind: 'soft',
      partnerStatus,
    });
    if (!decision.ok) {
      if (decision.error === 'partner_suspended') {
        throw new UnprocessableEntityException({ error: 'partner_suspended' });
      }
      throw new UnprocessableEntityException({ error: decision.error });
    }
    if (decision.conflict) {
      await this.repo.insertException({
        priority: 'P0',
        kind: 'capacity_conflict',
        placement_id: input.placementId,
        title: 'Soft reserve capacity conflict',
        evidence_text: `reserved_hard=${input.reservedHard} reserved_soft=${input.reservedSoft}+${input.addQty} total=${input.total}`,
      });
    }
    return decision;
  }

  async evaluateHardReserve(input: {
    placementId: string;
    total: number;
    reservedHard: number;
    reservedSoft: number;
    addQty: number;
    partnerStatus?: string | null;
  }): Promise<CapacityDecision> {
    this.assertEnabled();
    const partnerStatus =
      input.partnerStatus ?? (await this.repo.getPartnerStatusForPlacement(input.placementId)) ?? 'approved';
    const decision = decideReserve({
      total: input.total,
      reservedHard: input.reservedHard,
      reservedSoft: input.reservedSoft,
      addQty: input.addQty,
      kind: 'hard',
      partnerStatus,
    });
    if (!decision.ok) {
      if (decision.error === 'partner_suspended') {
        throw new UnprocessableEntityException({ error: 'partner_suspended' });
      }
      throw new UnprocessableEntityException({ error: 'overbook_hard' });
    }
    return decision;
  }

  private async syncCapacityConflictExceptions(placementId: string): Promise<void> {
    const days = await this.repo.getPlacementCalendar(
      placementId,
      '1970-01-01',
      '2099-12-31',
    );
    const conflicts = days.filter((day) => day.conflict);
    if (conflicts.length) {
      await this.insertCapacityConflictException(placementId, conflicts);
    }
  }

  private async insertCapacityConflictException(
    placementId: string,
    days: MsosCalendarDay[],
  ): Promise<void> {
    const summary = days
      .slice(0, 5)
      .map((d) => `${d.date}: hard=${d.reserved_hard} soft=${d.reserved_soft}/${d.total}`)
      .join('; ');
    await this.repo.insertException({
      priority: 'P0',
      kind: 'capacity_conflict',
      placement_id: placementId,
      title: 'Capacity calendar conflict',
      evidence_text: summary,
    });
  }
}
