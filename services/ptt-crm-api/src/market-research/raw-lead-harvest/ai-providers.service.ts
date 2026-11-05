import { Injectable } from '@nestjs/common';
import { ResearchAiProvidersRepository } from './ai-providers.repository';
import type {
  CreateResearchAiCredentialBody,
  CreateResearchAiModelBody,
  CreateResearchAiProviderBody,
  PatchResearchAiCredentialBody,
  PatchResearchAiModelBody,
  PatchResearchAiProviderBody,
} from './ai-providers.types';

@Injectable()
export class ResearchAiProvidersService {
  constructor(private readonly repo: ResearchAiProvidersRepository) {}

  listProviders() {
    return this.repo.listProviders();
  }

  getProvider(id: number) {
    return this.repo.getProvider(id);
  }

  createProvider(body: CreateResearchAiProviderBody) {
    return this.repo.createProvider(body);
  }

  patchProvider(id: number, body: PatchResearchAiProviderBody) {
    return this.repo.patchProvider(id, body);
  }

  deleteProvider(id: number) {
    return this.repo.deleteProvider(id);
  }

  listModels(providerId: number) {
    return this.repo.listModels(providerId);
  }

  createModel(providerId: number, body: CreateResearchAiModelBody) {
    return this.repo.createModel(providerId, body);
  }

  patchModel(modelId: number, body: PatchResearchAiModelBody) {
    return this.repo.patchModel(modelId, body);
  }

  deleteModel(modelId: number) {
    return this.repo.deleteModel(modelId);
  }

  listCredentials(providerId: number) {
    return this.repo.listCredentials(providerId);
  }

  createCredential(
    providerId: number,
    body: CreateResearchAiCredentialBody,
    staffId: number | null,
  ) {
    return this.repo.createCredential(providerId, body, staffId);
  }

  patchCredential(
    credId: number,
    body: PatchResearchAiCredentialBody,
    staffId: number | null,
  ) {
    return this.repo.patchCredential(credId, body, staffId);
  }

  deleteCredential(credId: number, staffId: number | null) {
    return this.repo.deleteCredential(credId, staffId);
  }

  listHarvestProviders() {
    return this.repo.listHarvestProviders();
  }

  async testProvider(
    providerId: number,
    modelId?: string,
  ): Promise<{ ok: boolean; latency_ms?: number; error?: string }> {
    const provider = await this.repo.getProvider(providerId);
    const runtime = await this.repo.resolveRuntimeCredential(provider.code);
    if (!runtime) {
      return { ok: false, error: 'provider_not_configured' };
    }
    const models = await this.repo.listModels(providerId);
    const model =
      (modelId && models.find((m) => m.model_id === modelId)?.model_id) ||
      models.find((m) => m.is_default && m.enabled)?.model_id ||
      models.find((m) => m.enabled)?.model_id;
    if (!model) return { ok: false, error: 'no_enabled_model' };

    const started = Date.now();
    const url = `${runtime.provider.base_url.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (runtime.authType === 'bearer_api_key') {
      headers[runtime.authHeaderName || 'Authorization'] = `Bearer ${runtime.apiToken}`;
    } else {
      headers[runtime.authHeaderName || 'x-api-key'] = runtime.apiToken;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latency_ms = Date.now() - started;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ok: false,
          latency_ms,
          error: `http_${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`,
        };
      }
      return { ok: true, latency_ms };
    } catch (err) {
      return {
        ok: false,
        latency_ms: Date.now() - started,
        error: err instanceof Error ? err.message : 'test_failed',
      };
    }
  }
}
