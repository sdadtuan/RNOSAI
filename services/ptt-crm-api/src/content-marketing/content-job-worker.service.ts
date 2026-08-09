import { Injectable, Logger } from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { AppConfigService } from '../config/app-config.service';
import { ContentBrandContextService } from './content-brand-context.service';
import {
  buildDraftStub,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildVariantsStub,
  buildVariantsSystemPrompt,
  buildVariantsUserPrompt,
  buildRepurposeStub,
  buildRepurposeSystemPrompt,
  buildRepurposeUserPrompt,
  hashPrompt,
  normalizeDraftOutput,
  normalizeRepurposeOutput,
  normalizeVariantsOutput,
  resolvePromptProfile,
  type CmktGenerateInput,
} from './content-marketing-prompt.util';
import {
  computeVisualQaScore,
  mergeMediaJson,
  parseCarouselSlideTexts,
  resolveAspectRatio,
} from './content-media.util';
import { ContentMediaImageProvider } from './content-media-image.provider';
import { ContentMarketingRepository } from './content-marketing.repository';
import type { CmktBodyJson, CmktJobRow, CmktMediaAsset } from './content-marketing.types';

@Injectable()
export class ContentJobWorkerService {
  private readonly logger = new Logger(ContentJobWorkerService.name);
  private readonly inFlight = new Set<number>();

  constructor(
    private readonly config: AppConfigService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly llm: AiLlmClient,
    private readonly agentRuns: AiAgentRunsRepository,
    private readonly repo: ContentMarketingRepository,
    private readonly brandContext: ContentBrandContextService,
    private readonly mediaImages: ContentMediaImageProvider,
  ) {}

  get modelName(): string {
    return this.config.mktAiModel || this.aiConfig.llmModel || 'gpt-4o-mini';
  }

  async processJob(jobId: number): Promise<CmktJobRow | null> {
    if (this.inFlight.has(jobId)) return null;
    this.inFlight.add(jobId);
    const started = Date.now();
    try {
      const claimed = await this.repo.claimContentJob(jobId);
      if (!claimed) return null;

      const item =
        claimed.item_id != null
          ? await this.repo.getItemById(claimed.lifecycle_id, claimed.item_id)
          : null;
      if (!item) {
        return this.repo.finishContentJob(jobId, {
          status: 'failed',
          error_text: 'item_not_found',
        });
      }

      if (
        claimed.job_type === 'image_generate' ||
        claimed.job_type === 'carousel_slides_generate' ||
        claimed.job_type === 'visual_qa_score'
      ) {
        return this.processMediaJob(jobId, claimed, item, started);
      }

      const brand = await this.brandContext.resolveForLifecycle(claimed.lifecycle_id);
      const genInput = (claimed.input_json ?? {}) as CmktGenerateInput;
      const profile = resolvePromptProfile(item.channel, item.format);

      let systemPrompt: string;
      let userPrompt: string;
      let stubJson: () => Record<string, unknown>;
      let useCase: string;

      if (claimed.job_type === 'draft_generate') {
        systemPrompt = buildDraftSystemPrompt(profile);
        userPrompt = buildDraftUserPrompt(item, brand, genInput);
        stubJson = () => buildDraftStub(item, brand, genInput);
        useCase = 'cmkt_draft_generate';
      } else if (claimed.job_type === 'variant_generate') {
        systemPrompt = buildVariantsSystemPrompt(profile);
        userPrompt = buildVariantsUserPrompt(item, brand, genInput);
        stubJson = () => buildVariantsStub(item, genInput);
        useCase = 'cmkt_variant_generate';
      } else if (claimed.job_type === 'repurpose') {
        const sourceId = Number(claimed.input_json?.source_item_id ?? 0);
        const source =
          sourceId > 0 ? await this.repo.getItemById(claimed.lifecycle_id, sourceId) : null;
        if (!source) {
          return this.repo.finishContentJob(jobId, {
            status: 'failed',
            error_text: 'repurpose_source_not_found',
          });
        }
        const targetProfile = String(
          claimed.input_json?.prompt_profile ?? resolvePromptProfile(item.channel, item.format),
        ) as ReturnType<typeof resolvePromptProfile>;
        systemPrompt = buildRepurposeSystemPrompt(targetProfile);
        userPrompt = buildRepurposeUserPrompt(
          source,
          { channel: item.channel, format: item.format, title: item.title },
          brand,
          claimed.input_json?.optimize_hooks !== false,
        );
        stubJson = () =>
          buildRepurposeStub(source, { channel: item.channel, format: item.format, title: item.title });
        useCase = 'cmkt_repurpose';
      } else {
        return this.repo.finishContentJob(jobId, {
          status: 'failed',
          error_text: `unsupported_job_type:${claimed.job_type}`,
        });
      }

      const promptHash = hashPrompt(systemPrompt, userPrompt);
      let aiRunId: string | null = null;

      try {
        const { parsed, tokenUsage, modelName, stubMode } = await this.llm.completeJson({
          systemPrompt,
          userContent: userPrompt,
          model: this.modelName,
          stubJson,
        });

        if (await this.agentRuns.tableReady()) {
          const run = await this.agentRuns.insertRun({
            agentName: 'content_marketing',
            useCase,
            modelName,
            promptHash,
            inputJson: {
              lifecycle_id: claimed.lifecycle_id,
              item_id: item.id,
              job_id: jobId,
              profile,
              stub_mode: stubMode,
            },
            outputJson: parsed,
            status: 'succeeded',
            latencyMs: Date.now() - started,
            tokenUsage,
            actorId: claimed.created_by,
          });
          aiRunId = run.id;
        }

        if (claimed.job_type === 'draft_generate') {
          const draft = normalizeDraftOutput(parsed, stubJson());
          const bodyJson: CmktBodyJson = {
            markdown: draft.markdown,
            html: item.body_json?.html ?? '',
            variants: item.body_json?.variants ?? [],
          };
          await this.repo.patchItem(claimed.lifecycle_id, item.id, { body_json: bodyJson });
          const versionNo = await this.repo.insertItemVersion(
            item.id,
            bodyJson,
            claimed.created_by,
            'ai_generate',
            aiRunId,
          );
          return this.repo.finishContentJob(jobId, {
            status: 'succeeded',
            output_json: { body_json: bodyJson, version_no: versionNo, profile, stub_mode: !this.aiConfig.llmApiKey },
            ai_run_id: aiRunId,
          });
        }

        if (claimed.job_type === 'repurpose') {
          const repurpose = normalizeRepurposeOutput(parsed, stubJson());
          const bodyJson: CmktBodyJson = {
            markdown: repurpose.markdown,
            html: item.body_json?.html ?? '',
            variants: item.body_json?.variants ?? [],
          };
          await this.repo.patchItem(claimed.lifecycle_id, item.id, { body_json: bodyJson });
          const versionNo = await this.repo.insertItemVersion(
            item.id,
            bodyJson,
            claimed.created_by,
            'repurpose',
            aiRunId,
          );
          return this.repo.finishContentJob(jobId, {
            status: 'succeeded',
            output_json: { body_json: bodyJson, version_no: versionNo, stub_mode: !this.aiConfig.llmApiKey },
            ai_run_id: aiRunId,
          });
        }

        const minCount = Math.min(Math.max(Number(genInput.variant_count ?? 3), 3), 5);
        const variants = normalizeVariantsOutput(parsed, stubJson(), minCount);
        const bodyJson: CmktBodyJson = {
          markdown: item.body_json?.markdown ?? '',
          html: item.body_json?.html ?? '',
          variants,
        };
        await this.repo.patchItem(claimed.lifecycle_id, item.id, { body_json: bodyJson });
        const versionNo = await this.repo.insertItemVersion(
          item.id,
          bodyJson,
          claimed.created_by,
          'ai_generate',
          aiRunId,
        );
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: {
            variants,
            variant_count: variants.length,
            version_no: versionNo,
            profile,
            stub_mode: !this.aiConfig.llmApiKey,
          },
          ai_run_id: aiRunId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`cmkt job ${jobId} AI failed: ${message}`);
        if (await this.agentRuns.tableReady()) {
          try {
            const run = await this.agentRuns.insertRun({
              agentName: 'content_marketing',
              useCase,
              modelName: this.modelName,
              promptHash,
              inputJson: { job_id: jobId, item_id: item.id },
              outputJson: {},
              status: 'failed',
              latencyMs: Date.now() - started,
              errorMessage: message,
              actorId: claimed.created_by,
            });
            aiRunId = run.id;
          } catch {
            /* ignore audit failure */
          }
        }
        return this.repo.finishContentJob(jobId, {
          status: 'failed',
          error_text: message,
          ai_run_id: aiRunId,
        });
      }
    } finally {
      this.inFlight.delete(jobId);
    }
  }

  private async processMediaJob(
    jobId: number,
    claimed: CmktJobRow,
    item: NonNullable<Awaited<ReturnType<ContentMarketingRepository['getItemById']>>>,
    started: number,
  ): Promise<CmktJobRow | null> {
    const input = claimed.input_json ?? {};
    const aspectRatio = resolveAspectRatio(input.aspect_ratio, item.channel, item.format);
    const stylePreset = String(input.style_preset ?? 'corporate');
    const draftWatermark = input.allow_draft_watermark === true || item.status === 'draft';
    const approvedCopy = String(item.body_json?.markdown ?? item.title).trim();

    try {
      if (claimed.job_type === 'visual_qa_score') {
        const assets = [
          ...(item.media_json?.ai_assets ?? []),
          ...(item.media_json?.carousel_slides ?? []),
        ];
        const qa = computeVisualQaScore(assets);
        const media = mergeMediaJson(item.media_json, { visual_qa: qa });
        await this.repo.patchItem(claimed.lifecycle_id, item.id, {
          media_json: media,
          visual_status: item.visual_status === 'ai_pending' ? 'ai_ready' : item.visual_status,
        });
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: { visual_qa: qa },
        });
      }

      let assets: CmktMediaAsset[] = [];
      if (claimed.job_type === 'carousel_slides_generate') {
        const slides = parseCarouselSlideTexts(approvedCopy);
        assets = await this.mediaImages.generateImages({
          variantCount: slides.length,
          aspectRatio,
          stylePreset,
          title: item.title,
          approvedCopy,
          draftWatermark,
          slideTexts: slides,
          assetType: 'carousel_slide',
        });
        const media = mergeMediaJson(item.media_json, {
          carousel_slides: assets,
          ai_assets: assets,
          aspect_ratio: aspectRatio,
          style_preset: stylePreset,
          provider: this.mediaImages.providerName,
          prompt_hash: assets[0]?.prompt_hash,
        });
        const qa = computeVisualQaScore(assets);
        media.visual_qa = qa;
        await this.repo.patchItem(claimed.lifecycle_id, item.id, {
          media_json: media,
          visual_status: 'ai_ready',
        });
        return this.repo.finishContentJob(jobId, {
          status: 'succeeded',
          output_json: {
            carousel_slides: assets,
            visual_qa: qa,
            latency_ms: Date.now() - started,
          },
        });
      }

      const variantCount = Math.min(Math.max(Number(input.variant_count ?? 3), 1), 5);
      assets = await this.mediaImages.generateImages({
        variantCount,
        aspectRatio,
        stylePreset,
        title: item.title,
        approvedCopy,
        draftWatermark,
        assetType: 'image',
      });
      const media = mergeMediaJson(item.media_json, {
        ai_assets: assets,
        aspect_ratio: aspectRatio,
        style_preset: stylePreset,
        provider: this.mediaImages.providerName,
        prompt_hash: assets[0]?.prompt_hash,
        selected_asset_id: assets.find((a) => a.selected)?.id ?? assets[0]?.id ?? null,
      });
      const qa = computeVisualQaScore(assets);
      media.visual_qa = qa;
      await this.repo.patchItem(claimed.lifecycle_id, item.id, {
        media_json: media,
        visual_status: 'ai_ready',
      });
      return this.repo.finishContentJob(jobId, {
        status: 'succeeded',
        output_json: {
          ai_assets: assets,
          visual_qa: qa,
          latency_ms: Date.now() - started,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.patchItem(claimed.lifecycle_id, item.id, { visual_status: 'rejected' });
      return this.repo.finishContentJob(jobId, { status: 'failed', error_text: message });
    }
  }
}
