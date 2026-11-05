import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
import { AiAuditService } from '../ai-intelligence/ai-audit.service';
import { PipelineRiskService } from '../ai-intelligence/pipeline-risk.service';
import { AppConfigService } from '../config/app-config.service';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CrmStaffPgRepository } from '../crm-staff/crm-staff-pg.repository';
import { LeadsContractService } from '../leads-contract/leads-contract.service';
import { PgLeadsWriteRepository } from '../leads/pg-leads-write.repository';
import { SlaAutoTaskService } from '../leads/sla-auto-task.service';
import { OpsService } from '../ops/ops.service';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import {
  hasCeoAct,
  hasDealAccess,
  hasLeadAssign,
  hasLeadEdit,
  hasOpsWrite,
} from './ceo-command-caps.util';
import {
  forbiddenReply,
  parseForbiddenRequest,
  previewVi,
  requiredCapsForAction,
  validateActionParams,
} from './ceo-command-action.catalog';
import { CeoCommandActionsRepository } from './ceo-command-actions.repository';
import { CeoCommandRateService } from './ceo-command-rate.service';
import type { CeoActor, CeoProposedAction } from './ceo-command.types';
import { CeoCommandTurnsRepository } from './ceo-command-turns.repository';
import { maskCeoPii } from './ceo-command.util';

function hasCap(caps: CeoActor['caps'], section: string, action: string): boolean {
  return caps.some((c) => c.section === section && c.action === action);
}

function capsSatisfied(actor: CeoActor, required: Array<{ section: string; action: string }>): boolean {
  for (const cap of required) {
    if (cap.section === 'ceo_command' && cap.action === 'act') {
      if (!hasCeoAct(actor.caps) && !hasLeadAssign(actor.caps)) return false;
      continue;
    }
    if (cap.section === 'crm_sales_funnel') {
      if (!hasDealAccess(actor.caps)) return false;
      continue;
    }
    if (cap.section === 'crm_board' && cap.action === 'edit') {
      if (!hasOpsWrite(actor.caps)) return false;
      continue;
    }
    if (!hasCap(actor.caps, cap.section, cap.action)) return false;
  }
  return true;
}

@Injectable()
export class CeoCommandActionsService {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly turns: CeoCommandTurnsRepository,
    private readonly repo: CeoCommandActionsRepository,
    private readonly rate: CeoCommandRateService,
    private readonly ops: OpsService,
    private readonly pipelineRisk: PipelineRiskService,
    private readonly crmLegacy: CrmLeadsLegacyService,
    private readonly crmStaffPg: CrmStaffPgRepository,
    private readonly notifications: StaffNotificationsRepository,
    private readonly slaAutoTask: SlaAutoTaskService,
    private readonly contracts: LeadsContractService,
    private readonly leadsWrite: PgLeadsWriteRepository,
    private readonly audit: AiAuditService,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  parseForbidden(message: string): { reply_vi: string } | null {
    const link = parseForbiddenRequest(message);
    if (!link) return null;
    return { reply_vi: forbiddenReply(link) };
  }

  async preview(
    actionId: string,
    params: Record<string, unknown>,
    actor: CeoActor,
  ): Promise<CeoProposedAction> {
    let validated: Record<string, unknown>;
    try {
      validated = validateActionParams(actionId, params);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }

    if (validated.note) {
      validated = { ...validated, note: maskCeoPii(String(validated.note)) };
    }
    if (validated.body) {
      validated = { ...validated, body: maskCeoPii(String(validated.body)) };
    }
    if (validated.title) {
      validated = { ...validated, title: maskCeoPii(String(validated.title)) };
    }

    let staffName: string | undefined;
    const staffId = Number(validated.staff_id ?? validated.owner_staff_id ?? 0);
    if (staffId > 0) {
      const row = await this.crmStaffPg.getStaffById(staffId);
      staffName = row?.name ? String(row.name) : undefined;
      if (staffName && validated.staff_id) {
        validated = { ...validated, staff_name: staffName };
      }
    }

    const required_caps = requiredCapsForAction(actionId);
    const can_confirm = hasCeoAct(actor.caps) && capsSatisfied(actor, required_caps);

    return {
      action_id: actionId,
      params: validated,
      preview_vi: previewVi(actionId, validated, staffName),
      required_caps,
      can_confirm,
    };
  }

  async commit(
    input: { turn_id: string; idempotency_key: string },
    actor: CeoActor,
  ): Promise<{ status: string; result_json: unknown; reused: boolean }> {
    if (!hasCeoAct(actor.caps)) {
      throw new ForbiddenException({ error: 'ceo_act_forbidden' });
    }
    this.rate.check(`ceo-cmd-act:${actor.staffId}`, 10, 300_000);

    const existing = await this.repo.findByIdempotency(input.idempotency_key);
    if (existing) {
      return { status: existing.status, result_json: existing.result_json, reused: true };
    }

    const turn = await this.turns.findById(input.turn_id);
    if (!turn) throw new NotFoundException({ error: 'turn_not_found' });
    if (turn.actor_staff_id !== actor.staffId) {
      throw new ForbiddenException({ error: 'turn_owner_mismatch' });
    }
    const proposed = turn.proposed_action_json as CeoProposedAction | null;
    if (!proposed?.action_id) {
      throw new BadRequestException({ error: 'no_proposed_action' });
    }

    const params = validateActionParams(proposed.action_id, proposed.params ?? {});
    if (!capsSatisfied(actor, proposed.required_caps ?? [])) {
      await this.repo.insert({
        turn_id: turn.id,
        idempotency_key: input.idempotency_key,
        action_id: proposed.action_id,
        params_json: params,
        status: 'rejected_cap',
        result_json: { error: 'missing_cap' },
        actor_staff_id: actor.staffId,
      });
      throw new ForbiddenException({ error: 'missing_cap' });
    }

    let status = 'committed';
    let result: Record<string, unknown> = { ok: true };

    try {
      result = await this.executeAction(proposed.action_id, params, actor);
    } catch (e) {
      const msg = String((e as Error)?.message ?? 'failed');
      status = msg.includes('not_found') ? 'target_gone' : 'failed';
      result = { error: msg };
    }

    await this.repo.insert({
      turn_id: turn.id,
      idempotency_key: input.idempotency_key,
      action_id: proposed.action_id,
      params_json: params,
      status,
      result_json: result,
      actor_staff_id: actor.staffId,
    });

    try {
      await this.audit.wrap(
        {
          useCase: AI_USE_CASE.CEO_COMMAND_ACT,
          entityType: 'ceo_action',
          entityId: proposed.action_id,
          actorId: String(actor.staffId),
          correlationId: input.idempotency_key,
          modelName: 'ceo-command-v1',
          input: { action_id: proposed.action_id, params },
        },
        async () => ({ data: result, output: result }),
      );
    } catch {
      /* audit must not block commit response */
    }

    if (status !== 'committed') {
      throw new BadRequestException({ error: status, result });
    }
    return { status, result_json: result, reused: false };
  }

  private async executeAction(
    actionId: string,
    params: Record<string, unknown>,
    actor: CeoActor,
  ): Promise<Record<string, unknown>> {
    switch (actionId) {
      case 'ack_ops_alert': {
        const out = await this.ops.acknowledgeAlert(Number(params.alert_id), actor.staffLabel);
        return { alert: out };
      }
      case 'assign_pipeline_risk': {
        const staffId = Number(params.staff_id);
        const staff = await this.crmStaffPg.getStaffById(staffId);
        const staffName = String(staff?.name ?? params.staff_name ?? '').trim();
        const out = await this.pipelineRisk.assignFollowUpOwner({
          recommendationId: String(params.recommendation_id),
          staffId,
          staffName,
          actorId: actor.staffLabel,
        });
        return out.data as unknown as Record<string, unknown>;
      }
      case 'log_pipeline_activity': {
        const out = await this.pipelineRisk.logFollowUpActivity({
          recommendationId: String(params.recommendation_id),
          note: String(params.note),
          actorId: actor.staffLabel,
        });
        return out.data as unknown as Record<string, unknown>;
      }
      case 'assign_lead': {
        const out = await this.crmLegacy.assignLead(
          Number(params.lead_id),
          { to_user_id: Number(params.owner_staff_id), reason: 'CEO Command' },
          actor.staffLabel,
        );
        return { lead_id: out.lead.id };
      }
      case 'remind_staff': {
        const uuid = await this.resolveStaffUserUuid(Number(params.staff_id));
        if (!uuid) throw new Error('staff_user_not_found');
        const note = await this.notifications.create({
          user_id: uuid,
          kind: 'ceo_remind',
          title: String(params.title),
          body: String(params.body),
          link_href: params.link_href ? String(params.link_href) : null,
        });
        return { notification_id: note.id };
      }
      case 'sla_remind_lead': {
        const out = await this.slaAutoTask.createReminder(
          Number(params.lead_id),
          {
            tier: params.tier as never,
            suggested_action: params.suggested_action as never,
          },
          actor.staffLabel,
          actor.staffId,
        );
        return out;
      }
      case 'remind_contract_approval': {
        const leadId = Number(params.lead_id);
        let targetStaffId = await this.resolveContractApprovalStaffId(leadId, params.contract_id);
        if (!targetStaffId) {
          targetStaffId = await this.resolveStaffIdByPositionCode('GDKD-01');
        }
        if (!targetStaffId) throw new Error('gdkd_staff_not_found');
        const uuid = await this.resolveStaffUserUuid(targetStaffId);
        if (!uuid) throw new Error('staff_user_not_found');
        const linkHref = `/crm/hub?lead_id=${leadId}`;
        const note = await this.notifications.create({
          user_id: uuid,
          kind: 'ceo_remind',
          title: `CEO nhắc duyệt HĐ lead #${leadId}`,
          body: `Hợp đồng lead #${leadId} đang chờ GDKD duyệt.`,
          link_href: linkHref,
        });
        return { notification_id: note.id, lead_id: leadId, link_href: linkHref };
      }
      case 'prioritize_solution_queue': {
        const leadId = Number(params.lead_id);
        const note = String(params.note ?? '').trim();
        await this.leadsWrite.mergeLeadMeta(leadId, { priority_consult: 'ceo' });
        const mktStaffId = await this.resolveStaffIdByPositionCode('MKT-01');
        if (!mktStaffId) throw new Error('mkt_staff_not_found');
        const uuid = await this.resolveStaffUserUuid(mktStaffId);
        if (!uuid) throw new Error('staff_user_not_found');
        const linkHref = `/crm/hub?lead_id=${leadId}`;
        const body = note
          ? `CEO ưu tiên queue Solution — ${note}`
          : `CEO ưu tiên queue Solution cho lead #${leadId}`;
        const notification = await this.notifications.create({
          user_id: uuid,
          kind: 'ceo_remind',
          title: `Ưu tiên queue Solution lead #${leadId}`,
          body,
          link_href: linkHref,
        });
        return {
          notification_id: notification.id,
          lead_id: leadId,
          priority_consult: 'ceo',
          link_href: linkHref,
        };
      }
      default:
        throw new BadRequestException({ error: 'unknown_action' });
    }
  }

  private async resolveStaffUserUuid(staffId: number): Promise<string | null> {
    try {
      const staff = await this.crmStaffPg.getStaffById(staffId);
      const email = String(staff?.email ?? '').trim().toLowerCase();
      if (!email) return null;
      const result = await this.db.query(
        `SELECT id::text FROM staff_users WHERE lower(trim(email)) = $1 AND active IS TRUE LIMIT 1`,
        [email],
      );
      return result.rows[0]?.id ? String(result.rows[0].id) : null;
    } catch {
      return null;
    }
  }

  private async resolveStaffIdByPositionCode(positionCode: string): Promise<number | null> {
    try {
      const result = await this.db.query(
        `SELECT s.id
         FROM crm_staff s
         JOIN crm_positions p ON p.id = s.position_id
         WHERE p.code = $1 AND COALESCE(s.active, TRUE) IS TRUE
         ORDER BY s.id ASC
         LIMIT 1`,
        [positionCode],
      );
      const id = Number(result.rows[0]?.id ?? 0);
      return id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  private async resolveContractApprovalStaffId(
    leadId: number,
    contractId?: unknown,
  ): Promise<number | null> {
    try {
      const { approval } = await this.contracts.getContractForLead(leadId);
      if (!approval) return null;
      if (contractId != null) {
        const wanted = Number(contractId);
        if (Number.isFinite(wanted) && wanted > 0 && approval.contract_id !== wanted) {
          return null;
        }
      }
      const submitted = (approval as unknown as Record<string, unknown>).submitted_to_staff_id;
      const staffId = Number(submitted ?? 0);
      return Number.isFinite(staffId) && staffId > 0 ? staffId : null;
    } catch {
      return null;
    }
  }
}
