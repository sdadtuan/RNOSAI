import { ServiceKpiInstancesService } from './service-kpi-instances.service';
import { ServiceKpiRepository } from './service-kpi.repository';
import { ServiceKpiTemplatesService } from './service-kpi-templates.service';

describe('ServiceKpiInstancesService AC-SKPI-02', () => {
  it('keeps template_version_id at clone time when template activates v5', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const templates = new ServiceKpiTemplatesService(repo);
    const instances = new ServiceKpiInstancesService(repo);

    const created = await templates.create(
      {
        dv_code: 'DV04',
        name: 'Meta Ads',
        rules: [
          {
            dictionary_id: 'dict-cpl',
            classification: 'OPTIMIZATION_TARGET',
            client_visible: true,
            disclaimer_template: 'Mục tiêu tối ưu',
            assumption_template: 'Giả định A',
            owner_role: 'Performance MKT',
            target_min: 85000,
            target_max: 100000,
          },
        ],
      },
      { staffId: 1 },
    );
    const tpl = await templates.get(created.id);
    const v4Id = tpl.current_version!.id;
    await templates.submitReview(v4Id);
    await templates.activate(v4Id);

    const sync = await instances.syncFromCatalog({
      sourceType: 'quote_line_item',
      sourceId: 'line-1',
      dvCode: 'DV04',
    });
    expect(sync.created).toBe(1);
    expect(sync.template_version_id).toBe(v4Id);

    await templates.createRevision(created.id, { staffId: 1 });
    const tpl2 = await templates.get(created.id);
    const v5Id = tpl2.current_version!.id;
    await templates.submitReview(v5Id);
    await templates.activate(v5Id);

    const rows = await instances.list({ source_id: 'line-1' });
    expect(rows.items[0]?.template_version_id).toBe(v4Id);
    expect(rows.items[0]?.template_version_id).not.toBe(v5Id);
  });

  it('cloneToProject copies quote line instances as TRACKING with frozen template_version_id', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const instances = new ServiceKpiInstancesService(repo);
    const tplVersionId = 'tpl-v4';
    await repo.insertInstance({
      source_type: 'quote_line_item',
      source_id: 'line-99',
      dv_code: 'DV04',
      dictionary_id: 'dict-cpl',
      template_version_id: tplVersionId,
      classification: 'OPTIMIZATION_TARGET',
      status: 'APPROVED',
      client_visible: true,
      owner_name: 'AM',
      target_min: 85000,
      target_max: 100000,
      scenario: 'base',
      assumption_text: 'A',
      assumption_state: 'confirmed',
      disclaimer_text: 'D',
    });

    const result = await instances.cloneToProject({ lineId: 'line-99', projectId: '777' });
    expect(result.cloned).toBe(1);

    const projectRows = await instances.list({ source_type: 'project', source_id: '777' });
    expect(projectRows.items[0]?.status).toBe('TRACKING');
    expect(projectRows.items[0]?.template_version_id).toBe(tplVersionId);
  });

  it('not_met assumption sets AT_RISK', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const instances = new ServiceKpiInstancesService(repo);
    const row = await repo.insertInstance({
      source_type: 'quote_line_item',
      source_id: 'line-2',
      dv_code: 'DV04',
      dictionary_id: 'dict-1',
      template_version_id: null,
      classification: 'OPTIMIZATION_TARGET',
      status: 'DRAFT',
      client_visible: true,
      owner_name: 'AM',
      target_min: 85000,
      target_max: 100000,
      scenario: 'base',
      assumption_text: 'Test',
      assumption_state: 'pending',
      disclaimer_text: 'Disclaimer',
    });
    const updated = await instances.patch(row.id, { assumption_state: 'not_met' }, row.row_version);
    expect(updated.status).toBe('AT_RISK');
  });

  it('create manual instance with DRAFT status', async () => {
    const repo = new ServiceKpiRepository({ databaseUrl: 'postgres://invalid' } as never);
    const instances = new ServiceKpiInstancesService(repo);
    const row = await instances.create({
      source_type: 'quote_line_item',
      source_id: 'QT-2026-0099',
      dictionary_id: 'dict-manual',
      dv_code: 'DV04',
      target_min: 85000,
      target_max: 100000,
    });
    expect(row.status).toBe('DRAFT');
    expect(row.source_id).toBe('QT-2026-0099');
    expect(row.dictionary_id).toBe('dict-manual');
  });
});
