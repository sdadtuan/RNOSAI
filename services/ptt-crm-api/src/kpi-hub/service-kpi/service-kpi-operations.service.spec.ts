import { ServiceKpiInstancesService } from './service-kpi-instances.service';
import { ServiceKpiOperationsService } from './service-kpi-operations.service';
import { ServiceKpiRepository } from './service-kpi.repository';

describe('ServiceKpiOperationsService', () => {
  it('reconcile marks Reported blocked when actual pending_validation (AC-SKPI-07)', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const instances = new ServiceKpiInstancesService(repo);
    const ops = new ServiceKpiOperationsService(repo, instances);

    const inst = await repo.insertInstance({
      source_type: 'quote_line_item',
      source_id: 'qt-line',
      dv_code: 'DV04',
      dictionary_id: 'dict-cpl',
      template_version_id: null,
      classification: 'OPTIMIZATION_TARGET',
      status: 'TRACKING',
      client_visible: true,
      owner_name: 'AM',
      target_min: 85000,
      target_max: 100000,
      scenario: 'base',
      assumption_text: 'A',
      assumption_state: 'confirmed',
      disclaimer_text: 'D',
    });
    await repo.insertSnapshot({
      instance_id: inst.id,
      quote_version_id: 'ver-1',
      ledger: 'quoted',
      payload_json: { target_max: 100000 },
    });
    await ops.ingestActual(inst.id, {
      period_start: '2026-10-07',
      period_end: '2026-10-07',
      value: 95000,
      source_ref: 'meta+crm',
      quality_status: 'pending_validation',
    });

    const rec = await ops.reconcile('qt-line');
    expect(rec.rows[0]?.reported).toBe('Blocked');
    expect(rec.rows[0]?.behavior).toBe('Chặn Reported');
  });

  it('importActualsBatch imports by instance_id and skips duplicates', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const instances = new ServiceKpiInstancesService(repo);
    const ops = new ServiceKpiOperationsService(repo, instances);

    const inst = await repo.insertInstance({
      source_type: 'quote_line_item',
      source_id: 'import-line',
      dv_code: 'DV04',
      dictionary_id: 'dict-cpl',
      template_version_id: null,
      classification: 'OPTIMIZATION_TARGET',
      status: 'TRACKING',
      client_visible: true,
      owner_name: 'AM',
      target_min: 85000,
      target_max: 100000,
      scenario: 'base',
      assumption_text: 'A',
      assumption_state: 'confirmed',
      disclaimer_text: 'D',
    });

    const first = await ops.importActualsBatch([
      {
        instance_id: inst.id,
        period_start: '2026-10-08',
        period_end: '2026-10-08',
        value: 90000,
        source_ref: 'import',
      },
      {
        instance_id: inst.id,
        period_start: '2026-10-08',
        period_end: '2026-10-08',
        value: 91000,
        source_ref: 'import',
      },
    ]);
    expect(first.imported).toBe(1);
    expect(first.skipped).toBe(1);
  });
});
