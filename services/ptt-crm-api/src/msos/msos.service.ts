import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { requireClient } from './msos-crm-ref.util';
import { throwDisabled } from './msos-errors.util';
import { assertAllowedMsosName } from './msos-forbidden-seed.util';
import { MsosRepository } from './msos.repository';
import { decideReserve, type CapacityDecision } from './msos-capacity.util';
import { canIssueIo } from './msos-gates.util';
import { assertRateBindable } from './msos-rate.util';
import type {
  CapacityBucketInput,
  CreateInventoryInput,
  CreateIoInput,
  CreatePackageInput,
  CreatePartnerInput,
  CreatePlacementInput,
  CreateRateCardInput,
  CreateRateVersionInput,
  MsosCalendarDay,
  MsosHealthDto,
  MsosInsertionOrderRow,
  MsosInventoryRow,
  MsosPackageRow,
  MsosPartnerRow,
  MsosPlacementRow,
  MsosRateCardRow,
  MsosRateVersionRow,
  MsosReservationRow,
  ReservePackageInput,
  SafetyChangeInput,
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

  async listPackages(): Promise<MsosPackageRow[]> {
    this.assertEnabled();
    return this.repo.listPackages();
  }

  async createPackage(input: CreatePackageInput): Promise<MsosPackageRow> {
    this.assertEnabled();
    if (!input.lines?.length) {
      throw new UnprocessableEntityException({ error: 'package_lines_required' });
    }
    await requireClient(this.repo.db, input.client_id);
    let sellVnd = input.sell_vnd ?? 0;
    for (const line of input.lines) {
      const rate = await this.repo.getRateVersionById(line.rate_version_id);
      if (!rate) {
        throw new UnprocessableEntityException({ error: 'rate_version_not_found' });
      }
      assertRateBindable(rate.status);
      if (!input.sell_vnd) {
        sellVnd += rate.unit_price_vnd * line.qty;
      }
    }
    const hideBuySide = this.config.mediaOsReseller ? Boolean(input.hide_buy_side) : false;
    return this.repo.createPackage({
      ...input,
      sell_vnd: sellVnd,
      hide_buy_side: hideBuySide,
    });
  }

  async reservePackage(packageId: string, input: ReservePackageInput): Promise<MsosReservationRow> {
    this.assertEnabled();
    const pkg = await this.repo.getPackage(packageId);
    if (!pkg) {
      throw new UnprocessableEntityException({ error: 'package_not_found' });
    }
    const bucket = await this.repo.getCapacityBucket(input.placement_id, input.bucket_date);
    if (!bucket && input.kind !== 'waitlist') {
      throw new UnprocessableEntityException({ error: 'capacity_bucket_not_found' });
    }
    const total = bucket?.total ?? 0;
    const reservedHard = bucket?.reserved_hard ?? 0;
    const reservedSoft = bucket?.reserved_soft ?? 0;

    if (input.kind === 'waitlist') {
      return this.repo.insertReservation({
        package_id: packageId,
        placement_id: input.placement_id,
        bucket_date: input.bucket_date,
        kind: 'waitlist',
        qty: input.qty,
      });
    }

    if (input.kind === 'soft') {
      const decision = await this.evaluateSoftReserve({
        placementId: input.placement_id,
        total,
        reservedHard,
        reservedSoft,
        addQty: input.qty,
      });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await this.repo.incrementCapacityReserved(
        input.placement_id,
        input.bucket_date,
        'soft',
        input.qty,
      );
      return this.repo.insertReservation({
        package_id: packageId,
        placement_id: input.placement_id,
        bucket_date: input.bucket_date,
        kind: 'soft',
        qty: input.qty,
        expires_at: expiresAt,
      });
    }

    await this.evaluateHardReserve({
      placementId: input.placement_id,
      total,
      reservedHard,
      reservedSoft,
      addQty: input.qty,
    });
    await this.repo.incrementCapacityReserved(
      input.placement_id,
      input.bucket_date,
      'hard',
      input.qty,
    );
    return this.repo.insertReservation({
      package_id: packageId,
      placement_id: input.placement_id,
      bucket_date: input.bucket_date,
      kind: 'hard',
      qty: input.qty,
    });
  }

  async createIo(packageId: string, input: CreateIoInput): Promise<MsosInsertionOrderRow> {
    this.assertEnabled();
    const pkg = await this.repo.getPackage(packageId);
    if (!pkg) {
      throw new UnprocessableEntityException({ error: 'package_not_found' });
    }
    await requireClient(this.repo.db, pkg.client_id);
    const rate = await this.repo.getRateVersionById(input.rate_version_id);
    if (!rate) {
      throw new UnprocessableEntityException({ error: 'rate_version_not_found' });
    }
    assertRateBindable(rate.status);
    const snapshot = await this.repo.createBrandSafetySnapshot({
      tier: input.tier ?? 'A',
    });
    const sellVnd = input.sell_vnd ?? pkg.sell_vnd;
    const buyVnd = input.buy_vnd ?? 0;
    return this.repo.createInsertionOrder(packageId, {
      ...input,
      client_id: pkg.client_id,
      safety_snapshot_id: snapshot.id,
      sell_vnd: sellVnd,
      buy_vnd: buyVnd,
    });
  }

  async getIo(ioId: string): Promise<MsosInsertionOrderRow> {
    this.assertEnabled();
    const io = await this.repo.getInsertionOrder(ioId);
    if (!io) {
      throw new UnprocessableEntityException({ error: 'io_not_found' });
    }
    return io;
  }

  async issueIo(ioId: string, staffId: number | null): Promise<MsosInsertionOrderRow> {
    this.assertEnabled();
    const io = await this.repo.getInsertionOrder(ioId);
    if (!io) {
      throw new UnprocessableEntityException({ error: 'io_not_found' });
    }
    const rate = await this.repo.getRateVersionById(io.rate_version_id);
    const reserveOk = await this.repo.hasValidReserve(io.package_id);
    const gate = canIssueIo({
      rateStatus: rate?.status ?? 'draft',
      clientOk: Boolean(io.client_id),
      hasSafetySnapshot: Boolean(io.safety_snapshot_id),
      hardOrValidSoft: reserveOk,
    });
    if (!gate.pass) {
      throw new UnprocessableEntityException({ error: gate.fail ?? 'io_issue_blocked' });
    }
    try {
      const issued = await this.repo.issueInsertionOrder(ioId, staffId);
      await this.repo.appendIoRevision(ioId, { action: 'issue', io: issued }, staffId);
      return issued;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'io_not_found_or_not_draft') {
        throw new UnprocessableEntityException({ error: 'io_not_draft' });
      }
      throw e;
    }
  }

  async changeIoSafety(ioId: string, input: SafetyChangeInput): Promise<MsosInsertionOrderRow> {
    this.assertEnabled();
    const io = await this.repo.getInsertionOrder(ioId);
    if (!io) {
      throw new UnprocessableEntityException({ error: 'io_not_found' });
    }
    const snapshot = await this.repo.createBrandSafetySnapshot({
      tier: input.tier,
      alcohol_pharma_banned: input.alcohol_pharma_banned,
      exclusions_json: input.exclusions_json,
    });
    await this.repo.updateIoSafetySnapshot(ioId, snapshot.id);
    await this.repo.appendIoRevision(
      ioId,
      { action: 'safety_change', previous_snapshot: io.safety_snapshot_id, new_snapshot: snapshot.id },
      input.staffId ?? null,
    );
    const updated = await this.repo.getInsertionOrder(ioId);
    return updated!;
  }

  async exportIo(ioId: string): Promise<MsosInsertionOrderRow> {
    return this.getIo(ioId);
  }
}
