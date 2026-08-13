import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadMeetingPrepEnqueueService } from './lead-meeting-prep-enqueue.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import type {
  LeadMeetingPrepStatus,
  RunLeadMeetingPrepBody,
  SelectEntityBody,
} from './lead-meeting-prep.types';

const STATUS_LABEL_VI: Record<LeadMeetingPrepStatus, string> = {
  pending: 'Đang xếp hàng',
  running: 'Đang xử lý',
  awaiting_entity_choice: 'Cần chọn doanh nghiệp',
  ready: 'Sẵn sàng',
  failed: 'Lỗi',
  skipped: 'Bỏ qua',
  cancelled: 'Đã hủy',
};

@Injectable()
export class LeadMeetingPrepService {
  constructor(
    private readonly repo: LeadMeetingPrepRepository,
    private readonly enqueue: LeadMeetingPrepEnqueueService,
    private readonly inputResolver: LeadMeetingPrepInputResolver,
  ) {}

  async getMeetingPrep(leadId: number) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    let row = await this.repo.getByLeadId(leadId);
    if (!row) {
      const resolved = this.inputResolver.resolve(ctx);
      return {
        ok: true,
        lead_id: leadId,
        status: 'skipped' as const,
        status_label_vi: STATUS_LABEL_VI.skipped,
        progress: {
          step: 'none',
          steps_completed: [] as string[],
          message_vi: 'Chưa chạy prep',
        },
        prep_stage: 'm1_first_strike' as const,
        close_readiness_score: null,
        input_snapshot: { input: resolved.input, sources_map: resolved.sources_map },
        entity_candidates: null,
        result: null,
        error: null,
        prep_version: 0,
        updated_at: null,
      };
    }

    const stepsCompleted: string[] = [];
    if (row.status === 'ready' || row.status === 'failed') {
      stepsCompleted.push('collect', 'verify', 'synthesize');
    } else if (row.status === 'running') {
      stepsCompleted.push('collect');
    }

    return {
      ok: true,
      lead_id: leadId,
      status: row.status,
      status_label_vi: STATUS_LABEL_VI[row.status],
      progress: {
        step: row.status === 'ready' ? 'done' : row.status,
        steps_completed: stepsCompleted,
        message_vi: STATUS_LABEL_VI[row.status],
      },
      prep_stage: row.prep_stage,
      close_readiness_score: row.close_readiness_score,
      input_snapshot: row.input_snapshot_json,
      entity_candidates:
        row.status === 'awaiting_entity_choice' ? row.entity_candidates_json : null,
      result: row.status === 'ready' ? row.result_json : null,
      error: row.error_message,
      prep_version: row.prep_version,
      updated_at: row.updated_at,
    };
  }

  async runMeetingPrep(leadId: number, body: RunLeadMeetingPrepBody = {}) {
    const ctx = await this.repo.getLeadContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'Lead not found' });
    }

    const resolved = this.inputResolver.resolve(ctx);
    if (body.website_url?.trim()) {
      resolved.input.website_url = body.website_url.trim();
    }
    if (body.social_urls?.trim()) {
      resolved.input.social_urls = body.social_urls.trim();
    }

    const job = await this.enqueue.enqueueAfterLeadCreated({
      leadId,
      clientId: ctx.client_id,
      prepStage: 'm1_first_strike',
      mode: 'full',
      force: Boolean(body.force),
    });

    return {
      ok: true,
      lead_id: leadId,
      enqueued: Boolean(job),
      job_id: job?.id ?? null,
      prep: await this.getMeetingPrep(leadId),
    };
  }

  async selectEntity(leadId: number, body: SelectEntityBody) {
    const entityId = String(body.entity_id ?? '').trim();
    if (!entityId) {
      throw new NotFoundException({ error: 'entity_id required' });
    }

    const job = await this.enqueue.enqueueAfterLeadCreated({
      leadId,
      prepStage: 'm1_first_strike',
      mode: 'resume_entity',
      selectedEntityId: entityId,
      force: true,
    });

    return {
      ok: true,
      lead_id: leadId,
      entity_id: entityId,
      enqueued: Boolean(job),
      job_id: job?.id ?? null,
      prep: await this.getMeetingPrep(leadId),
    };
  }
}
