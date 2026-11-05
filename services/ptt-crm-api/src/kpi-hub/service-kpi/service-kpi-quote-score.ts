import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { DEFAULT_PTT_SETTINGS } from '../../proposals/quote-settings.service';
import {
  aggressivenessFromTarget,
  evaluateKpiContractScore,
  marginPressureFromGm,
  type ContractScoreResult,
} from './service-kpi-contract-score';
import {
  buildContractDetail,
  type ContractDetailPayload,
  type ContractInstanceInput,
} from './service-kpi-contract-detail';
import { resolveStudioIndustry } from './service-kpi-publish-policy';
import { isMissingRelationError, withDbFallback } from '../kpi-hub.memory-store';
import { SERVICE_KPI_TENANT_ID } from './service-kpi.types';

@Injectable()
export class ServiceKpiQuoteScoreService {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async scoreForVersion(versionId: string, gmBps: number | null): Promise<ContractScoreResult> {
    const detail = await this.contractDetailForVersion(versionId, gmBps);
    return {
      score: detail.score,
      parts: detail.parts,
      blockSubmit: detail.blockSubmit,
      requiredReviewers: detail.requiredReviewers,
    };
  }

  async contractDetailForVersion(versionId: string, gmBps: number | null): Promise<ContractDetailPayload> {
    const gmFloorBps = Number(DEFAULT_PTT_SETTINGS.gm_floor_bps);
    const instances = await this.loadInstances(versionId);
    const industry = await this.loadVersionIndustry(versionId);
    const metrics = this.computeMetrics(instances, gmBps, gmFloorBps);
    const score = evaluateKpiContractScore({
      classificationRisk: metrics.classificationRisk,
      targetAggressiveness: metrics.targetAggressiveness,
      assumptionOpen: metrics.assumptionOpen,
      dataReadinessGap: metrics.dataReadinessGap,
      marginPressure: metrics.marginPressure,
      gmBps,
      gmFloorBps,
    });
    return buildContractDetail({
      score,
      gmBps,
      gmFloorBps,
      industry,
      instances,
      ...metrics,
    });
  }

  private computeMetrics(instances: ContractInstanceInput[], gmBps: number | null, gmFloorBps: number) {
    if (!instances.length) {
      return {
        classificationRisk: 0,
        targetAggressiveness: 0,
        assumptionOpen: 0,
        dataReadinessGap: 0,
        marginPressure: marginPressureFromGm(gmBps, gmFloorBps),
      };
    }
    const classificationRisk = this.classificationRisk(instances);
    const targetAggressiveness = Math.max(
      ...instances.map((i) => {
        const proposed = i.target_min ?? i.target_max ?? 0;
        const floor = i.target_max ?? i.target_min ?? proposed;
        return aggressivenessFromTarget(proposed, floor || proposed || 1, true);
      }),
      0,
    );
    const assumptionOpen =
      (instances.filter((i) => i.assumption_state === 'pending').length / instances.length) * 100;
    return {
      classificationRisk,
      targetAggressiveness,
      assumptionOpen,
      dataReadinessGap: 0,
      marginPressure: marginPressureFromGm(gmBps, gmFloorBps),
    };
  }

  private classificationRisk(instances: ContractInstanceInput[]): number {
    const weights: Record<string, number> = {
      COMMITTED_DELIVERABLE: 10,
      QUALITY_STANDARD: 15,
      OPTIMIZATION_TARGET: 35,
      PROJECTED_RESULT: 45,
      BUSINESS_OUTCOME: 55,
      INTERNAL_OPERATIONAL: 0,
    };
    const visible = instances.filter((i) => i.client_visible);
    if (!visible.length) return 0;
    const sum = visible.reduce((acc, i) => acc + (weights[i.classification] ?? 20), 0);
    return Math.min(100, sum / visible.length);
  }

  private async loadInstances(versionId: string): Promise<ContractInstanceInput[]> {
    return withDbFallback(async () => {
      try {
        const res = await this.db.query(
          `SELECT i.dictionary_id, i.dv_code, i.classification, i.target_min, i.target_max,
                  i.assumption_state, i.assumption_text, i.disclaimer_text, i.client_visible
           FROM crm_service_kpi_instances i
           WHERE i.tenant_id = $1 AND i.deleted_at IS NULL
             AND (
               (i.source_type = 'proposal_version' AND i.source_id = $2)
               OR (i.source_type = 'quote_line_item' AND i.source_id IN (
                 SELECT id::text FROM crm_quote_line_items WHERE version_id = $2::uuid
               ))
             )`,
          [SERVICE_KPI_TENANT_ID, versionId],
        );
        return res.rows.map((r) => ({
          dictionary_id: String(r.dictionary_id),
          dv_code: r.dv_code == null ? null : String(r.dv_code),
          classification: String(r.classification),
          target_min: r.target_min != null ? Number(r.target_min) : null,
          target_max: r.target_max != null ? Number(r.target_max) : null,
          assumption_state: String(r.assumption_state ?? 'pending'),
          assumption_text: r.assumption_text == null ? null : String(r.assumption_text),
          disclaimer_text: r.disclaimer_text == null ? null : String(r.disclaimer_text),
          client_visible: Boolean(r.client_visible),
        }));
      } catch (err) {
        if (isMissingRelationError(err)) return null;
        throw err;
      }
    }, () => []);
  }

  private async loadVersionIndustry(versionId: string): Promise<string | null> {
    return withDbFallback(async () => {
      try {
        const res = await this.db.query(`SELECT snapshot_json FROM crm_quote_versions WHERE id = $1`, [
          versionId,
        ]);
        const snap = res.rows[0]?.snapshot_json;
        if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null;
        const industry = resolveStudioIndustry(snap as Record<string, unknown>);
        return industry || null;
      } catch (err) {
        if (isMissingRelationError(err)) return null;
        throw err;
      }
    }, () => null);
  }
}
