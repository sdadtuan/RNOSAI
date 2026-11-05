import { Injectable } from '@nestjs/common';
import {
  KpiHubApprovalsService,
  type HubApprovalItem,
} from '../kpi-hub/approvals/kpi-hub-approvals.service';
import type { RevopsApprovalItem, RevopsApprovalsDto, RevopsApprovalKind } from './revops.types';

const KPI_HUB_ACTIONABLE = new Set(['change_request', 'delivery_project', 'delivery_budget']);

export const REVOPS_DISCOUNT_MATRIX: RevopsApprovalsDto['discountMatrix'] = [
  { band: '≤5%', steps: ['AE', 'Team Lead'] },
  { band: '5–15%', steps: ['Team Lead', 'Sales Director'] },
  { band: '15–25%', steps: ['Sales Director', 'Finance'] },
  { band: '>25%', steps: ['CEO', 'Finance (parallel)'] },
];

const TYPE_LABEL: Record<string, string> = {
  kpi: 'KPI Dictionary',
  target: 'Target & Cảnh báo',
  mapping: 'Mapping nguồn',
  delivery_project: 'Delivery project',
  delivery_budget: 'Delivery budget',
  change_request: 'Change Request',
};

function mapSourceKindToRevopsKind(sourceKind: string): RevopsApprovalKind {
  if (['kpi', 'target', 'mapping', 'delivery_project', 'delivery_budget', 'change_request'].includes(sourceKind)) {
    return 'commission';
  }
  return 'commission';
}

function mapHubItem(item: HubApprovalItem): RevopsApprovalItem {
  const currentStep =
    item.policy?.length ? item.policy.map((p) => p.label).join(' → ') : item.status;
  return {
    id: item.id,
    kind: mapSourceKindToRevopsKind(item.kind),
    sourceKind: item.kind,
    title: item.label,
    typeLabel: TYPE_LABEL[item.kind] ?? item.kind,
    relatedRecord: item.label,
    requestedBy: '—',
    amountImpact: null,
    currentStep,
    dueAt: null,
    status: item.status,
    href: item.href ?? null,
    canAct: KPI_HUB_ACTIONABLE.has(item.kind),
    isOverdue: false,
  };
}

function emptyApprovals(): RevopsApprovalsDto {
  return {
    kpis: { waitingForMe: 0, pendingAll: 0, approvedToday: 0, overdue: 0 },
    queue: [],
    discountMatrix: REVOPS_DISCOUNT_MATRIX,
    fetchedAt: new Date().toISOString(),
  };
}

@Injectable()
export class RevopsApprovalsService {
  constructor(private readonly kpiHubApprovals: KpiHubApprovalsService) {}

  async list(): Promise<RevopsApprovalsDto> {
    let hub: Awaited<ReturnType<KpiHubApprovalsService['list']>>;
    try {
      hub = await this.kpiHubApprovals.list();
    } catch {
      return emptyApprovals();
    }

    const queue = hub.groups.flatMap((g) => g.items.map(mapHubItem));
    const waitingForMe = queue.filter((item) => item.canAct).length;
    const overdue = queue.filter((item) => item.isOverdue).length;

    return {
      kpis: {
        waitingForMe,
        pendingAll: queue.length,
        approvedToday: 0,
        overdue,
      },
      queue,
      discountMatrix: REVOPS_DISCOUNT_MATRIX,
      fetchedAt: new Date().toISOString(),
    };
  }
}
