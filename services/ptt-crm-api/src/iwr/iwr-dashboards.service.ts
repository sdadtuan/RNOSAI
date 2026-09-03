import { ForbiddenException, Injectable } from '@nestjs/common';
import { vnYmd } from './iwr-period.util';
import type {
  IwrActor,
  IwrDashBod,
  IwrDashLeader,
  IwrDashPm,
  IwrDashRole,
  IwrDashStaff,
} from './iwr.types';
import { IwrDashSnapshotsRepository } from './iwr-w4.repository';

const SNAPSHOT_MAX_AGE_MS = 15 * 60_000;

function hasCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrDashboardsService {
  nowFn: () => Date = () => new Date();

  constructor(private readonly repo: IwrDashSnapshotsRepository) {}

  private assertRole(actor: IwrActor, role: IwrDashRole): void {
    if (role === 'bod' && !hasCap(actor, 'executive') && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'executive' });
    }
    if (role === 'pm' && !hasCap(actor, 'review') && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'review' });
    }
    if (role === 'leader' && !hasCap(actor, 'review') && !hasCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'review' });
    }
  }

  async get(actor: IwrActor, role: IwrDashRole): Promise<unknown> {
    this.assertRole(actor, role);
    const ymd = vnYmd(this.nowFn());
    const cached = await this.repo.getSnapshot(role, ymd);
    if (cached) {
      const age = this.nowFn().getTime() - new Date(cached.computed_at).getTime();
      if (age < SNAPSHOT_MAX_AGE_MS) return cached.payload;
    }
    const payload = await this.compute(actor, role, ymd);
    await this.repo.upsertSnapshot(role, ymd, payload);
    return payload;
  }

  async refreshSnapshot(ymd: string): Promise<void> {
    const actor: IwrActor = { staffId: 0, staffLabel: 'system', departmentId: null, caps: [] };
    for (const role of ['staff', 'leader', 'pm', 'bod'] as IwrDashRole[]) {
      const payload = await this.compute(actor, role, ymd);
      await this.repo.upsertSnapshot(role, ymd, payload);
    }
  }

  private async compute(actor: IwrActor, role: IwrDashRole, ymd: string): Promise<unknown> {
    if (role === 'staff') {
      const m = await this.repo.staffMetrics(actor.staffId, ymd);
      const unread = await this.repo.countUnread(actor.staffId);
      const dash: IwrDashStaff = {
        due_today: m.due_today,
        inbox_unread: unread,
        my_late_rate_30d: m.late_den > 0 ? m.late_num / m.late_den : 0,
        open_blockers: m.open_blockers,
      };
      return dash;
    }
    if (role === 'leader') {
      return this.repo.leaderMetrics(actor.staffId, ymd) as Promise<IwrDashLeader>;
    }
    if (role === 'pm') {
      return this.repo.pmMetrics(actor.staffId) as Promise<IwrDashPm>;
    }
    return this.repo.bodMetrics(ymd) as Promise<IwrDashBod>;
  }
}
