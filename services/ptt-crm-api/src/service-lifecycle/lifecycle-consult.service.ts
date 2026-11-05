import { Injectable, NotFoundException } from '@nestjs/common';
import { IntakeService } from '../intake/intake.service';
import { buildConsultBrief, prefillConsultTaskForm } from './lifecycle-consult.util';
import { LifecycleTasksPgRepository } from './lifecycle-tasks-pg.repository';
import { ServiceLifecyclePgRepository } from './service-lifecycle-pg.repository';

@Injectable()
export class LifecycleConsultService {
  constructor(
    private readonly pg: ServiceLifecyclePgRepository,
    private readonly tasksPg: LifecycleTasksPgRepository,
    private readonly intake: IntakeService,
  ) {}

  async getConsultBrief(lifecycleId: number): Promise<Record<string, unknown>> {
    const lc = await this.pg.getLifecycleById(lifecycleId);
    if (!lc) {
      throw new NotFoundException({ error: `Không tìm thấy lifecycle #${lifecycleId}` });
    }

    const grouped = await this.tasksPg.listTasksGrouped(lifecycleId);
    const leadTasks = grouped.lead ?? [];
    const leadTaskRow = leadTasks[0] ?? null;
    const leadTask = leadTaskRow
      ? {
          task_id: leadTaskRow.id,
          form_data: leadTaskRow.form_data,
          notes: leadTaskRow.notes,
          is_done: leadTaskRow.is_done,
        }
      : null;
    const consultTaskRow = (grouped.consult ?? [])[0] ?? null;
    const consultForm = consultTaskRow?.form_data ?? {};

    const intakeBundle = lc.lead_id
      ? await this.intake.listSessions(lc.lead_id, lifecycleId)
      : await this.intake.listSessions(undefined, lifecycleId);
    const intakeSessions = intakeBundle.sessions;

    const brief = buildConsultBrief({
      lifecycleId,
      serviceSlug: lc.service_slug,
      leadId: lc.lead_id,
      leadTaskDone: await this.tasksPg.isStageComplete(lifecycleId, 'lead'),
      leadTask,
      intakeSessions,
    });
    // P8 — merge Consult form Đối tượng mục tiêu / p8_quality into highlights for autofill.
    const highlights = {
      ...((brief.highlights ?? {}) as Record<string, unknown>),
    };
    const audience = String(
      consultForm.target_audience ??
        (consultForm.p8_quality as { icp?: { text?: string } } | undefined)?.icp?.text ??
        '',
    ).trim();
    if (audience) highlights.target_audience = audience;
    const painFromConsult = String(
      (consultForm.p8_quality as { need_pain?: { text?: string } } | undefined)?.need_pain?.text ??
        '',
    ).trim();
    if (painFromConsult && !String(highlights.pain ?? '').trim()) {
      highlights.pain = painFromConsult;
    }
    brief.highlights = highlights;

    const p8 = (consultForm.p8_quality as Record<string, unknown> | undefined) ?? {};
    const leadForm = leadTask?.form_data ?? {};
    const leadP8 = (leadForm.p8_quality as Record<string, unknown> | undefined) ?? {};
    const latestIntake = [...intakeSessions]
      .filter((s) => s.status === 'completed')
      .sort((a, b) => {
        const ak = `${a.completed_at ?? ''}\0${a.id}`;
        const bk = `${b.completed_at ?? ''}\0${b.id}`;
        return bk.localeCompare(ak);
      })[0];
    const intakeMeta =
      latestIntake?.answers_json &&
      typeof latestIntake.answers_json === 'object' &&
      (latestIntake.answers_json as { meta?: Record<string, unknown> }).meta &&
      typeof (latestIntake.answers_json as { meta?: Record<string, unknown> }).meta === 'object'
        ? ((latestIntake.answers_json as { meta: Record<string, unknown> }).meta ?? {})
        : {};
    brief.p8_quality = {
      need_pain:
        p8.need_pain ?? leadP8.need_pain ?? intakeMeta.pain_quality ?? null,
      icp: p8.icp ?? leadP8.icp ?? null,
      service_status:
        consultForm.service_status ?? leadForm.service_status ?? p8.service_status ?? 'unknown',
      needs_am_rework: Boolean(
        consultForm.needs_am_rework ?? leadForm.needs_am_rework ?? p8.needs_am_rework,
      ),
    };
    return brief;
  }

  async prefillConsultTask(
    lifecycleId: number,
    opts: { overwrite?: boolean } = {},
  ): Promise<{
    task_id: number | null;
    filled: number;
    fields: string[];
    skipped_existing: string[];
  }> {
    const lc = await this.pg.getLifecycleById(lifecycleId);
    if (!lc) {
      throw new NotFoundException({ error: `Không tìm thấy lifecycle #${lifecycleId}` });
    }

    const grouped = await this.tasksPg.listTasksGrouped(lifecycleId);
    const consultTasks = grouped.consult ?? [];
    const consultTask = consultTasks[0];
    if (!consultTask) {
      return { task_id: null, filled: 0, fields: [], skipped_existing: [] };
    }

    const leadTasks = grouped.lead ?? [];
    const leadTask = leadTasks[0] ?? null;
    const intakeBundle = lc.lead_id
      ? await this.intake.listSessions(lc.lead_id, lifecycleId)
      : await this.intake.listSessions(undefined, lifecycleId);
    const intakeSessions = intakeBundle.sessions;
    const latestCompleted = intakeSessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => {
        const ak = `${a.completed_at ?? ''}\0${a.id}`;
        const bk = `${b.completed_at ?? ''}\0${b.id}`;
        return bk.localeCompare(ak);
      })[0] ?? null;

    const result = prefillConsultTaskForm({
      serviceSlug: lc.service_slug,
      consultTask,
      leadTask,
      latestIntake: latestCompleted,
      overwrite: Boolean(opts.overwrite),
    });

    await this.tasksPg.updateTask(consultTask.id, {
      form_data: result.form_data,
      notes: result.notes,
    });

    return {
      task_id: consultTask.id,
      filled: result.filled.length,
      fields: result.filled,
      skipped_existing: result.skipped_existing,
    };
  }
}
