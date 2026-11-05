import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IwrListsRepository } from './iwr-lists.repository';
import type { IwrActor, IwrListRow } from './iwr.types';

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

@Injectable()
export class IwrListsService {
  constructor(private readonly repo: IwrListsRepository) {}

  async list(_actor: IwrActor): Promise<{ items: IwrListRow[] }> {
    const items = await this.repo.list();
    return { items };
  }

  async create(
    actor: IwrActor,
    input: Omit<IwrListRow, 'id' | 'owner_staff_id'>,
  ): Promise<IwrListRow> {
    if (!hasIwrCap(actor, 'lists') && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'lists' });
    }
    return this.repo.insert({
      code: input.code,
      name_vi: input.name_vi,
      owner_staff_id: actor.staffId,
      kind: input.kind,
      rule_json: input.rule_json,
      active: input.active,
    });
  }

  async patch(
    actor: IwrActor,
    id: string,
    patch: Partial<Pick<IwrListRow, 'name_vi' | 'rule_json' | 'active'>>,
  ): Promise<IwrListRow> {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: 'iwr_list_not_found' });
    if (row.owner_staff_id !== actor.staffId && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) throw new NotFoundException({ error: 'iwr_list_not_found' });
    return updated;
  }

  async addMember(actor: IwrActor, listId: string, staffId: number): Promise<{ ok: true }> {
    const row = await this.repo.getById(listId);
    if (!row) throw new NotFoundException({ error: 'iwr_list_not_found' });
    if (row.owner_staff_id !== actor.staffId && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'iwr_forbidden' });
    }
    await this.repo.addMember(listId, staffId);
    return { ok: true };
  }

  async resolveMembers(listId: string): Promise<number[]> {
    const row = await this.repo.getById(listId);
    if (!row || !row.active) return [];

    if (row.kind === 'department') {
      const deptId = Number(row.rule_json.department_id);
      if (!Number.isFinite(deptId)) return [];
      return this.repo.resolveDepartmentMembers(deptId);
    }

    return this.repo.listMemberIds(listId);
  }

  async previewDynamic(actor: IwrActor, listId: string): Promise<{ staff_ids: number[] }> {
    if (!hasIwrCap(actor, 'lists') && !hasIwrCap(actor, 'manage')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'iwr', action: 'lists' });
    }
    const staff_ids = await this.resolveMembers(listId);
    return { staff_ids };
  }
}
