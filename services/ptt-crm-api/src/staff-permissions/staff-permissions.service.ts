import { Injectable, NotFoundException } from '@nestjs/common';
import {
  catalogActionLabel,
  loadStaffPermissionCatalog,
} from './staff-permissions.catalog';
import { StaffPermissionsRepository } from './staff-permissions.repository';
import type { PatchStaffPositionGrantsBody } from './staff-permissions.types';

@Injectable()
export class StaffPermissionsService {
  constructor(private readonly repo: StaffPermissionsRepository) {}

  getCatalog() {
    const catalog = loadStaffPermissionCatalog();
    return {
      version: catalog.version,
      actions: catalog.actions,
      extra_actions: catalog.extra_actions,
      extra_action_labels: catalog.extra_action_labels,
      sections: catalog.sections,
      ui_buttons: catalog.ui_buttons,
      section_actions: catalog.section_actions,
    };
  }

  listPositions() {
    return this.repo.listPositions();
  }

  async getPosition(positionId: number) {
    const detail = await this.repo.buildPositionDetail(positionId);
    if (!detail) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });
    return detail;
  }

  async patchPosition(positionId: number, body: PatchStaffPositionGrantsBody, actorEmail: string) {
    const position = await this.repo.getPosition(positionId);
    if (!position) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });

    const result = await this.repo.replaceCaps(positionId, body.grants ?? {}, actorEmail);
    const detail = await this.repo.buildPositionDetail(positionId);
    return {
      ok: true,
      position_id: positionId,
      position_code: position.code,
      added: result.added,
      removed: result.removed,
      diff: result.diff,
      position: detail,
    };
  }

  listAudit(positionId?: number, limit?: number) {
    return this.repo.listAudit(positionId, limit);
  }

  async exportPosition(positionId: number) {
    const detail = await this.repo.buildPositionDetail(positionId);
    if (!detail) throw new NotFoundException({ error: 'position_not_found', position_id: positionId });
    const catalog = loadStaffPermissionCatalog();
    const lines = [
      `# Ma trận phân quyền — ${detail.code} (${detail.name})`,
      '',
      '| Nhóm | Section | Action |',
      '| --- | --- | --- |',
    ];
    for (const row of detail.matrix) {
      for (const action of row.allowed) {
        lines.push(
          `| ${row.group} | ${row.section_label} (${row.section_id}) | ${catalogActionLabel(action, catalog)} (${action}) |`,
        );
      }
    }
    return {
      format: 'markdown',
      position_id: detail.id,
      position_code: detail.code,
      position_name: detail.name,
      markdown: lines.join('\n'),
      grants: detail.grants,
      matrix: detail.matrix,
    };
  }
}
