import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MsosController } from './msos.controller';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

/**
 * MSOS W1+WIN acceptance — in-process service + mocked repo (no HTTP/browser).
 * Synthetic fixture IDs only; no forbidden demo names.
 */
describe('MSOS W1 acceptance locks', () => {
  const enabledConfig = {
    mediaOsEnabled: true,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const disabledConfig = {
    mediaOsEnabled: false,
    mediaOsReseller: false,
    mediaOsConnectorWrite: false,
  } as AppConfigService;

  const clientId = '00000000-0000-4000-8000-000000000001';
  const partnerId = '00000000-0000-4000-8000-000000000002';
  const inventoryId = '00000000-0000-4000-8000-000000000003';
  const placementId = '00000000-0000-4000-8000-000000000010';
  const rateCardId = '00000000-0000-4000-8000-000000000011';
  const rateVersionId = '00000000-0000-4000-8000-000000000020';
  const packageId = '00000000-0000-4000-8000-000000000030';
  const snapshotId = '00000000-0000-4000-8000-000000000050';
  const ioId = '00000000-0000-4000-8000-000000000040';
  const lineId = '00000000-0000-4000-8000-000000000060';
  const packId = '00000000-0000-4000-8000-000000000080';
  const evidenceId = '00000000-0000-4000-8000-000000000090';
  const creativeId = '00000000-0000-4000-8000-000000000070';
  const bucketDate = '2026-09-12';

  const makeTrackingDb = () => {
    const sqls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        if (/FROM clients/i.test(sql)) return { rows: [{ id: clientId }] };
        if (/FROM leads/i.test(sql)) return { rows: [{ id: '00000000-0000-4000-8000-000000000071' }] };
        if (/FROM crm_cp_assets/i.test(sql)) return { rows: [{ id: creativeId }] };
        return { rows: [] };
      }),
      sqls,
    };
    return db;
  };

  it('flag off → assertEnabled throws media_os_disabled', () => {
    const svc = new MsosService(disabledConfig, {} as MsosRepository);
    expect(() => svc.assertEnabled()).toThrow(NotFoundException);
    try {
      svc.assertEnabled();
    } catch (e) {
      expect((e as NotFoundException).getResponse()).toEqual({ error: 'media_os_disabled' });
    }
  });

  it('booking happy path on same media_line_id through finance request', async () => {
    const db = makeTrackingDb();
    let lineStatus = 'ready';
    let packStatus: 'draft' | 'official' = 'draft';

    const repo = {
      db,
      createPartner: jest.fn().mockResolvedValue({
        id: partnerId,
        display_code: 'PTN-20260912-A1B2',
        legal_name: 'Cong ty TNHH Test Truyen thong',
        status: 'approved',
        kyc_pass: true,
      }),
      createInventory: jest.fn().mockResolvedValue({
        id: inventoryId,
        display_code: 'INV-20260912-B2C3',
        name: 'Property Test Publisher',
        owner_kind: 'partner',
        partner_id: partnerId,
        status: 'available',
      }),
      createPlacement: jest.fn().mockResolvedValue({
        id: placementId,
        inventory_id: inventoryId,
        name: 'Homepage slot',
        format: 'banner',
        unit_kind: 'slot_day',
        backup_required: false,
        max_weight_kb: 200,
      }),
      createRateCard: jest.fn().mockResolvedValue({ id: rateCardId, display_code: 'RC-20260912-C3D4' }),
      appendRateVersion: jest.fn().mockResolvedValue({
        id: rateVersionId,
        rate_card_id: rateCardId,
        version: 1,
        status: 'draft',
        unit_price_vnd: 1_000_000,
      }),
      publishRateVersion: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'published',
        unit_price_vnd: 1_000_000,
      }),
      upsertCapacityBuckets: jest.fn().mockResolvedValue(undefined),
      getPlacementCalendar: jest.fn().mockResolvedValue([]),
      getRateVersionById: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'published',
        unit_price_vnd: 1_000_000,
      }),
      createPackage: jest.fn().mockResolvedValue({
        id: packageId,
        display_code: 'PKG-20260912-D4E5',
        client_id: clientId,
        sell_vnd: 3_000_000,
        hide_buy_side: false,
        lines: [],
      }),
      getPackage: jest.fn().mockResolvedValue({
        id: packageId,
        client_id: clientId,
        sell_vnd: 3_000_000,
        hide_buy_side: false,
      }),
      getCapacityBucket: jest.fn().mockResolvedValue({ total: 100, reserved_hard: 0, reserved_soft: 0 }),
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('approved'),
      incrementCapacityReserved: jest.fn().mockResolvedValue(undefined),
      insertReservation: jest.fn().mockResolvedValue({ id: 'rsv1', kind: 'hard', qty: 3 }),
      insertException: jest.fn().mockResolvedValue(undefined),
      hasValidReserve: jest.fn().mockResolvedValue(true),
      createBrandSafetySnapshot: jest.fn().mockResolvedValue({ id: snapshotId, tier: 'A' }),
      createInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        display_code: 'IO-20260912-E5F6',
        package_id: packageId,
        client_id: clientId,
        rate_version_id: rateVersionId,
        safety_snapshot_id: snapshotId,
        status: 'draft',
        qty: 300,
        sell_vnd: 3_000_000,
        buy_vnd: 2_000_000,
        media_line_id: null,
        partner_confirmed_at: null,
      }),
      getInsertionOrder: jest.fn().mockImplementation(async () => ({
        id: ioId,
        package_id: packageId,
        client_id: clientId,
        rate_version_id: rateVersionId,
        safety_snapshot_id: snapshotId,
        status: 'issued',
        qty: 300,
        sell_vnd: 3_000_000,
        buy_vnd: 2_000_000,
        media_line_id: lineId,
        partner_confirmed_at: '2026-09-12T08:00:00Z',
        issued_at: '2026-09-12T08:00:00Z',
      })),
      issueInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        status: 'issued',
        media_line_id: lineId,
      }),
      appendIoRevision: jest.fn().mockResolvedValue(undefined),
      createMediaLine: jest.fn().mockResolvedValue({
        id: lineId,
        display_code: 'ML-20260912-F6G7',
        package_id: packageId,
        io_id: ioId,
        client_id: clientId,
        status: 'ready',
        tracking_owner_staff_id: 9,
        p03_override_by: null,
      }),
      getMediaLine: jest.fn().mockImplementation(async () => ({
        id: lineId,
        display_code: 'ML-20260912-F6G7',
        package_id: packageId,
        io_id: ioId,
        client_id: clientId,
        status: lineStatus,
        tracking_owner_staff_id: 9,
        p03_override_by: null,
      })),
      getTrafficPack: jest.fn().mockResolvedValue({
        status: 'approved_by_partner',
        creative_id: creativeId,
        width_px: 300,
        height_px: 250,
        weight_kb: 100,
        click_url: 'https://example.com/landing',
        backup_attached: true,
      }),
      getPlacementForLine: jest.fn().mockResolvedValue({ backup_required: false, max_weight_kb: 200 }),
      upsertTrafficPack: jest.fn().mockResolvedValue({ id: 'tp1', status: 'draft' }),
      submitTrafficPack: jest.fn().mockResolvedValue({ id: 'tp1', status: 'submitted' }),
      setMediaLineLive: jest.fn().mockImplementation(async () => {
        lineStatus = 'live';
        return {
          id: lineId,
          package_id: packageId,
          io_id: ioId,
          client_id: clientId,
          status: 'live',
          live_at: '2026-09-12T10:00:00Z',
        };
      }),
      createEvidence: jest.fn().mockResolvedValue({
        id: evidenceId,
        display_code: 'EV-20260912-G7H8',
        media_line_id: lineId,
        hash: 'deadbeef',
        source: 'partner_report',
        captured_at: new Date().toISOString(),
      }),
      createEvidencePack: jest.fn().mockResolvedValue({
        id: packId,
        display_code: 'EP-20260912-H8I9',
        media_line_id: lineId,
        status: 'draft',
      }),
      getEvidencePack: jest.fn().mockImplementation(async () => ({
        id: packId,
        media_line_id: lineId,
        status: packStatus,
      })),
      addEvidencePackItem: jest.fn().mockResolvedValue(undefined),
      getEvidencePackItems: jest.fn().mockResolvedValue([
        {
          hash: 'deadbeef',
          source: 'partner_report',
          captured_at: new Date().toISOString(),
        },
      ]),
      markEvidencePackOfficial: jest.fn().mockImplementation(async () => {
        packStatus = 'official';
        return { id: packId, media_line_id: lineId, status: 'official' };
      }),
      getOfficialEvidencePack: jest.fn().mockImplementation(async () =>
        packStatus === 'official' ? { id: packId, status: 'official' } : null,
      ),
      hasOpenMaterialDiscrepancy: jest.fn().mockResolvedValue(false),
      insertFinanceRequest: jest.fn().mockResolvedValue({
        id: 'fr1',
        media_line_id: lineId,
        evidence_pack_id: packId,
        status: 'requested',
      }),
    } as unknown as MsosRepository;

    const svc = new MsosService(enabledConfig, repo);

    await svc.createPartner({ legal_name: 'Cong ty TNHH Test Truyen thong', staffId: 9 });
    await svc.createInventory({
      name: 'Property Test Publisher',
      owner_kind: 'partner',
      partner_id: partnerId,
      property_host: 'example-publisher.test',
    });
    await svc.createPlacement({
      inventory_id: inventoryId,
      name: 'Homepage slot',
      format: 'banner',
      unit_kind: 'slot_day',
      backup_required: false,
      max_weight_kb: 200,
    });
    await svc.createRateCard({ owner_kind: 'ptt' });
    await svc.appendRateVersion(rateCardId, { unit_price_vnd: 1_000_000 });
    await svc.publishRateVersion(rateCardId, 1, 9);
    await svc.setPlacementCapacity(placementId, [{ date: bucketDate, total_qty: 100 }]);
    await svc.createPackage({
      client_id: clientId,
      lines: [
        {
          placement_id: placementId,
          rate_version_id: rateVersionId,
          qty: 3,
          period_start: bucketDate,
          period_end: bucketDate,
        },
      ],
      staffId: 9,
    });
    await svc.reservePackage(packageId, {
      placement_id: placementId,
      bucket_date: bucketDate,
      kind: 'hard',
      qty: 3,
    });
    await svc.createIo(packageId, {
      rate_version_id: rateVersionId,
      period_start: bucketDate,
      period_end: bucketDate,
      qty: 300,
      sell_vnd: 3_000_000,
      buy_vnd: 2_000_000,
      staffId: 9,
    });
    await svc.issueIo(ioId, 9);
    const line = await svc.createMediaLine({
      package_id: packageId,
      io_id: ioId,
      tracking_owner_staff_id: 9,
    });
    expect(line.id).toBe(lineId);

    await svc.upsertTraffic(lineId, {
      creative_id: creativeId,
      width_px: 300,
      height_px: 250,
      weight_kb: 100,
      click_url: 'https://example.com/landing',
      backup_attached: true,
    });
    await svc.submitTraffic(lineId);
    const live = await svc.goLive(lineId, { confirm: true, actor: 'human' }, 9);
    expect(live.status).toBe('live');
    expect(live.id).toBe(lineId);

    const ev = await svc.createEvidence({
      media_line_id: lineId,
      source: 'partner_report',
      hash: 'deadbeef',
      captured_at: new Date().toISOString(),
      staffId: 9,
    });
    expect(ev.media_line_id).toBe(lineId);

    const pack = await svc.createEvidencePack({ media_line_id: lineId });
    expect(pack.media_line_id).toBe(lineId);
    await svc.addEvidencePackItem(packId, evidenceId);
    await svc.officialEvidencePack(packId);

    const finance = await svc.createFinanceRequest(lineId, 9);
    expect(finance.media_line_id).toBe(lineId);
    expect(finance.status).toBe('requested');
    expect(db.sqls.join(' ')).not.toMatch(/INSERT INTO crm_invoices/i);
  });

  it('hard+hard same day → overbook_hard', async () => {
    const repo = {
      db: makeTrackingDb(),
      getPackage: jest.fn().mockResolvedValue({ id: packageId }),
      getCapacityBucket: jest.fn().mockResolvedValue({ total: 10, reserved_hard: 9, reserved_soft: 0 }),
      getPartnerStatusForPlacement: jest.fn().mockResolvedValue('approved'),
      insertException: jest.fn(),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await expect(
      svc.reservePackage(packageId, {
        placement_id: placementId,
        bucket_date: bucketDate,
        kind: 'hard',
        qty: 2,
      }),
    ).rejects.toMatchObject({ response: { error: 'overbook_hard' } });
  });

  it('report 282 / plan 300 → material DC; actual=300 → actual_eq_plan_forbidden', async () => {
    const repo = {
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      getInsertionOrderForLine: jest.fn().mockResolvedValue({ qty: 300 }),
      createDiscrepancyCase: jest.fn().mockResolvedValue({
        id: 'dc1',
        io_qty: 300,
        report_qty: 282,
        material: true,
      }),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);

    const dc = await svc.createDiscrepancy(lineId, { report_qty: 282, tolerance_bps: 300 });
    expect(dc.material).toBe(true);
    expect(dc.report_qty).toBe(282);

    await expect(
      svc.createDiscrepancy(lineId, { report_qty: 282, actual_qty: 300, tolerance_bps: 300 }),
    ).rejects.toMatchObject({ response: { error: 'actual_eq_plan_forbidden' } });
  });

  it('finance request when pack draft → evidence_not_official', async () => {
    const repo = {
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      getOfficialEvidencePack: jest.fn().mockResolvedValue(null),
      hasOpenMaterialDiscrepancy: jest.fn().mockResolvedValue(false),
      insertFinanceRequest: jest.fn(),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.createFinanceRequest(lineId, 9)).rejects.toMatchObject({
      response: { error: 'evidence_not_official' },
    });
  });

  it('AI actor on live → ai_action_forbidden', async () => {
    const repo = {
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId, status: 'ready' }),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    await expect(svc.goLive(lineId, { confirm: true, actor: 'ai' }, null)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.goLive(lineId, { confirm: true, actor: 'ai' }, null)).rejects.toMatchObject({
      response: { error: 'ai_action_forbidden' },
    });
  });

  it('hide_buy_side ignored when reseller flag off', async () => {
    const db = makeTrackingDb();
    const createPackage = jest.fn().mockResolvedValue({
      id: packageId,
      hide_buy_side: false,
      client_id: clientId,
    });
    const repo = {
      db,
      getRateVersionById: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'published',
        unit_price_vnd: 1_000_000,
      }),
      createPackage,
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);
    const out = await svc.createPackage({
      client_id: clientId,
      hide_buy_side: true,
      lines: [
        {
          placement_id: placementId,
          rate_version_id: rateVersionId,
          qty: 1,
          period_start: bucketDate,
          period_end: bucketDate,
        },
      ],
    });
    expect(out.hide_buy_side).toBe(false);
    expect(createPackage).toHaveBeenCalledWith(expect.objectContaining({ hide_buy_side: false }));
  });

  it('SQL never INSERT INTO clients / leads / crm_invoices across package, IO, outcome, finance', async () => {
    const db = makeTrackingDb();
    const repo = {
      db,
      getRateVersionById: jest.fn().mockResolvedValue({
        id: rateVersionId,
        status: 'published',
        unit_price_vnd: 1_000_000,
      }),
      createPackage: jest.fn().mockResolvedValue({ id: packageId, hide_buy_side: false, client_id: clientId }),
      getPackage: jest.fn().mockResolvedValue({ id: packageId, client_id: clientId, sell_vnd: 1_000_000 }),
      createBrandSafetySnapshot: jest.fn().mockResolvedValue({ id: snapshotId }),
      createInsertionOrder: jest.fn().mockResolvedValue({ id: ioId, status: 'draft' }),
      getInsertionOrder: jest.fn().mockResolvedValue({
        id: ioId,
        package_id: packageId,
        client_id: clientId,
        rate_version_id: rateVersionId,
        safety_snapshot_id: snapshotId,
        status: 'draft',
        qty: 100,
      }),
      hasValidReserve: jest.fn().mockResolvedValue(true),
      issueInsertionOrder: jest.fn().mockResolvedValue({ id: ioId, status: 'issued' }),
      appendIoRevision: jest.fn(),
      getMediaLine: jest.fn().mockResolvedValue({ id: lineId }),
      getOfficialEvidencePack: jest.fn().mockResolvedValue({ id: packId, status: 'official' }),
      hasOpenMaterialDiscrepancy: jest.fn().mockResolvedValue(false),
      insertFinanceRequest: jest.fn().mockResolvedValue({ id: 'fr1', status: 'requested' }),
      createOutcomeLink: jest.fn().mockResolvedValue({ id: 'ol1', match_status: 'matched' }),
    } as unknown as MsosRepository;
    const svc = new MsosService(enabledConfig, repo);

    await svc.createPackage({
      client_id: clientId,
      lines: [
        {
          placement_id: placementId,
          rate_version_id: rateVersionId,
          qty: 1,
          period_start: bucketDate,
          period_end: bucketDate,
        },
      ],
    });
    await svc.createIo(packageId, {
      rate_version_id: rateVersionId,
      period_start: bucketDate,
      period_end: bucketDate,
      qty: 100,
    });
    await svc.issueIo(ioId, 9);
    await svc.createFinanceRequest(lineId, 9);
    await svc.createOutcomeLink({
      media_line_id: lineId,
      lead_id: '00000000-0000-4000-8000-000000000071',
    });

    const joined = db.sqls.join(' ');
    expect(joined).toMatch(/SELECT/i);
    expect(joined).not.toMatch(/INSERT INTO clients/i);
    expect(joined).not.toMatch(/INSERT INTO leads/i);
    expect(joined).not.toMatch(/INSERT INTO crm_invoices/i);
  });

  it('connector write route absent; health reports connector_write false', () => {
    const controllerSrc = MsosController.toString();
    const proto = MsosController.prototype as unknown as Record<string, unknown>;
    const methodNames = Object.getOwnPropertyNames(proto).filter((m) => m !== 'constructor');
    const connectorMethods = methodNames.filter((m) => /connector/i.test(m));
    expect(connectorMethods).toEqual([]);
    expect(controllerSrc).not.toMatch(/connector.*write/i);

    const svc = new MsosService(enabledConfig, {} as MsosRepository);
    expect(svc.getHealth()).toEqual({
      ok: true,
      reseller: false,
      connector_write: false,
    });
  });
});
