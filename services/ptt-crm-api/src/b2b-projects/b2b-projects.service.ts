import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertChannelKeyAvailable, type ChannelKeyRow } from './b2b-channel-unique.util';
import { PTT_OPERATING_COMPANY_ID } from './b2b-projects.constants';
import { B2bProjectsRepository } from './b2b-projects.repository';
import type {
  B2bProjectChannelInput,
  B2bProjectPageInput,
  B2bProjectRow,
  B2bProjectStaffInput,
  CreateB2bProjectBody,
  PatchB2bProjectBody,
} from './b2b-projects.types';

@Injectable()
export class B2bProjectsService {
  constructor(private readonly repo: B2bProjectsRepository) {}

  list(status?: string): Promise<B2bProjectRow[]> {
    return this.repo.listProjects(status);
  }

  async get(id: string): Promise<B2bProjectRow> {
    const row = await this.repo.getProject(id);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async create(body: CreateB2bProjectBody): Promise<B2bProjectRow> {
    const code = body.code.trim().toLowerCase();
    if (!code || !body.name.trim()) {
      throw new BadRequestException({ error: 'invalid_project' });
    }
    const status = body.status?.trim() as B2bProjectRow['status'] | undefined;
    if (status && !['draft', 'active', 'paused', 'archived'].includes(status)) {
      throw new BadRequestException({ error: 'invalid_status' });
    }
    return this.repo.insertProject({
      owner_company_id: PTT_OPERATING_COMPANY_ID,
      code,
      name: body.name.trim(),
      status,
      ai_call_enabled: body.ai_call_enabled,
      manual_ingest_enabled: body.manual_ingest_enabled,
    });
  }

  async patch(id: string, body: PatchB2bProjectBody): Promise<B2bProjectRow> {
    await this.get(id);
    if (body.status && !['draft', 'active', 'paused', 'archived'].includes(body.status)) {
      throw new BadRequestException({ error: 'invalid_status' });
    }
    const row = await this.repo.patchProject(id, body as Record<string, unknown>);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async delete(id: string): Promise<{ ok: true; detached_leads: number }> {
    await this.get(id);
    const detached = await this.repo.detachLeadsFromProject(id);
    const removed = await this.repo.deleteProject(id);
    if (!removed) throw new NotFoundException({ error: 'not_found' });
    return { ok: true, detached_leads: detached };
  }

  async replacePages(id: string, pages: B2bProjectPageInput[]): Promise<{ ok: true }> {
    await this.get(id);
    await this.assertPagesAvailable(id, pages);
    await this.repo.replacePages(id, pages);
    return { ok: true };
  }

  async replaceChannels(id: string, channels: B2bProjectChannelInput[]): Promise<{ ok: true }> {
    await this.get(id);
    await this.assertChannelsAvailable(id, channels);
    await this.repo.replaceChannels(id, channels);
    return { ok: true };
  }

  async replaceStaff(id: string, staff: B2bProjectStaffInput[]): Promise<{ ok: true }> {
    await this.get(id);
    await this.repo.replaceStaff(id, staff);
    return { ok: true };
  }

  listPages(id: string) {
    return this.repo.listProjectPages(id);
  }

  listChannels(id: string) {
    return this.repo.listProjectChannels(id);
  }

  listStaff(id: string) {
    return this.repo.listProjectStaff(id);
  }

  listStaffMemberships(staffId: number) {
    return this.repo.listStaffMemberships(staffId);
  }

  private async assertPagesAvailable(projectId: string, pages: B2bProjectPageInput[]): Promise<void> {
    const existing = await this.repo.listActiveChannelKeys();
    const nextKeys: ChannelKeyRow[] = [];
    for (const page of pages) {
      nextKeys.push({
        kind: 'page_id',
        value: page.page_id.trim(),
        projectId,
        active: page.active !== false,
      });
      for (const form of page.forms ?? []) {
        nextKeys.push({
          kind: 'form_id',
          value: form.form_id.trim(),
          projectId,
          active: form.active !== false,
        });
      }
    }
    this.assertKeys(existing, nextKeys);
  }

  private async assertChannelsAvailable(
    projectId: string,
    channels: B2bProjectChannelInput[],
  ): Promise<void> {
    const existing = await this.repo.listActiveChannelKeys();
    const nextKeys: ChannelKeyRow[] = channels.map((ch) => ({
      kind:
        ch.channel_type === 'zalo'
          ? 'oa_id'
          : ch.channel_type === 'webform'
            ? 'webform_slug'
            : 'api_key_hash',
      value: ch.external_key.trim(),
      projectId,
      active: ch.active !== false,
    }));
    this.assertKeys(existing, nextKeys);
  }

  private assertKeys(existing: ChannelKeyRow[], nextKeys: ChannelKeyRow[]): void {
    for (const next of nextKeys) {
      try {
        assertChannelKeyAvailable(existing, next);
      } catch {
        throw new BadRequestException({ error: 'channel_key_taken' });
      }
    }
  }
}
