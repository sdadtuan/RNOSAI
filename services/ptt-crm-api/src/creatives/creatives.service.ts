import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  assetStreamSecret,
  assetStreamTtlSec,
  buildAssetStreamPath,
  isHttpAssetUrl,
  mintAssetStreamQuery,
} from '../cp/cp-asset-signed-url.util';
import {
  assertAssetStreamSig,
  openReadableWeaveFile,
  resolveReadableWeaveFile,
  type OpenedAssetStream,
} from '../cp/cp-asset-stream-file.util';
import { guessMime } from '../cp/cp-weave-ingest.util';
import { weaveExportPrefix } from '../cp/cp-weave-stream-path.util';
import { DomainEventService } from '../events/domain-event.service';
import {
  creativeApprovedIdempotencyKey,
  creativeRejectedIdempotencyKey,
} from '../events/event-idempotency';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { PortalCreativeNotifyService } from '../portal/portal-creative-notify.service';
import { PortalNotificationService } from '../portal/portal-notification.service';
import { LaunchQaCreativeBridgeService } from '../launch-qa/launch-qa-creative-bridge.service';
import { CreativesRepository } from './creatives.repository';
import {
  CreateCreativeBody,
  CreateCreativeResponse,
  CreativeDecisionResponse,
  CreativeHistoryResponse,
  CreativePendingResponse,
} from './creatives.types';
import { TemporalCreativeService } from './temporal-creative.service';

@Injectable()
export class CreativesService {
  constructor(
    private readonly repo: CreativesRepository,
    private readonly events: DomainEventService,
    private readonly temporal: TemporalCreativeService,
    private readonly launchQaBridge: LaunchQaCreativeBridgeService,
    private readonly portalNotify: PortalCreativeNotifyService,
    private readonly portalNotifications: PortalNotificationService,
  ) {}

  async listPending(clientId: string): Promise<CreativePendingResponse> {
    await this.ensureReady();
    const rows = await this.repo.listPending(clientId);
    return { ok: true, client_id: clientId, count: rows.length, rows };
  }

  async listHistory(clientId: string, days = 30): Promise<CreativeHistoryResponse> {
    await this.ensureReady();
    const safeDays = Math.min(90, Math.max(1, Number(days) || 30));
    const rows = await this.repo.listHistoryForClient(clientId, safeDays);
    return { ok: true, client_id: clientId, days: safeDays, count: rows.length, rows };
  }

  async pendingCount(clientId: string): Promise<{ ok: boolean; count: number }> {
    await this.ensureReady();
    const count = await this.repo.countPending(clientId);
    return { ok: true, count };
  }

  async submit(body: CreateCreativeBody): Promise<CreateCreativeResponse> {
    await this.ensureReady();
    const clientId = body.client_id?.trim();
    const title = body.title?.trim();
    if (!clientId || !title) {
      throw new BadRequestException({ error: 'client_id and title required' });
    }
    if (!(await this.repo.clientExists(clientId))) {
      throw new NotFoundException({ error: 'client_not_found' });
    }

    const version = Math.max(1, Number(body.version) || 1);
    const submittedBy = body.submitted_by?.trim() || 'am@pttads.vn';
    const creative = await this.repo.create({
      clientId,
      title,
      description: body.description?.trim() || null,
      externalCampaignId: body.external_campaign_id?.trim() || null,
      externalCampaignName: body.external_campaign_name?.trim() || null,
      version,
      assetUrl: body.asset_url?.trim() || null,
      assetType: body.asset_type?.trim() || 'image',
      submittedBy,
      channel: body.channel,
    });

    const wf = await this.temporal.startCreativeWorkflow({
      creativeId: creative.id,
      clientId,
      title,
      version,
      submittedBy,
    });

    const linked = await this.repo.updateTemporalMeta(creative.id, wf.workflowId, wf.runId);
    const finalCreative = linked ?? creative;
    await this.portalNotifications.emitCreativePending(finalCreative);
    return {
      ok: true,
      creative: finalCreative,
      workflow_id: wf.workflowId,
      workflow_started: wf.started,
      temporal_run_id: wf.runId,
    };
  }

  async approve(user: PortalJwtPayload, creativeId: string): Promise<CreativeDecisionResponse> {
    this.assertApprover(user);
    return this.decide(user, creativeId, 'approved', null);
  }

  async reject(
    user: PortalJwtPayload,
    creativeId: string,
    note?: string,
  ): Promise<CreativeDecisionResponse> {
    this.assertApprover(user);
    return this.decide(user, creativeId, 'rejected', note?.trim() || null);
  }

  async mintAssetUrl(
    user: PortalJwtPayload,
    creativeId: string,
  ): Promise<{ url: string; mode: 'external' | 'signed'; mime: string }> {
    const existing = await this.requireCreative(creativeId, user.client_id);
    const mime = creativeMime(existing);
    const assetUrl = existing.asset_url?.trim() || '';
    if (!assetUrl) {
      throw new NotFoundException({ error: 'not_found' });
    }
    if (isHttpAssetUrl(assetUrl)) {
      return { url: assetUrl, mode: 'external', mime };
    }
    if (!weaveExportPrefix()) {
      throw new ServiceUnavailableException({ error: 'export_prefix_unavailable' });
    }
    if (!resolveReadableWeaveFile(assetUrl, mime)) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const minted = mintAssetStreamQuery({
      resource: 'creative',
      id: existing.id,
      secret: assetStreamSecret(),
      ttlSec: assetStreamTtlSec(),
    });
    return {
      url: buildAssetStreamPath(`/api/v1/creatives/${existing.id}/asset`, minted.exp, minted.sig),
      mode: 'signed',
      mime,
    };
  }

  async openAssetStream(
    creativeId: string,
    exp?: string,
    sig?: string,
  ): Promise<OpenedAssetStream> {
    assertAssetStreamSig('creative', creativeId.trim(), exp, sig);
    const existing = await this.requireCreative(creativeId);
    const assetUrl = existing.asset_url?.trim() || '';
    const opened = assetUrl ? openReadableWeaveFile(assetUrl, creativeMime(existing)) : null;
    if (!opened) {
      throw new NotFoundException({ error: 'not_found' });
    }
    return opened;
  }

  private async decide(
    user: PortalJwtPayload,
    creativeId: string,
    decision: 'approved' | 'rejected',
    note: string | null,
  ): Promise<CreativeDecisionResponse> {
    await this.ensureReady();
    const existing = await this.repo.findById(creativeId);
    if (!existing) {
      throw new NotFoundException({ error: 'Not found' });
    }
    if (existing.client_id !== user.client_id) {
      throw new ForbiddenException({ error: 'client_id_mismatch' });
    }
    if (existing.status !== 'pending_client') {
      throw new ConflictException({ error: 'creative_not_pending', status: existing.status });
    }

    const updated = await this.repo.updateDecision(
      creativeId,
      decision,
      user.email,
      note,
    );
    if (!updated) {
      throw new ConflictException({ error: 'creative_not_pending' });
    }

    const eventType = decision === 'approved' ? 'CreativeApproved' : 'CreativeRejected';
    const idempotencyKey =
      decision === 'approved'
        ? creativeApprovedIdempotencyKey(creativeId, updated.version)
        : creativeRejectedIdempotencyKey(creativeId, updated.version);

    const eventId = await this.events.emit(
      eventType,
      'creative',
      creativeId,
      {
        creative_id: creativeId,
        client_id: user.client_id,
        version: updated.version,
        reviewed_by: user.email,
        review_note: note,
        external_campaign_id: updated.external_campaign_id,
      },
      user.sub,
      idempotencyKey,
    );

    const temporalSignal = await this.temporal.signalDecision({
      creativeId,
      clientId: user.client_id,
      version: updated.version,
      decision,
      reviewedBy: user.email,
      note,
      workflowId: updated.temporal_workflow_id,
    });

    let launchQaSync: Awaited<ReturnType<LaunchQaCreativeBridgeService['onCreativeApproved']>> | null =
      null;
    if (decision === 'approved') {
      launchQaSync = await this.launchQaBridge.onCreativeApproved({
        clientId: user.client_id,
        externalCampaignId: updated.external_campaign_id,
        reviewedBy: user.email,
      });
    }

    const notify = await this.portalNotify.notifyDecision(updated, decision, user.email, note);

    return {
      ok: true,
      creative: updated,
      event_id: eventId,
      temporal_signal: temporalSignal,
      launch_qa_sync: launchQaSync,
      notify,
    };
  }

  private assertApprover(user: PortalJwtPayload): void {
    if (user.role !== 'approver') {
      throw new ForbiddenException({ error: 'approver_role_required' });
    }
  }

  private async requireCreative(creativeId: string, clientId?: string) {
    await this.ensureReady();
    const existing = await this.repo.findById(creativeId.trim());
    if (!existing) {
      throw new NotFoundException({ error: 'Not found' });
    }
    if (clientId && existing.client_id !== clientId) {
      throw new ForbiddenException({ error: 'client_id_mismatch' });
    }
    return existing;
  }

  private async ensureReady(): Promise<void> {
    if (!(await this.repo.pgCreativesReady())) {
      throw new ServiceUnavailableException({ ok: false, error: 'creatives_tables_not_ready' });
    }
  }
}

function creativeMime(row: { asset_type: string; asset_url: string | null }): string {
  if (row.asset_type === 'video') return 'video/mp4';
  if (row.asset_type === 'image') return 'image/jpeg';
  return guessMime(row.asset_url ?? '');
}
