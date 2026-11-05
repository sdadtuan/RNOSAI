import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CsdAuditRepository } from '../csd/csd-audit.repository';
import { buildIwrInsights, buildIwrSummarizePrompt } from './iwr-ai-prompt.util';
import { iwrLlmEnabled } from './iwr-llm.util';
import { IwrReportsService } from './iwr-reports.service';
import type { IwrActor, IwrAiFeedbackAction } from './iwr.types';

@Injectable()
export class IwrAiService {
  constructor(
    private readonly reports: IwrReportsService,
    private readonly audit: CsdAuditRepository,
  ) {}

  status(): { enabled: boolean } {
    return { enabled: iwrLlmEnabled() };
  }

  private assertEnabled(): void {
    if (!iwrLlmEnabled()) {
      throw new NotFoundException({ error: 'iwr_llm_disabled' });
    }
  }

  async summarize(
    actor: IwrActor,
    reportId: string,
  ): Promise<{ text: string; citations: string[] }> {
    this.assertEnabled();
    const report = await this.reports.get(actor, reportId);
    const prompt = buildIwrSummarizePrompt(report);
    const text = `Tóm tắt báo cáo nội bộ:\n${prompt.slice(0, 1200)}`;
    await this.audit.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'iwr.ai_summarize',
      entity_type: 'iwr_report',
      entity_id: reportId,
      after_json: { citations: [reportId] },
    });
    return { text, citations: [reportId] };
  }

  async insights(
    actor: IwrActor,
    reportId: string,
  ): Promise<{ quality: string[]; risks: string[]; citations: string[] }> {
    this.assertEnabled();
    const report = await this.reports.get(actor, reportId);
    const out = buildIwrInsights(report);
    await this.audit.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'iwr.ai_insights',
      entity_type: 'iwr_report',
      entity_id: reportId,
      after_json: out,
    });
    return { ...out, citations: [reportId] };
  }

  async feedback(
    actor: IwrActor,
    input: { report_id: string; action: IwrAiFeedbackAction; note?: string },
  ): Promise<{ ok: true }> {
    this.assertEnabled();
    if (!['accept', 'dismiss', 'wrong'].includes(input.action)) {
      throw new ForbiddenException({ error: 'iwr_ai_feedback_invalid' });
    }
    await this.reports.get(actor, input.report_id);
    await this.audit.insert({
      actor_staff_id: actor.staffId > 0 ? actor.staffId : null,
      action: 'iwr.ai_feedback',
      entity_type: 'iwr_report',
      entity_id: input.report_id,
      after_json: { feedback: input.action, note: input.note ?? null },
    });
    return { ok: true };
  }
}
