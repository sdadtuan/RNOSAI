import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { applyZeroDenominator, detectDuplicateActual } from './service-kpi-actuals';
import { canPublishClientReport } from './service-kpi-ledgers';
import { ServiceKpiInstancesService } from './service-kpi-instances.service';
import { ServiceKpiRepository } from './service-kpi.repository';
import { buildWarRoom } from './service-kpi-war-room';
import { fireServiceKpiVarianceAlert } from './service-kpi-variance-alert';
import type { IngestActualBody } from './service-kpi.types';

@Injectable()
export class ServiceKpiOperationsService {
  constructor(
    private readonly repo: ServiceKpiRepository,
    private readonly instances: ServiceKpiInstancesService,
  ) {}

  async getMeasurementPlan(instanceId: string) {
    await this.instances.get(instanceId);
    const plan = await this.repo.getMeasurementPlan(instanceId);
    return plan ?? { instance_id: instanceId, qa_status: 'draft' };
  }

  async upsertMeasurementPlan(
    instanceId: string,
    body: {
      owner_name: string;
      cadence?: string;
      data_source?: string;
      field_mapping?: string;
      freshness_sla_hours?: number;
    },
  ) {
    await this.instances.get(instanceId);
    const qa_status = body.field_mapping?.trim() ? 'pending' : 'warning';
    return this.repo.upsertMeasurementPlan(instanceId, { ...body, qa_status });
  }

  async ingestActual(instanceId: string, body: IngestActualBody) {
    await this.instances.get(instanceId);
    const sourceRef = body.source_ref ?? '';
    const existing = await this.repo.findOpenActual(instanceId, body.period_start, body.period_end, sourceRef);
    const dup = detectDuplicateActual(
      existing
        ? {
            periodStart: existing.period_start,
            periodEnd: existing.period_end,
            sourceRef: existing.source_ref,
            quality: existing.quality_status as 'valid',
          }
        : null,
      { periodStart: body.period_start, periodEnd: body.period_end, sourceRef },
    );
    if (dup === 'duplicate' && body.duplicate_action !== 'correction' && body.duplicate_action !== 'merge') {
      throw new ConflictException({
        error: 'ACTUAL_DUPLICATE',
        actions: ['skip', 'merge', 'correction'],
      });
    }

    let value = body.value ?? null;
    let quality = body.quality_status ?? 'pending_validation';
    if (value === 0 && body.value === 0) {
      const zero = applyZeroDenominator();
      value = zero.value;
      quality = zero.quality;
    }

    const row = await this.repo.insertActual(instanceId, { ...body, value, quality_status: quality });
    if (dup === 'duplicate' && body.duplicate_action === 'correction' && existing) {
      await this.repo.supersedeActual(existing.id, row.id);
    }
    const refreshed = await this.instances.get(instanceId);
    fireServiceKpiVarianceAlert(refreshed);
    return row;
  }

  async listActuals(instanceId: string) {
    await this.instances.get(instanceId);
    return this.repo.listActuals(instanceId);
  }

  async reconcile(sourceId: string) {
    const instances = await this.repo.listInstances({ source_id: sourceId });
    const rows = [];
    for (const inst of instances) {
      const snaps = await this.repo.listSnapshots({ source_id: sourceId });
      const quoted = snaps.find((s) => s.instance_id === inst.id && s.ledger === 'quoted');
      const delivered = snaps.find((s) => s.instance_id === inst.id && s.ledger === 'delivered');
      const reported = snaps.find((s) => s.instance_id === inst.id && s.ledger === 'reported');
      const actuals = await this.repo.listActuals(inst.id);
      const latest = actuals[0];
      const quality = latest?.quality_status ?? 'pending_validation';
      const reportedBlocked = !canPublishClientReport(quality as 'valid', inst.client_visible);
      rows.push({
        instance_id: inst.id,
        dictionary_id: inst.dictionary_id,
        classification: inst.classification,
        quoted: quoted?.payload_json ?? null,
        delivered: delivered?.payload_json ?? inst.target_max,
        reported: reportedBlocked ? 'Blocked' : (reported?.payload_json ?? latest?.value ?? null),
        quality_status: quality,
        behavior: reportedBlocked ? 'Chặn Reported' : 'OK',
      });
    }
    return { source_id: sourceId, rows };
  }

  async getWarRoom(opts: { includeGm: boolean }) {
    const all = await this.repo.listAllInstances();
    const enriched = await Promise.all(all.map((row) => this.instances.get(row.id)));
    const actualsPending = (
      await Promise.all(all.map((i) => this.repo.listActuals(i.id)))
    ).flat().filter((a) => a.quality_status === 'pending_validation').length;

    const dvCodes = [...new Set(all.map((i) => i.dv_code).filter(Boolean))] as string[];
    const gm_by_dv = dvCodes.map((dv_code) => ({ dv_code, gm_pct: opts.includeGm ? null : null }));

    return buildWarRoom({
      instances: enriched.map((i) => ({
        id: i.id,
        dv_code: i.dv_code,
        status: i.status,
        assumption_state: i.assumption_state,
        classification: i.classification,
        client_visible: i.client_visible,
        target_max: i.target_max,
        latest_actual: i.latest_actual ?? null,
      })),
      actuals_pending: actualsPending,
      quotes_high_score: 0,
      gm_by_dv,
      include_gm: opts.includeGm,
    });
  }
}
