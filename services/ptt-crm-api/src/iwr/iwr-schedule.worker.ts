import { isIwrWorkday, vnYmd } from './iwr-period.util';
import type { IwrScheduleRow } from './iwr.types';

export function reminderEventKey(
  staffId: number,
  templateId: string,
  periodStart: string,
  event: string,
): string {
  return `iwr_remind:${staffId}:${templateId}:${periodStart}:${event}`;
}

export type IwrScheduleWorkerDeps = {
  claimDue: (limit: number) => Promise<IwrScheduleRow[]>;
  tryJob: (eventKey: string, kind: string, payload: Record<string, unknown>) => Promise<boolean>;
  isOnLeave: (staffId: number, ymd: string) => Promise<boolean>;
  listStaff: () => Promise<{ id: number; reports_to_id: number | null }[]>;
  getDailyTemplateId: () => Promise<string | null>;
  findDailyDraft: (authorId: number, ymd: string) => Promise<string | null>;
  createDailyDraft: (input: {
    template_id: string;
    author_staff_id: number;
    reviewer_staff_id: number;
    ymd: string;
    title: string;
    due_at: string;
  }) => Promise<string>;
  notify: (staffId: number, eventKey: string, title: string, body: string, entityId: string) => Promise<void>;
  waiveDraft: (reportId: string, staffId: number) => Promise<void>;
  listManagers: () => Promise<number[]>;
  leaderDigest: (leaderId: number, ymd: string) => Promise<{ missing: number; blockers: number; action: number }>;
};

export async function tickIwrSchedules(deps: IwrScheduleWorkerDeps, now = new Date()): Promise<{ ran: number }> {
  const ymd = vnYmd(now);
  const due = await deps.claimDue(10);
  let ran = 0;

  for (const schedule of due) {
    if (schedule.kind === 'precreate') {
      if (!isIwrWorkday(ymd)) continue;
      const templateId = await deps.getDailyTemplateId();
      if (!templateId) continue;
      const staff = await deps.listStaff();
      for (const s of staff) {
        if (await deps.isOnLeave(s.id, ymd)) {
          const existing = await deps.findDailyDraft(s.id, ymd);
          if (existing) await deps.waiveDraft(existing, s.id);
          continue;
        }
        const key = `iwr_precreate:${s.id}:${ymd}`;
        if (!(await deps.tryJob(key, 'precreate', { staff_id: s.id }))) continue;
        const existing = await deps.findDailyDraft(s.id, ymd);
        if (existing) continue;
        const reportId = await deps.createDailyDraft({
          template_id: templateId,
          author_staff_id: s.id,
          reviewer_staff_id: s.reports_to_id!,
          ymd,
          title: `Báo cáo ngày ${ymd}`,
          due_at: `${ymd}T17:00:00.000+07:00`,
        });
        await deps.notify(s.id, key, 'Báo cáo ngày mới', `Nháp BC ngày ${ymd} đã được tạo`, reportId);
        ran += 1;
      }
    } else if (schedule.kind === 'digest') {
      const managers = await deps.listManagers();
      for (const leaderId of managers) {
        const key = `iwr_digest:${leaderId}:${ymd}`;
        if (!(await deps.tryJob(key, 'digest', { leader_id: leaderId }))) continue;
        const counts = await deps.leaderDigest(leaderId, ymd);
        if (counts.missing + counts.blockers + counts.action === 0) continue;
        await deps.notify(
          leaderId,
          key,
          'Tóm tắt BC team',
          `Thiếu ${counts.missing} · Blocker ${counts.blockers} · Cần xử lý ${counts.action}`,
          leaderId.toString(),
        );
        ran += 1;
      }
    } else if (schedule.kind === 'reminder') {
      const templateId = await deps.getDailyTemplateId();
      if (!templateId) continue;
      const staff = await deps.listStaff();
      for (const s of staff) {
        if (await deps.isOnLeave(s.id, ymd)) continue;
        const draftId = await deps.findDailyDraft(s.id, ymd);
        if (!draftId) continue;
        const event = now.getHours() >= 17 ? 'overdue' : now.getHours() >= 14 ? 'due' : 'before_due';
        const key = reminderEventKey(s.id, templateId, ymd, event);
        if (!(await deps.tryJob(key, 'reminder', { staff_id: s.id, event }))) continue;
        await deps.notify(
          s.id,
          key,
          'Nhắc nộp BC ngày',
          event === 'overdue' ? 'BC ngày đã quá hạn' : 'Nhắc nộp BC ngày hôm nay',
          draftId,
        );
        ran += 1;
      }
    }
  }

  return { ran };
}
