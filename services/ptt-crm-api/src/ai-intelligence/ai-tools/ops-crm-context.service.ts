import { BadRequestException, Injectable } from '@nestjs/common';
import { OpsCrmContextRepository } from './ops-crm-context.repository';
import {
  CrmContextPack,
  CrmContextPackInput,
  healthLabelVi,
  stageLabelVi,
} from './ops-crm-context.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function metricScalar(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

function parseMetrics(raw: unknown): Array<{ kpi?: string; quoted?: unknown; actual?: unknown }> {
  if (Array.isArray(raw)) return raw as Array<{ kpi?: string; quoted?: unknown; actual?: unknown }>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? (parsed as Array<{ kpi?: string; quoted?: unknown; actual?: unknown }>)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

@Injectable()
export class OpsCrmContextService {
  constructor(private readonly repo: OpsCrmContextRepository) {}

  async buildPack(tool: string, input: Record<string, unknown>): Promise<CrmContextPack> {
    const parsed = this.parseInput(input);
    const known: string[] = [];
    const assumed: string[] = [];
    const unknown: string[] = [];
    const links: string[] = [];

    let lifecycle =
      parsed.lifecycle_id != null ? await this.repo.getLifecycle(parsed.lifecycle_id) : null;
    let plan = parsed.plan_id != null ? await this.repo.getPlan(parsed.plan_id) : null;
    let project =
      parsed.project_id != null ? await this.repo.getProject(parsed.project_id) : null;

    if (!lifecycle && plan?.lifecycle_id) {
      lifecycle = await this.repo.getLifecycle(plan.lifecycle_id);
    }
    if (!lifecycle && project?.lifecycle_id) {
      lifecycle = await this.repo.getLifecycle(project.lifecycle_id);
    }
    if (!lifecycle && parsed.client_id) {
      lifecycle = await this.repo.findPrimaryLifecycleByClient(parsed.client_id);
      if (lifecycle) known.push(`Resolved lifecycle #${lifecycle.id} via client contract`);
    }

    if (!plan && lifecycle?.marketing_plan_id) {
      plan = await this.repo.getPlan(lifecycle.marketing_plan_id);
    }
    if (!plan && lifecycle) {
      plan = await this.repo.findPlanByLifecycle(lifecycle.id);
    }

    if (!project && lifecycle) {
      project = await this.repo.findProjectByLifecycle(lifecycle.id);
    }

    let clientId = parsed.client_id?.trim() || lifecycle?.agency_client_id || '';
    let client = clientId ? await this.repo.getClient(clientId) : null;
    if (!client && clientId) {
      unknown.push(`Client ${clientId} not found in clients table`);
      clientId = '';
    }

    const milestones = plan ? await this.repo.listMilestones(plan.id) : [];
    const openTasks = lifecycle ? await this.repo.listOpenTasks(lifecycle.id) : [];
    const planCampaigns = plan ? await this.repo.listPlanCampaigns(plan.id) : [];
    const metrics = plan ? parseMetrics(plan.success_metrics_json) : [];

    if (client) known.push(`Client ${client.name} (${client.status})`);
    else unknown.push('client');

    if (plan) {
      known.push(`Marketing plan #${plan.id} status=${plan.status}`);
      links.push(`/crm/marketing-plan/${plan.id}`);
    } else unknown.push('marketing_plan');

    if (lifecycle) {
      known.push(`Service delivery #${lifecycle.id} stage=${lifecycle.stage}`);
      links.push(`/crm/service-delivery/${lifecycle.id}`);
    } else unknown.push('service_delivery');

    if (project) {
      known.push(`Delivery project ${project.name} health=${project.health_status}`);
      links.push(`/crm/delivery-projects/${project.id}`);
    } else unknown.push('delivery_project');

    if (planCampaigns.length === 0 && metrics.length === 0) {
      unknown.push('campaigns_kpi');
    } else {
      known.push(`Campaign/KPI rows=${planCampaigns.length || metrics.length}`);
    }

    if (!parsed.client_id && clientId) {
      assumed.push('client_id inferred from lifecycle contract');
    }

    const campaigns =
      planCampaigns.length > 0
        ? planCampaigns.map((c, i) => {
            const m = metrics[i];
            return {
              id: String(c.id),
              name: c.name || c.code || `Campaign ${c.id}`,
              kpi: String(m?.kpi ?? c.channel ?? ''),
              status: c.status,
              quoted: metricScalar(m?.quoted),
              actual: metricScalar(m?.actual),
            };
          })
        : metrics.map((m, i) => ({
            id: `metric-${i + 1}`,
            name: String(m.kpi ?? `KPI ${i + 1}`),
            kpi: String(m.kpi ?? ''),
            status: '',
            quoted: metricScalar(m.quoted),
            actual: metricScalar(m.actual),
          }));

    const health = project
      ? healthLabelVi(project.health_status)
      : openTasks.length > 5
        ? 'Watch'
        : lifecycle
          ? 'On track'
          : '—';

    return {
      source: 'ptt-crm',
      as_of: new Date().toISOString(),
      tool,
      wired: true,
      phase: 'P2',
      ok: true,
      client: {
        id: client?.id ?? clientId,
        name: client?.name ?? '',
        lifecycle: client?.status ?? '',
      },
      marketing_plan: {
        id: plan ? String(plan.id) : '',
        status: plan?.status ?? '',
        period: plan?.period_label ?? '',
        milestones: milestones.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          due_date: m.due_date,
        })),
      },
      service_delivery: {
        id: lifecycle ? String(lifecycle.id) : '',
        stage: lifecycle ? stageLabelVi(lifecycle.stage) : '',
        open_tasks: openTasks.map((t) => ({
          id: t.id,
          title: t.title,
          stage: stageLabelVi(t.stage),
        })),
        health,
      },
      delivery_project: project
        ? {
            id: project.id,
            name: project.name,
            status: project.status,
            health: healthLabelVi(project.health_status),
          }
        : null,
      campaigns,
      known,
      assumed,
      unknown,
      links,
    };
  }

  private parseInput(input: Record<string, unknown>): CrmContextPackInput {
    const client_id = String(input.client_id ?? input.clientId ?? '').trim() || undefined;
    const lifecycle_id = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    const plan_id = positiveInt(input.plan_id ?? input.planId);
    const project_id = String(input.project_id ?? input.projectId ?? '').trim() || undefined;
    if (!client_id && !lifecycle_id && !plan_id && !project_id) {
      throw new BadRequestException({
        error: 'context_id_required',
        message: 'Provide client_id, lifecycle_id, plan_id, or project_id',
      });
    }
    return { client_id, lifecycle_id, plan_id, project_id };
  }
}
