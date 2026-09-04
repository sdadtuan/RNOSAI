import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryOpsService } from '../../delivery-projects/delivery-ops.service';
import { DeliveryProjectsRepository } from '../../delivery-projects/delivery-projects.repository';
import { parseApprovalPolicy } from '../../delivery-projects/delivery-ops.util';
import { KpiHubDictionaryService } from '../dictionary/kpi-hub-dictionary.service';
import { KpiHubTargetsService } from '../targets/kpi-hub-targets.service';
import { KpiHubWorkspaceService } from '../workspace/kpi-hub-workspace.service';

export type HubApprovalItem = {
  id: string;
  kind: 'kpi' | 'target' | 'mapping' | 'delivery_project' | 'delivery_budget' | 'change_request';
  label: string;
  status: string;
  href?: string;
  policy?: Array<{ role: string; label: string }>;
};

export type HubApprovalsResponse = {
  groups: Array<{ id: string; label: string; count: number; items: HubApprovalItem[] }>;
  total: number;
};

@Injectable()
export class KpiHubApprovalsService {
  constructor(
    private readonly dictionary: KpiHubDictionaryService,
    private readonly targets: KpiHubTargetsService,
    private readonly deliveryOps: DeliveryOpsService,
    private readonly deliveryProjectsRepo: DeliveryProjectsRepository,
    private readonly workspace: KpiHubWorkspaceService,
  ) {}

  async list(): Promise<HubApprovalsResponse> {
    const [dictPending, dictReview, targetOut, pendingProjects, pendingCrs, ws] = await Promise.all([
      this.dictionary.list({ status: 'PENDING_APPROVAL', page: 1, page_size: 100 }),
      this.dictionary.list({ status: 'NEED_REVIEW', page: 1, page_size: 100 }),
      this.targets.list({ page: 1, page_size: 100 }),
      this.deliveryOps.listPendingDeliveryApprovals(),
      this.deliveryOps.listPendingChangeRequests(),
      this.workspace.get(),
    ]);

    const dictItems = (dictPending.items ?? []) as Array<{ id: string; code: string; name: string; status: string }>;
    const reviewItems = (dictReview.items ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      status: string;
      tech_preview?: string | null;
    }>;

    const kpiItems: HubApprovalItem[] = dictItems.map((d) => ({
      id: d.id,
      kind: 'kpi',
      label: `${d.code} — ${d.name}`,
      status: d.status,
      href: `/crm/kpi-hub/dictionary?id=${encodeURIComponent(d.id)}`,
    }));

    const targetItems: HubApprovalItem[] = ((targetOut.items ?? []) as Array<{ id: string; dictionary_code?: string; status: string }>)
      .filter((t) => t.status === 'PENDING_APPROVAL')
      .map((t) => ({
        id: t.id,
        kind: 'target',
        label: t.dictionary_code ?? t.id,
        status: t.status,
        href: '/crm/kpi-hub/targets',
      }));

    const mappingApprovalItems: HubApprovalItem[] = reviewItems
      .filter((d) => d.tech_preview == null || d.tech_preview === '')
      .map((d) => ({
        id: d.id,
        kind: 'mapping',
        label: `${d.code} — thiếu mapping`,
        status: 'NEED_REVIEW',
        href: `/crm/kpi-hub/dictionary?id=${encodeURIComponent(d.id)}`,
      }));

    const approvalPolicy = (ws as { approval_policy?: unknown }).approval_policy;
    const deliveryItems: HubApprovalItem[] = pendingProjects.map((p) => ({
      id: p.id,
      kind: p.needs_finance ? 'delivery_budget' : 'delivery_project',
      label: `${p.code ?? p.id} — ${p.name}`,
      status: p.status,
      href: `/crm/delivery-projects/${p.id}`,
      policy: parseApprovalPolicy(approvalPolicy, p.needs_finance),
    }));

    const crItems: HubApprovalItem[] = pendingCrs.map((cr) => ({
      id: cr.id,
      kind: 'change_request',
      label: `${cr.project_code ?? cr.project_id} — CR ${cr.kind}`,
      status: cr.status,
      href: `/crm/delivery-projects/${cr.project_id}`,
    }));

    const groups = [
      { id: 'kpi', label: 'KPI Dictionary', count: kpiItems.length, items: kpiItems },
      { id: 'target', label: 'Target & Cảnh báo', count: targetItems.length, items: targetItems },
      { id: 'mapping', label: 'Mapping nguồn', count: mappingApprovalItems.length, items: mappingApprovalItems },
      { id: 'delivery', label: 'Delivery project / Budget', count: deliveryItems.length, items: deliveryItems },
      { id: 'change_request', label: 'Change Request', count: crItems.length, items: crItems },
    ];

    const total = groups.reduce((sum, g) => sum + g.count, 0);
    return { groups, total };
  }

  async approve(kind: string, id: string, note?: string | null) {
    if (kind === 'change_request') {
      return this.deliveryOps.approveChangeRequest(id, note);
    }
    if (kind === 'delivery_project' || kind === 'delivery_budget') {
      const row = await this.deliveryProjectsRepo.patchHeader(id, { status: 'approved' });
      if (!row) throw new NotFoundException({ error: 'not_found' });
      return { ok: true, id, kind, note: note ?? null, project: row };
    }
    throw new NotFoundException({ error: 'unsupported_kind', kind });
  }

  async reject(kind: string, id: string, note?: string | null) {
    if (kind === 'change_request') {
      return this.deliveryOps.rejectChangeRequest(id, note);
    }
    if (kind === 'delivery_project' || kind === 'delivery_budget') {
      const row = await this.deliveryProjectsRepo.patchHeader(id, { status: 'draft' });
      if (!row) throw new NotFoundException({ error: 'not_found' });
      return { ok: true, id, kind, note: note ?? null, project: row };
    }
    throw new NotFoundException({ error: 'unsupported_kind', kind });
  }
}
