import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { AgencySideEffectsService } from '../agency/agency-side-effects.service';
import { B2bCommissionLedgerService } from '../b2b-projects/b2b-commission-ledger.service';
import { SopAutoStartService } from '../sop/sop-auto-start.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { LeadsContractPgRepository } from './leads-contract-pg.repository';
import {
  CONTRACT_AM_ONLY_MESSAGE,
  canWriteLeadContract,
} from './contract-writer.util';
import type {
  ContractReadiness,
  ContractRow,
  ContractApprovalRow,
  CreateContractBody,
  PatchContractBody,
} from './contract.types';

@Injectable()
export class LeadsContractService {
  constructor(
    private readonly pgRepo: LeadsContractPgRepository,
    private readonly sopAutoStart: SopAutoStartService,
    private readonly b2bCommissionLedger: B2bCommissionLedgerService,
    private readonly staffAuth: StaffAuthService,
    private readonly notifications: StaffNotificationsRepository,
    @Optional() private readonly agencySideEffects?: AgencySideEffectsService,
  ) {}

  getReadiness(leadId: number): Promise<ContractReadiness> {
    return this.pgRepo.getReadiness(leadId);
  }

  async getContractForLead(leadId: number): Promise<{ contract: ContractRow | null; approval: ContractApprovalRow | null }> {
    return this.pgRepo.getContractForLead(leadId);
  }

  private async assertWriter(
    staffUser: StaffJwtPayload | undefined,
    actor: string,
    viaInternal: boolean,
    opts: { allowGrandfather?: boolean; createdBy?: string | null } = {},
  ): Promise<void> {
    if (viaInternal && !staffUser) return;
    if (staffUser && (await this.staffAuth.isSuperAdminUser(staffUser))) return;
    const position = staffUser
      ? await this.staffAuth.loadPositionCodePublic(staffUser.position_id)
      : null;
    if (
      canWriteLeadContract({
        positionCode: position,
        actorEmail: staffUser?.email || actor,
        createdBy: opts.createdBy,
        allowGrandfather: opts.allowGrandfather,
      })
    ) {
      return;
    }
    throw new ForbiddenException({
      error: CONTRACT_AM_ONLY_MESSAGE,
      message: CONTRACT_AM_ONLY_MESSAGE,
    });
  }

  private async notifyUsers(
    userIds: string[],
    title: string,
    body: string,
    leadId: number,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.notifications
        .create({
          user_id: userId,
          kind: 'lead_contract',
          title,
          body,
          link_href: `/crm/leads/${leadId}`,
          meta_json: { lead_id: leadId },
        })
        .catch(() => undefined);
    }
  }

  async createDraft(
    leadId: number,
    body: CreateContractBody,
    actor: string,
    staffUser?: StaffJwtPayload,
    viaInternal = false,
  ): Promise<ContractRow> {
    await this.assertWriter(staffUser, actor, viaInternal);
    return this.pgRepo.createDraftContract(leadId, body, actor);
  }

  async patchContract(
    contractId: number,
    leadId: number,
    body: PatchContractBody,
    actor: string,
    staffUser?: StaffJwtPayload,
    viaInternal = false,
  ): Promise<ContractRow> {
    const current = await this.pgRepo.getContractForLead(leadId);
    await this.assertWriter(staffUser, actor, viaInternal, {
      allowGrandfather: true,
      createdBy: current.contract?.created_by,
    });
    return this.pgRepo.patchContract(contractId, leadId, body);
  }

  async submit(
    contractId: number,
    leadId: number,
    actor: string,
    notes: string,
    staffUser?: StaffJwtPayload,
    viaInternal = false,
  ): Promise<ContractApprovalRow> {
    const current = await this.pgRepo.getContractForLead(leadId);
    await this.assertWriter(staffUser, actor, viaInternal, {
      allowGrandfather: true,
      createdBy: current.contract?.created_by,
    });
    const approval = await this.pgRepo.submitForApproval(contractId, leadId, actor, notes);
    const gdkdIds = await this.pgRepo.gdkdAuthUserIds();
    await this.notifyUsers(
      gdkdIds,
      'Hợp đồng chờ GDKD duyệt',
      `Lead #${leadId} — AM đã gửi HĐ, cần GDKD duyệt.`,
      leadId,
    );
    return approval;
  }

  async listPendingApprovals(limit?: number) {
    const approvals = await this.pgRepo.listPendingApprovals(limit ?? 50);
    return { approvals };
  }

  async listByClient(clientId: string, limit?: number) {
    const contracts = await this.pgRepo.listContractsByClient(clientId, limit ?? 50);
    return { contracts };
  }

  private async notifyAmDecision(leadId: number, createdBy: string, title: string, body: string) {
    const userId = await this.pgRepo.authUserIdByEmail(createdBy);
    if (userId) await this.notifyUsers([userId], title, body, leadId);
  }

  async reject(approvalId: number, actor: string, decisionNotes: string): Promise<ContractApprovalRow> {
    const row = await this.pgRepo.rejectApproval(approvalId, actor, decisionNotes);
    const email = String(row.requested_by ?? '').trim();
    if (email) {
      await this.notifyAmDecision(
        row.lead_id,
        email,
        'GDKD từ chối hợp đồng',
        `Lead #${row.lead_id} — GDKD đã từ chối HĐ.${decisionNotes ? ' ' + decisionNotes : ''}`,
      );
    }
    return row;
  }

  async approve(approvalId: number, actor: string) {
    const result = await this.pgRepo.approveAndPromote(approvalId, actor);
    await this.b2bCommissionLedger.postOnContractActive({
      leadId: Number(result.contract.lead_id),
      contractId: Number(result.contract.id),
      amountVnd: Number(result.contract.amount_vnd ?? 0),
    });
    const sop = await this.sopAutoStart.maybeStartOnLifecyclePromote({
      lifecycleId: result.lifecycle_id,
      contractId: result.contract.id,
      serviceSlug: result.contract.service_slug ?? '',
    });
    if (
      result.agency_client_link_mode === 'created' &&
      result.agency_client_id &&
      this.agencySideEffects
    ) {
      void this.agencySideEffects
        .onClientCreated(result.agency_client_id, actor)
        .catch(() => undefined);
    }
    const amEmail = String(result.contract.created_by ?? '').trim();
    if (amEmail && result.contract.lead_id) {
      await this.notifyAmDecision(
        Number(result.contract.lead_id),
        amEmail,
        'GDKD đã duyệt hợp đồng',
        `Lead #${result.contract.lead_id} — HĐ đã được duyệt, lead sang Triển khai.`,
      );
    }
    return { ...result, sop_auto_start: sop };
  }
}
