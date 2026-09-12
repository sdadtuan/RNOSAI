import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { requireClient, requireCreative, requireLead } from './msos-crm-ref.util';
import { throwDisabled } from './msos-errors.util';
import { assertAllowedMsosName } from './msos-forbidden-seed.util';
import { MsosRepository } from './msos.repository';
import { decideReserve, type CapacityDecision } from './msos-capacity.util';
import { canIssueIo, evaluateLiveGates } from './msos-gates.util';
import { assertRateBindable } from './msos-rate.util';
import { assertNotSilentActual, classifyDiscrepancy } from './msos-discrepancy.util';
import { canOfficial } from './msos-evidence-pack.util';
import { evaluateTraffic } from './msos-traffic.util';
import { assertMarginSubmit, computeWaterfall } from './msos-margin.util';
import type {
  CapacityBucketInput,
  CreateDiscrepancyInput,
  CreateEvidenceInput,
  CreateEvidencePackInput,
  CreateInventoryInput,
  CreateMakeGoodInput,
  CreateOutcomeLinkInput,
  CreateIoInput,
  CreateMediaLineInput,
  CreatePackageInput,
  CreatePartnerInput,
  CreatePlacementInput,
  CreateRateCardInput,
  CreateRateVersionInput,
  GoLiveInput,
  MsosCalendarDay,
  MsosDiscrepancyCaseRow,
  MsosEvidencePackRow,
  MsosEvidenceRow,
  MsosHealthDto,
  MsosMakeGoodRow,
  MsosOutcomeLinkRow,
  MsosMarginDto,
  MsosMarginSnapshotRow,
  MsosFinanceRequestRow,
  MsosInsertionOrderRow,
  MsosInventoryRow,
  MsosMediaLineRow,
  MsosPackageRow,
  MsosPartnerRow,
  MsosPlacementRow,
  MsosRateCardRow,
  MsosRateVersionRow,
  MsosReservationRow,
  MsosTrafficPackRow,
  ReserveMakeGoodCapacityInput,
  ReservePackageInput,
  SafetyChangeInput,
  UpsertTrafficInput,
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

  async listMediaLines(): Promise<MsosMediaLineRow[]> {
    this.assertEnabled();
    return this.repo.listMediaLines();
  }

  async createMediaLine(input: CreateMediaLineInput): Promise<MsosMediaLineRow> {
    this.assertEnabled();
    const pkg = await this.repo.getPackage(input.package_id);
    if (!pkg) {
      throw new UnprocessableEntityException({ error: 'package_not_found' });
    }
    await requireClient(this.repo.db, pkg.client_id);
    if (input.io_id) {
      const io = await this.repo.getInsertionOrder(input.io_id);
      if (!io || io.package_id !== input.package_id) {
        throw new UnprocessableEntityException({ error: 'io_not_found' });
      }
    }
    return this.repo.createMediaLine({
      ...input,
      client_id: pkg.client_id,
    });
  }

  private async buildLiveGateInput(line: MsosMediaLineRow) {
    const io = line.io_id ? await this.repo.getInsertionOrder(line.io_id) : null;
    const rate = io ? await this.repo.getRateVersionById(io.rate_version_id) : null;
    const reserveOk = io ? await this.repo.hasValidReserve(io.package_id) : false;
    const traffic = await this.repo.getTrafficPack(line.id);
    const placement = await this.repo.getPlacementForLine(line.id);
    const trafficReady = this.isTrafficReady(traffic, placement);
    return {
      ioIssued: io?.status === 'issued' || io?.status === 'confirmed',
      ratePublished: rate?.status === 'published',
      reserveOk,
      clientOk: Boolean(line.client_id),
      safetyLocked: Boolean(io?.safety_snapshot_id),
      trafficReady,
      partnerConfirmed: Boolean(io?.partner_confirmed_at),
      p03Override: Boolean(line.p03_override_by),
      trackingOwner: Boolean(line.tracking_owner_staff_id),
    };
  }

  private isTrafficReady(
    traffic: MsosTrafficPackRow | null,
    placement: { backup_required: boolean; max_weight_kb: number | null } | null,
  ): boolean {
    if (!traffic) return false;
    return evaluateTraffic({
      creativeId: traffic.creative_id,
      width: traffic.width_px,
      height: traffic.height_px,
      weightKb: traffic.weight_kb,
      maxWeightKb: placement?.max_weight_kb ?? null,
      clickUrl: traffic.click_url,
      backupRequired: placement?.backup_required ?? false,
      backupAttached: traffic.backup_attached,
      status: traffic.status,
    }).ready;
  }

  async getLiveGates(lineId: string): Promise<{ canLive: boolean; gates: ReturnType<typeof evaluateLiveGates>['gates'] }> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const input = await this.buildLiveGateInput(line);
    return evaluateLiveGates(input);
  }

  async goLive(lineId: string, body: GoLiveInput, staffId: number | null): Promise<MsosMediaLineRow> {
    this.assertEnabled();
    if (body.actor === 'ai') {
      throw new ForbiddenException({ error: 'ai_action_forbidden' });
    }
    if (!body.confirm) {
      throw new UnprocessableEntityException({ error: 'human_confirm_required' });
    }
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const gates = await this.getLiveGates(lineId);
    if (!gates.canLive) {
      throw new UnprocessableEntityException({ error: 'live_gates_blocked' });
    }
    return this.repo.setMediaLineLive(lineId, staffId);
  }

  async setP03Override(lineId: string, staffId: number | null): Promise<MsosMediaLineRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    return this.repo.setP03Override(lineId, staffId);
  }

  async getTraffic(lineId: string): Promise<MsosTrafficPackRow | null> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    return this.repo.getTrafficPack(lineId);
  }

  async upsertTraffic(lineId: string, input: UpsertTrafficInput): Promise<MsosTrafficPackRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    if (input.creative_id) {
      await requireCreative(this.repo.db, input.creative_id);
    }
    return this.repo.upsertTrafficPack(lineId, input);
  }

  async submitTraffic(lineId: string): Promise<MsosTrafficPackRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    try {
      return await this.repo.submitTrafficPack(lineId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'traffic_pack_not_found') {
        throw new UnprocessableEntityException({ error: 'traffic_pack_not_found' });
      }
      throw e;
    }
  }

  async evaluateTrafficReady(lineId: string): Promise<{ ready: boolean; reasons: string[] }> {
    this.assertEnabled();
    const traffic = await this.repo.getTrafficPack(lineId);
    const placement = await this.repo.getPlacementForLine(lineId);
    if (!traffic) {
      return { ready: false, reasons: ['traffic_pack_missing'] };
    }
    return evaluateTraffic({
      creativeId: traffic.creative_id,
      width: traffic.width_px,
      height: traffic.height_px,
      weightKb: traffic.weight_kb,
      maxWeightKb: placement?.max_weight_kb ?? null,
      clickUrl: traffic.click_url,
      backupRequired: placement?.backup_required ?? false,
      backupAttached: traffic.backup_attached,
      status: traffic.status,
    });
  }

  async createEvidence(input: CreateEvidenceInput): Promise<MsosEvidenceRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(input.media_line_id);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    return this.repo.createEvidence(input);
  }

  async createEvidencePack(input: CreateEvidencePackInput): Promise<MsosEvidencePackRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(input.media_line_id);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    return this.repo.createEvidencePack(input);
  }

  async addEvidencePackItem(packId: string, evidenceId: string): Promise<void> {
    this.assertEnabled();
    const pack = await this.repo.getEvidencePack(packId);
    if (!pack) {
      throw new UnprocessableEntityException({ error: 'evidence_pack_not_found' });
    }
    await this.repo.addEvidencePackItem(packId, evidenceId);
  }

  async officialEvidencePack(packId: string): Promise<MsosEvidencePackRow> {
    this.assertEnabled();
    const pack = await this.repo.getEvidencePack(packId);
    if (!pack) {
      throw new UnprocessableEntityException({ error: 'evidence_pack_not_found' });
    }
    const items = await this.repo.getEvidencePackItems(packId);
    const ready = canOfficial(
      items.map((item) => ({
        hash: item.hash,
        source: item.source,
        capturedAt: new Date(item.captured_at),
      })),
      new Date(),
    );
    if (!ready) {
      throw new UnprocessableEntityException({ error: 'evidence_not_official_ready' });
    }
    try {
      return await this.repo.markEvidencePackOfficial(packId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'evidence_pack_not_draft') {
        throw new UnprocessableEntityException({ error: 'evidence_pack_not_draft' });
      }
      throw e;
    }
  }

  async createDiscrepancy(
    lineId: string,
    input: CreateDiscrepancyInput,
  ): Promise<MsosDiscrepancyCaseRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const io = await this.repo.getInsertionOrderForLine(lineId);
    const ioQty = io?.qty ?? 0;
    const toleranceBps = input.tolerance_bps ?? 300;
    if (input.actual_qty != null) {
      assertNotSilentActual(ioQty, input.actual_qty, input.report_qty ?? null);
    }
    const { material } = classifyDiscrepancy(ioQty, input.report_qty ?? null, toleranceBps);
    return this.repo.createDiscrepancyCase(lineId, {
      ...input,
      io_qty: ioQty,
      material,
      tolerance_bps: toleranceBps,
    });
  }

  async createMakeGood(dcId: string, input: CreateMakeGoodInput): Promise<MsosMakeGoodRow> {
    this.assertEnabled();
    const dc = await this.repo.getDiscrepancyCase(dcId);
    if (!dc) {
      throw new UnprocessableEntityException({ error: 'discrepancy_not_found' });
    }
    return this.repo.createMakeGood(dcId, {
      ...input,
      media_line_id: dc.media_line_id,
    });
  }

  async reserveMakeGoodCapacity(
    mgId: string,
    input: ReserveMakeGoodCapacityInput,
  ): Promise<MsosMakeGoodRow> {
    this.assertEnabled();
    const mg = await this.repo.getMakeGood(mgId);
    if (!mg) {
      throw new UnprocessableEntityException({ error: 'make_good_not_found' });
    }
    if (mg.capacity_reserved) {
      throw new UnprocessableEntityException({ error: 'make_good_already_reserved' });
    }
    const line = await this.repo.getMediaLine(mg.media_line_id);
    const bucket = await this.repo.getCapacityBucket(input.placement_id, input.bucket_date);
    if (!bucket) {
      throw new UnprocessableEntityException({ error: 'capacity_bucket_not_found' });
    }
    await this.evaluateHardReserve({
      placementId: input.placement_id,
      total: bucket.total,
      reservedHard: bucket.reserved_hard,
      reservedSoft: bucket.reserved_soft,
      addQty: mg.qty,
    });
    await this.repo.incrementCapacityReserved(
      input.placement_id,
      input.bucket_date,
      'hard',
      mg.qty,
    );
    if (line?.package_id) {
      await this.repo.insertReservation({
        package_id: line.package_id,
        placement_id: input.placement_id,
        bucket_date: input.bucket_date,
        kind: 'hard',
        qty: mg.qty,
      });
    }
    try {
      return await this.repo.reserveMakeGoodCapacity(mgId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'make_good_not_found_or_reserved') {
        throw new UnprocessableEntityException({ error: 'make_good_not_found' });
      }
      throw e;
    }
  }

  async listOutcomeLinks(): Promise<MsosOutcomeLinkRow[]> {
    this.assertEnabled();
    return this.repo.listOutcomeLinks();
  }

  async createOutcomeLink(input: CreateOutcomeLinkInput): Promise<MsosOutcomeLinkRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(input.media_line_id);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const leadId = input.lead_id ?? null;
    if (leadId) {
      await requireLead(this.repo.db, leadId);
    }
    const matchStatus = leadId ? 'matched' : 'unmatched';
    return this.repo.createOutcomeLink({
      ...input,
      lead_id: leadId,
      match_status: matchStatus,
    });
  }

  private buildMarginDto(
    inputs: Awaited<ReturnType<MsosRepository['getMarginInputs']>>,
    snapshot: MsosMarginSnapshotRow | null,
  ): MsosMarginDto {
    const waterfall = computeWaterfall({
      grossSell: inputs.gross_sell_vnd,
      discount: inputs.discount_vnd,
      mediaCost: inputs.media_cost_vnd,
      makeGoodCost: inputs.make_good_cost_vnd,
      rebateAccrued: inputs.rebate_accrued_vnd,
      serviceCost: inputs.service_cost_vnd,
    });
    return {
      ...inputs,
      contribution_vnd: waterfall.contribution,
      contribution_bps: waterfall.contributionBps,
      closed: snapshot?.closed ?? false,
      snapshot_id: snapshot?.id ?? null,
    };
  }

  async getMargin(lineId: string): Promise<MsosMarginDto> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const inputs = await this.repo.getMarginInputs(lineId);
    const snapshot = await this.repo.getLatestMarginSnapshot(lineId);
    return this.buildMarginDto(inputs, snapshot);
  }

  async submitMargin(
    lineId: string,
    opts: { isAdmin: boolean },
  ): Promise<MsosMarginSnapshotRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const inputs = await this.repo.getMarginInputs(lineId);
    const waterfall = computeWaterfall({
      grossSell: inputs.gross_sell_vnd,
      discount: inputs.discount_vnd,
      mediaCost: inputs.media_cost_vnd,
      makeGoodCost: inputs.make_good_cost_vnd,
      rebateAccrued: inputs.rebate_accrued_vnd,
      serviceCost: inputs.service_cost_vnd,
    });
    assertMarginSubmit(waterfall.contributionBps, opts.isAdmin);
    const officialPack = await this.repo.getOfficialEvidencePack(lineId);
    return this.repo.insertMarginSnapshot({
      media_line_id: lineId,
      gross_sell_vnd: inputs.gross_sell_vnd,
      discount_vnd: inputs.discount_vnd,
      media_cost_vnd: inputs.media_cost_vnd,
      make_good_cost_vnd: inputs.make_good_cost_vnd,
      rebate_accrued_vnd: inputs.rebate_accrued_vnd,
      service_cost_vnd: inputs.service_cost_vnd,
      contribution_vnd: waterfall.contribution,
      contribution_bps: waterfall.contributionBps,
      closed: Boolean(officialPack),
    });
  }

  async createFinanceRequest(lineId: string, staffId: number): Promise<MsosFinanceRequestRow> {
    this.assertEnabled();
    const line = await this.repo.getMediaLine(lineId);
    if (!line) {
      throw new UnprocessableEntityException({ error: 'media_line_not_found' });
    }
    const officialPack = await this.repo.getOfficialEvidencePack(lineId);
    if (!officialPack) {
      throw new UnprocessableEntityException({ error: 'evidence_not_official' });
    }
    const materialOpen = await this.repo.hasOpenMaterialDiscrepancy(lineId);
    if (materialOpen) {
      throw new UnprocessableEntityException({ error: 'discrepancy_material_open' });
    }
    return this.repo.insertFinanceRequest({
      media_line_id: lineId,
      evidence_pack_id: officialPack.id,
      requested_by: staffId,
    });
  }
}
