import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { loadOpsRouteMap, resolveOpsRouteMapPath } from '../ops/ops-route-map.loader';
import { classifyCorpus } from './mkt-ai-playbook-corpus.util';
import { MktAiPlaybookLearnService } from './mkt-ai-playbook-learn.service';
import {
  MktAiPlaybookVersionsRepository,
  type MktAiPlaybookVersionRow,
} from './mkt-ai-playbook-versions.repository';
import {
  MktAiServicePolicyRepository,
  type MktAiServicePolicyPatch,
  type MktAiServicePolicyRow,
} from './mkt-ai-service-policy.repository';
import { listPlaybookCatalog, resolvePlaybookForSlug } from './marketing-ai-playbook.util';

export type MktAiPlaybookAdminListItem = {
  service_slug: string;
  label_vi: string;
  policy: MktAiServicePolicyRow | null;
  active_version: MktAiPlaybookVersionRow | null;
  corpus: {
    candidate_count: number;
    winner_count: number;
    can_learn: boolean;
    remaining: number;
    depth: 'shallow' | 'deep';
  };
};

export type ActivateVersionBody = {
  self_approve?: boolean;
  note?: string;
  accept_shallow?: boolean;
};

export type DecideVersionBody = {
  decision: 'approve' | 'request_changes';
  note?: string;
};

@Injectable()
export class MktAiPlaybookAdminService {
  constructor(
    private readonly config: AppConfigService,
    private readonly policyRepo: MktAiServicePolicyRepository,
    private readonly versionsRepo: MktAiPlaybookVersionsRepository,
    private readonly learnService: MktAiPlaybookLearnService,
  ) {}

  private slugLabelMap(): Map<string, string> {
    const labels = new Map<string, string>();
    try {
      const mapPath = resolveOpsRouteMapPath(this.config.opsRouteMapPath);
      const routeMap = loadOpsRouteMap(mapPath);
      for (const svc of routeMap.services) {
        labels.set(svc.service_slugs.primary, svc.name_vi ?? svc.service_slugs.primary);
      }
    } catch {
      /* route-map optional in tests */
    }
    for (const pb of listPlaybookCatalog()) {
      if (!labels.has(pb.slug)) labels.set(pb.slug, pb.label_vi);
    }
    return labels;
  }

  private labelForSlug(slug: string): string {
    return this.slugLabelMap().get(slug) ?? slug;
  }

  private async buildCorpusSummary(serviceSlug: string) {
    const rows = await this.learnService.loadCorpusRows(serviceSlug, []);
    const corpus = classifyCorpus(serviceSlug, rows);
    return {
      candidate_count: corpus.candidates.length,
      winner_count: corpus.winners.length,
      can_learn: corpus.canLearn,
      remaining: corpus.remaining,
      depth: corpus.depth,
      rows: corpus.candidates.map((row) => ({
        lifecycle_id: row.lifecycleId,
        quality_score: row.qualityScore,
        stage: row.stage,
        closed_loop_win: row.closedLoopWin,
        has_tier3_artifact: row.hasTier3Artifact,
      })),
    };
  }

  async listCatalog(): Promise<{ ok: true; items: MktAiPlaybookAdminListItem[] }> {
    const labels = this.slugLabelMap();
    const policies = await this.policyRepo.listPolicyRows();
    const policyBySlug = new Map(policies.map((p) => [p.service_slug, p]));
    const slugs = new Set<string>([...labels.keys(), ...policyBySlug.keys()]);

    const items: MktAiPlaybookAdminListItem[] = [];
    for (const serviceSlug of [...slugs].sort()) {
      const policy = policyBySlug.get(serviceSlug) ?? null;
      let activeVersion: MktAiPlaybookVersionRow | null = null;
      if (policy?.active_version_id) {
        activeVersion = await this.versionsRepo.getVersion(policy.active_version_id);
      }
      if (!activeVersion) {
        activeVersion = await this.versionsRepo.getActiveVersion(serviceSlug);
      }
      const corpusSummary = await this.buildCorpusSummary(serviceSlug);
      items.push({
        service_slug: serviceSlug,
        label_vi: this.labelForSlug(serviceSlug),
        policy,
        active_version: activeVersion,
        corpus: {
          candidate_count: corpusSummary.candidate_count,
          winner_count: corpusSummary.winner_count,
          can_learn: corpusSummary.can_learn,
          remaining: corpusSummary.remaining,
          depth: corpusSummary.depth as 'shallow' | 'deep',
        },
      });
    }

    return { ok: true, items };
  }

  async getSlugDetail(serviceSlug: string) {
    const slug = String(serviceSlug ?? '').trim();
    if (!slug) {
      throw new NotFoundException({ error: 'playbook_slug_not_found', service_slug: slug });
    }

    const policy = await this.policyRepo.getPolicyRow(slug);
    const versions = await this.versionsRepo.listVersionsBySlug(slug);
    const activeVersion =
      (policy?.active_version_id
        ? await this.versionsRepo.getVersion(policy.active_version_id)
        : null) ?? (await this.versionsRepo.getActiveVersion(slug));
    const corpus = await this.buildCorpusSummary(slug);
    const learnJobs = await this.versionsRepo.listLearnJobsBySlug(slug);
    const fallbackPlaybook = resolvePlaybookForSlug(slug, listPlaybookCatalog());

    return {
      ok: true,
      service_slug: slug,
      label_vi: this.labelForSlug(slug),
      policy,
      active_version: activeVersion,
      versions,
      corpus,
      learn_jobs: learnJobs,
      fallback_playbook_slug: fallbackPlaybook.slug,
    };
  }

  async patchPolicy(serviceSlug: string, patch: MktAiServicePolicyPatch, actor: string) {
    const slug = String(serviceSlug ?? '').trim();
    if (!slug) {
      throw new BadRequestException({ error: 'playbook_invalid_slug', message: 'Thiếu service_slug.' });
    }
    const policy = await this.policyRepo.upsertPolicy(slug, patch, actor);
    const row = await this.policyRepo.getPolicyRow(slug);
    return { ok: true, service_slug: slug, policy: row ?? { service_slug: slug, ...policy } };
  }

  async enqueueLearn(
    serviceSlug: string,
    actor: string,
    excludeLifecycleIds: number[] = [],
  ) {
    return this.learnService.enqueueLearn(serviceSlug, actor, excludeLifecycleIds);
  }

  async getLearnJob(serviceSlug: string, jobId: number) {
    const job = await this.versionsRepo.getLearnJob(jobId);
    if (!job || job.service_slug !== serviceSlug) {
      throw new NotFoundException({ error: 'playbook_learn_job_not_found', job_id: jobId });
    }
    return { ok: true, job };
  }

  async patchVersionDocument(versionId: number, documentJson: Record<string, unknown>) {
    const existing = await this.versionsRepo.getVersion(versionId);
    if (!existing) {
      throw new NotFoundException({ error: 'playbook_version_not_found', version_id: versionId });
    }
    if (existing.status !== 'draft') {
      throw new ConflictException({
        error: 'playbook_version_not_editable',
        message: 'Chỉ sửa được bản draft.',
        status: existing.status,
      });
    }
    const updated = await this.versionsRepo.updateVersionDocument(versionId, documentJson);
    if (!updated) {
      throw new ConflictException({ error: 'playbook_version_update_failed', version_id: versionId });
    }
    return { ok: true, version: updated };
  }

  async submitVersion(versionId: number, actor: string) {
    const version = await this.requireVersion(versionId);
    if (version.status !== 'draft') {
      throw new ConflictException({
        error: 'playbook_version_invalid_transition',
        message: 'Chỉ gửi duyệt từ draft.',
        status: version.status,
      });
    }
    const updated = await this.versionsRepo.updateVersionStatus(versionId, 'pending_review');
    if (!updated) {
      throw new ConflictException({ error: 'playbook_version_submit_failed', version_id: versionId });
    }
    return { ok: true, version: updated, submitted_by: actor };
  }

  async decideVersion(versionId: number, body: DecideVersionBody, actor: string) {
    const version = await this.requireVersion(versionId);
    if (version.status !== 'pending_review') {
      throw new ConflictException({
        error: 'playbook_version_invalid_transition',
        message: 'Chỉ duyệt từ pending_review.',
        status: version.status,
      });
    }

    if (body.decision === 'approve') {
      const updated = await this.versionsRepo.updateVersionStatus(versionId, 'approved', {
        reviewedBy: actor,
        reviewedAt: new Date(),
        reviewNote: body.note?.trim() || null,
      });
      return { ok: true, version: updated };
    }

    const note = String(body.note ?? '').trim();
    if (note.length < 10) {
      throw new BadRequestException({
        error: 'playbook_review_note_required',
        message: 'Yêu cầu sửa cần ghi chú ≥10 ký tự.',
      });
    }
    const updated = await this.versionsRepo.updateVersionStatus(versionId, 'draft', {
      reviewedBy: actor,
      reviewedAt: new Date(),
      reviewNote: note,
    });
    return { ok: true, version: updated };
  }

  async activateVersion(versionId: number, body: ActivateVersionBody, actor: string) {
    const version = await this.requireVersion(versionId);
    this.assertActivateAllowed(version, body);

    const activated = await this.versionsRepo.activateVersion(
      versionId,
      version.service_slug,
      actor,
      body.note?.trim() || version.review_note,
    );
    if (!activated) {
      throw new ConflictException({ error: 'playbook_version_activate_failed', version_id: versionId });
    }
    return { ok: true, version: activated };
  }

  async rollbackVersion(versionId: number, actor: string) {
    const version = await this.requireVersion(versionId);
    if (version.status !== 'approved' && version.status !== 'retired') {
      throw new ConflictException({
        error: 'playbook_version_invalid_rollback',
        message: 'Rollback chỉ áp dụng bản approved hoặc retired.',
        status: version.status,
      });
    }

    const activated = await this.versionsRepo.activateVersion(
      versionId,
      version.service_slug,
      actor,
      `rollback by ${actor}`,
    );
    if (!activated) {
      throw new ConflictException({ error: 'playbook_version_rollback_failed', version_id: versionId });
    }
    return { ok: true, version: activated };
  }

  private async requireVersion(versionId: number): Promise<MktAiPlaybookVersionRow> {
    const version = await this.versionsRepo.getVersion(versionId);
    if (!version) {
      throw new NotFoundException({ error: 'playbook_version_not_found', version_id: versionId });
    }
    return version;
  }

  private assertActivateAllowed(
    version: MktAiPlaybookVersionRow,
    body: ActivateVersionBody,
  ): void {
    if (version.status !== 'approved') {
      throw new ConflictException({
        error: 'playbook_version_not_approved',
        message: 'Chỉ Active bản đã approved.',
        status: version.status,
      });
    }

    const reviewer = version.reviewed_by?.trim() || '';
    const creator = version.created_by.trim();
    const note = String(body.note ?? version.review_note ?? '').trim();
    const selfApprove = Boolean(body.self_approve);
    const separateReviewer = Boolean(reviewer && reviewer !== creator);

    if (!separateReviewer && !(selfApprove && note.length >= 20)) {
      throw new ForbiddenException({
        error: 'playbook_activate_review_required',
        message:
          'Active cần reviewer khác người tạo, hoặc self_approve + ghi chú ≥20 ký tự.',
      });
    }

    if (version.depth === 'shallow' && !body.accept_shallow) {
      throw new BadRequestException({
        error: 'playbook_shallow_accept_required',
        message: 'Bản shallow cần accept_shallow=true.',
      });
    }
  }
}
