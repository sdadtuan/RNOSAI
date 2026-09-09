import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_PTT_SETTINGS } from '../../proposals/quote-settings.service';
import { applyZeroDenominator, detectDuplicateActual } from './service-kpi-actuals';
import {
  aggressivenessFromTarget,
  evaluateKpiContractScore,
  marginPressureFromGm,
} from './service-kpi-contract-score';
import { canPublishClientReport } from './service-kpi-ledgers';
import { ServiceKpiInstancesService } from './service-kpi-instances.service';
import { ServiceKpiRepository } from './service-kpi.repository';
import { flagMaterialReconcileRows } from './service-kpi-change-order';
import { aggregateTrackingSummary } from './service-kpi-tracking';
import { buildWarRoom } from './service-kpi-war-room';
import { fireServiceKpiVarianceAlert } from './service-kpi-variance-alert';
import type {
  ContractRiskItem,
  ImportActualRow,
  IngestActualBody,
  ServiceKpiTrackingDashboard,
} from './service-kpi.types';

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

  async importActualsBatch(rows: ImportActualRow[]) {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      try {
        const instanceId = await this.resolveImportInstanceId(row);
        if (!instanceId) {
          errors.push({ row: i + 1, error: 'INSTANCE_NOT_FOUND' });
          continue;
        }
        await this.ingestActual(instanceId, {
          period_start: row.period_start,
          period_end: row.period_end,
          value: row.value ?? null,
          quality_status: row.quality_status ?? 'pending_validation',
          source_ref: row.source_ref ?? 'import',
          collection_method: 'import',
          duplicate_action: row.duplicate_action ?? 'skip',
        });
        imported += 1;
      } catch (err: unknown) {
        const code = (err as { response?: { error?: string } })?.response?.error;
        if (code === 'ACTUAL_DUPLICATE' && (row.duplicate_action ?? 'skip') === 'skip') {
          skipped += 1;
          continue;
        }
        errors.push({ row: i + 1, error: code ?? (err instanceof Error ? err.message : 'IMPORT_FAILED') });
      }
    }

    return { imported, skipped, errors, total: rows.length };
  }

  async listContractRisk(): Promise<{ items: ContractRiskItem[] }> {
    const all = await this.repo.listAllInstances();
    const gmFloorBps = Number(DEFAULT_PTT_SETTINGS.gm_floor_bps);
    const items: ContractRiskItem[] = [];

    for (const row of all) {
      const inst = await this.instances.get(row.id);
      const risky =
        inst.status === 'AT_RISK' ||
        inst.assumption_state === 'not_met' ||
        (inst.variance_pct != null && inst.variance_pct > 20);
      if (!risky) continue;

      const classificationRisk = this.classificationRiskPct(inst.classification, inst.client_visible);
      const proposed = inst.target_min ?? inst.target_max ?? 0;
      const floor = inst.target_max ?? inst.target_min ?? (proposed || 1);
      const targetAggressiveness = aggressivenessFromTarget(proposed, floor, true);
      const assumptionOpen = inst.assumption_state === 'pending' ? 100 : inst.assumption_state === 'not_met' ? 80 : 0;
      const dataReadinessGap = inst.readiness_level === 'blocking' ? 80 : inst.readiness_level === 'warning' ? 40 : 0;

      const score = evaluateKpiContractScore({
        classificationRisk,
        targetAggressiveness,
        assumptionOpen,
        dataReadinessGap,
        marginPressure: 0,
        gmBps: null,
        gmFloorBps,
      });

      items.push({
        instance_id: inst.id,
        source_type: inst.source_type,
        source_id: inst.source_id,
        dictionary_id: inst.dictionary_id,
        dv_code: inst.dv_code,
        classification: inst.classification,
        status: inst.status,
        assumption_state: inst.assumption_state,
        score: score.score,
        block_submit: score.blockSubmit,
        required_reviewers: score.requiredReviewers,
        parts: score.parts,
        target_min: inst.target_min,
        target_max: inst.target_max,
        latest_actual: inst.latest_actual ?? null,
        variance_pct: inst.variance_pct ?? null,
      });
    }

    items.sort((a, b) => b.score - a.score);
    return { items };
  }

  private classificationRiskPct(classification: string, clientVisible: boolean): number {
    if (!clientVisible) return 0;
    const weights: Record<string, number> = {
      COMMITTED_DELIVERABLE: 10,
      QUALITY_STANDARD: 15,
      OPTIMIZATION_TARGET: 35,
      PROJECTED_RESULT: 45,
      BUSINESS_OUTCOME: 55,
      INTERNAL_OPERATIONAL: 0,
    };
    return weights[classification] ?? 20;
  }

  private async resolveImportInstanceId(row: ImportActualRow): Promise<string | null> {
    if (row.instance_id?.trim()) {
      const inst = await this.repo.getInstance(row.instance_id.trim());
      return inst?.id ?? null;
    }
    const dictionaryId = row.dictionary_id?.trim();
    const sourceId = row.source_id?.trim();
    if (!dictionaryId || !sourceId) return null;
    const matches = await this.repo.listInstances({ source_id: sourceId });
    const hit = matches.find((m) => m.dictionary_id === dictionaryId);
    return hit?.id ?? null;
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
    return { source_id: sourceId, rows: flagMaterialReconcileRows(rows) };
  }

  async getWarRoom(opts: { includeGm: boolean }) {
    const all = await this.repo.listAllInstances();
    const enriched = await Promise.all(all.map((row) => this.instances.get(row.id)));
    const actualsPending = (
      await Promise.all(all.map((i) => this.repo.listActuals(i.id)))
    ).flat().filter((a) => a.quality_status === 'pending_validation').length;

    const quoteScores = await this.repo.listQuoteContractScores(10);
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
      quotes_high_score: quoteScores.length,
      quote_scores: quoteScores,
      gm_by_dv,
      include_gm: opts.includeGm,
    });
  }

  async listQuoteContractScores() {
    return { items: await this.repo.listQuoteContractScores(30) };
  }

  async listReconcileSources() {
    const rows = await this.repo.listDistinctSourceIds();
    return { items: rows };
  }

  async getTrackingDashboard(highlightInstanceId?: string): Promise<ServiceKpiTrackingDashboard> {
    const [openActuals, recent, staleCount, duplicateCount] = await Promise.all([
      this.repo.listOpenActualsForSummary(),
      this.repo.listRecentActuals(25),
      this.repo.countStaleActualInstances(),
      this.repo.countSupersededActuals(),
    ]);

    const summary = aggregateTrackingSummary({
      actuals: openActuals,
      staleCount,
      duplicateCount,
    });

    let highlight: ServiceKpiTrackingDashboard['highlight'] = null;
    const highlightId = highlightInstanceId?.trim();
    if (highlightId) {
      try {
        const inst = await this.instances.get(highlightId);
        const actuals = await this.repo.listActuals(highlightId);
        highlight = {
          instance_id: inst.id,
          dictionary_id: inst.dictionary_id,
          source_id: inst.source_id,
          status: inst.status,
          target_min: inst.target_min,
          target_max: inst.target_max,
          latest_value: inst.latest_actual ?? actuals[0]?.value ?? null,
          variance_pct: inst.variance_pct ?? null,
          actuals,
        };
      } catch {
        highlight = null;
      }
    }

    return { summary, recent, highlight };
  }
}
