import { ServiceKpiChangeOrderService } from './service-kpi-change-order.service';
import { ServiceKpiInstancesService } from './service-kpi-instances.service';
import { ServiceKpiOperationsService } from './service-kpi-operations.service';
import { ServiceKpiRepository } from './service-kpi.repository';

describe('ServiceKpiChangeOrderService', () => {
  it('creates quote revision and delivered snapshots for material variance', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const instances = new ServiceKpiInstancesService(repo);
    const ops = new ServiceKpiOperationsService(repo, instances);
    const quoteBuilder = {
      createRevision: jest.fn().mockResolvedValue({ id: 'ver-co-2', n: 2, state: 'working' }),
    };
    const svc = new ServiceKpiChangeOrderService(
      repo,
      ops,
      quoteBuilder as never,
    );

    const inst = await repo.insertInstance({
      source_type: 'quote_line_item',
      source_id: 'line-co',
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
      quote_version_id: 'ver-co-1',
      ledger: 'quoted',
      payload_json: { target_max: 100000, proposal_id: 42, quote_code: 'QT-2026-0099' },
    });
    await ops.ingestActual(inst.id, {
      period_start: '2026-10-07',
      period_end: '2026-10-07',
      value: 128000,
      quality_status: 'pending_validation',
    });

    const preview = await svc.preview('line-co');
    expect(preview.material_count).toBe(1);

    const created = await svc.create('line-co', { staffId: 7, hasFinance: true }, 'CPL vượt ngưỡng');
    expect(quoteBuilder.createRevision).toHaveBeenCalledWith(42, { staffId: 7, hasFinance: true });
    expect(created.new_version_id).toBe('ver-co-2');
    expect(created.delivered_snapshots).toBe(1);
    expect(created.builder_href).toBe('/crm/proposals/42?tab=kpi');
  });
});
