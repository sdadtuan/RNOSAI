import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { readP8QualityFromForms, writeP8QualityPatch } from './ops-p8-quality-state.util';
import type { ReturnToAmResult } from './ops-presales-p8.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trim(value: unknown, max = 800): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

@Injectable()
export class OpsReturnToAmService {
  constructor(private readonly repo: OpsPresalesContextRepository) {}

  async returnToAm(input: Record<string, unknown>): Promise<ReturnToAmResult> {
    const leadId = positiveInt(input.lead_id ?? input.leadId);
    let lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null && leadId != null) {
      lifecycleId = (await this.repo.findLifecycleByLead(leadId))?.id;
    }
    if (lifecycleId == null && leadId == null) {
      throw new BadRequestException({ error: 'lead_or_lifecycle_required' });
    }

    const lifecycle = lifecycleId != null ? await this.repo.getLifecycleDetail(lifecycleId) : null;
    if (lifecycleId != null && !lifecycle) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }

    const reasonCodes = Array.isArray(input.reason_codes)
      ? input.reason_codes.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [];
    if (!reasonCodes.length) {
      throw new BadRequestException({ error: 'reason_codes_required' });
    }

    const customMessage = trim(input.message, 1200);
    const assignee =
      positiveInt(input.assignee_user_id ?? input.assigneeUserId) ??
      lifecycle?.assigned_am ??
      null;

    const leadTask =
      lifecycleId != null ? await this.repo.getStageTask(lifecycleId, 'lead') : null;
    const consultTask =
      lifecycleId != null ? await this.repo.getStageTask(lifecycleId, 'consult') : null;
    const quality = readP8QualityFromForms({
      leadForm: leadTask?.form_data,
      consultForm: consultTask?.form_data,
    });

    const triedDraft =
      quality.need_pain.status === 'assumed_draft' ||
      quality.icp.status === 'assumed_draft' ||
      quality.service_status === 'recommended_draft';

    const message =
      customMessage ||
      [
        'Trả AM — chưa đủ Tư vấn/Winning:',
        ...reasonCodes.map((c) => `- ${c}`),
        `Bot đã thử draft: ${triedDraft ? 'yes' : 'no'}. Cần Confirm Assumed hoặc bổ sung từ khách.`,
      ].join('\n');

    const target = consultTask ?? leadTask;
    if (target) {
      const patched = writeP8QualityPatch({
        form: target.form_data,
        needs_am_rework: true,
        return_to_am_blockers: reasonCodes,
      });
      const noteLine = `\n[P8 return_to_am @ ${new Date().toISOString()}]\n${message}`;
      await this.repo.patchStageTaskFormData(
        target.id,
        patched,
        `${target.notes || ''}${noteLine}`.slice(0, 4000),
      );
    }

    return {
      ok: true,
      phase: 'P8',
      needs_am_rework: true,
      reason_codes: reasonCodes,
      message,
      assignee_user_id: assignee,
      links: lifecycleId
        ? [`/crm/service-delivery/${lifecycleId}`]
        : leadId
          ? [`/crm/leads/${leadId}`]
          : [],
    };
  }
}
