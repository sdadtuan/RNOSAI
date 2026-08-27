import { BadRequestException, Injectable } from '@nestjs/common';
import { B2bIngestService } from '../b2b-projects/b2b-ingest.service';
import { B2bProjectsService } from '../b2b-projects/b2b-projects.service';
import { JobQueueRepository } from './job-queue.repository';
import {
  fetchFacebookLeadFromGraph,
  legacyRowToNormalizedLead,
  metaConfigFromEnv,
  type MetaWebhookConfig,
} from './meta-webhook.parser';
import { MetaWebhookRepository } from './meta-webhook.repository';
import type { LegacyLeadRow } from './webhook-lead.types';
import {
  clampFacebookSyncLimit,
  classifyFetchedLead,
  facebookFormLeadsUrl,
  parseFacebookFormLeadsPage,
  selectActiveFormsToSync,
} from './meta-lead-sync.util';

export type MetaLeadSyncGraph = {
  listFormLeadIds: (
    formId: string,
    token: string,
    version: string,
    limit: number,
  ) => Promise<{ ids: string[]; errorMessage?: string }>;
  fetchLead: (leadgenId: string, config: MetaWebhookConfig) => Promise<LegacyLeadRow>;
};

export type MetaLeadSyncResult = {
  ok: true;
  project_id: string;
  scanned: number;
  enqueued: number;
  created: number;
  already_queued: number;
  skipped_empty: number;
  graph_errors: number;
  unmatched: number;
  form_ids: string[];
  message: string;
};

async function defaultListFormLeadIds(
  formId: string,
  token: string,
  version: string,
  limit: number,
): Promise<{ ids: string[]; errorMessage?: string }> {
  const ids: string[] = [];
  let url: string | null = facebookFormLeadsUrl(formId, token, version, Math.min(limit, 50));
  while (url && ids.length < limit) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const payload = (await res.json().catch(() => ({}))) as unknown;
    const page = parseFacebookFormLeadsPage(payload);
    if (page.errorMessage) {
      return { ids, errorMessage: page.errorMessage };
    }
    for (const id of page.ids) {
      if (ids.length >= limit) break;
      ids.push(id);
    }
    url = page.nextUrl;
  }
  return { ids };
}

export const defaultMetaLeadSyncGraph: MetaLeadSyncGraph = {
  listFormLeadIds: defaultListFormLeadIds,
  fetchLead: fetchFacebookLeadFromGraph,
};

@Injectable()
export class MetaLeadSyncService {
  graph: MetaLeadSyncGraph = defaultMetaLeadSyncGraph;

  constructor(
    private readonly projects: B2bProjectsService,
    private readonly metaRepo: MetaWebhookRepository,
    private readonly b2bIngest: B2bIngestService,
    private readonly jobQueue: JobQueueRepository,
  ) {}

  async syncProject(
    projectId: string,
    opts: { form_id?: string; limit?: number } = {},
  ): Promise<MetaLeadSyncResult> {
    const project = await this.projects.get(projectId);
    const pages = await this.projects.listPages(projectId);
    const targets = selectActiveFormsToSync(pages, opts.form_id);
    if (!targets.length) {
      throw new BadRequestException({
        error: 'no_active_forms',
        message: 'Dự án chưa có Form Facebook active để đồng bộ.',
      });
    }

    const token = await this.metaRepo.resolvePageAccessToken(
      null,
      targets.map((t) => t.pageId),
    );
    if (!token) {
      throw new BadRequestException({
        error: 'missing_page_token',
        message: 'Thiếu Page Access Token (tab Kênh hoặc CRM_FACEBOOK_PAGE_ACCESS_TOKEN).',
      });
    }

    const config = { ...metaConfigFromEnv(), pageAccessToken: token };
    const limit = clampFacebookSyncLimit(opts.limit);
    const remainingPerForm = Math.max(1, Math.ceil(limit / targets.length));

    let scanned = 0;
    let skippedEmpty = 0;
    let graphErrors = 0;
    const readyRows: Array<{ row: LegacyLeadRow; formId: string; pageId: string }> = [];
    const formErrors: string[] = [];

    for (const target of targets) {
      const listed = await this.graph.listFormLeadIds(
        target.formId,
        token,
        config.graphApiVersion,
        remainingPerForm,
      );
      if (listed.errorMessage) {
        formErrors.push(`${target.formId}: ${listed.errorMessage}`);
        graphErrors += 1;
        continue;
      }
      for (const leadgenId of listed.ids) {
        if (scanned >= limit) break;
        scanned += 1;
        const fetched = await this.graph.fetchLead(leadgenId, config);
        const row: LegacyLeadRow = {
          ...fetched,
          source: 'facebook',
          meta: {
            ...(fetched.meta ?? {}),
            facebook_leadgen_id: leadgenId,
            facebook_form_id: target.formId,
            facebook_page_id: target.pageId,
            sync: 'manual',
          },
        };
        const kind = classifyFetchedLead(row);
        if (kind === 'graph_error') {
          graphErrors += 1;
          continue;
        }
        if (kind === 'empty_contact') {
          skippedEmpty += 1;
          continue;
        }
        readyRows.push({ row, formId: target.formId, pageId: target.pageId });
      }
    }

    const leads = readyRows.map(({ row }) => legacyRowToNormalizedLead(row, 'unknown'));
    const prepared = await this.b2bIngest.prepareWebhookLeads({
      channel: 'meta',
      projectSlug: project.code,
      leads,
    });
    let enqueue: { mode: 'queue' | 'none'; jobs: Array<{ created: boolean }> } = {
      mode: 'none',
      jobs: [],
    };
    if (prepared.toEnqueue.length) {
      try {
        enqueue = await this.jobQueue.enqueueIngestLeads(prepared.toEnqueue, {
          channel: 'meta',
          correlationId: `fb-sync:${project.id}:${Date.now()}`,
        });
      } catch (err) {
        throw new BadRequestException({
          error: 'queue_disabled',
          message: err instanceof Error ? err.message : 'Không ghi được hàng đợi ingest.',
        });
      }
    }

    const created = enqueue.jobs.filter((j) => j.created).length;
    const alreadyQueued = enqueue.jobs.filter((j) => !j.created).length;
    const message = [
      `Đã quét ${scanned} lead trên Meta.`,
      `${created} mới vào hàng đợi`,
      `${alreadyQueued} đã có`,
      `${skippedEmpty} thiếu SĐT/email`,
      prepared.unmatchedCount ? `${prepared.unmatchedCount} chưa map` : '',
      graphErrors ? `${graphErrors} lỗi Graph` : '',
      formErrors.length ? formErrors[0] : '',
    ]
      .filter(Boolean)
      .join(' — ');

    return {
      ok: true,
      project_id: project.id,
      scanned,
      enqueued: enqueue.jobs.length,
      created,
      already_queued: alreadyQueued,
      skipped_empty: skippedEmpty,
      graph_errors: graphErrors,
      unmatched: prepared.unmatchedCount,
      form_ids: targets.map((t) => t.formId),
      message,
    };
  }
}
