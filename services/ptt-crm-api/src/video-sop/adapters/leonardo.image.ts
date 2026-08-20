import type { IImageGen, VdImageGenInput, VdImageGenResult } from './i-image-gen';

const LEONARDO_API = 'https://cloud.leonardo.ai/api/rest/v1';

export class LeonardoImageGen implements IImageGen {
  readonly providerName = 'leonardo' as const;

  constructor(private readonly apiKey: string) {}

  async generate(input: VdImageGenInput): Promise<VdImageGenResult> {
    const seed = Number.isFinite(input.seed) ? Number(input.seed) : 0;
    const generationId = await this.createGeneration(input, seed);
    const url = await this.pollImageUrl(generationId);
    const buffer = await downloadBuffer(url);
    return { buffer, provider: 'leonardo', providerId: generationId, seed };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }

  private async createGeneration(input: VdImageGenInput, seed: number): Promise<string> {
    const res = await fetch(`${LEONARDO_API}/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        prompt: input.prompt,
        width: input.width,
        height: input.height,
        num_images: 1,
        seed,
        ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {}),
      }),
    });
    const body = (await res.json()) as {
      sdGenerationJob?: { generationId?: string };
      error?: string;
    };
    if (res.status === 401 || res.status === 403) throw new Error('auth');
    if (!res.ok) throw Object.assign(new Error(body.error ?? `leonardo_create_failed:${res.status}`), { error_class: 'provider' });
    const id = body.sdGenerationJob?.generationId;
    if (!id) throw Object.assign(new Error('leonardo_missing_generation_id'), { error_class: 'provider' });
    return id;
  }

  private async pollImageUrl(generationId: string): Promise<string> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await fetch(`${LEONARDO_API}/generations/${generationId}`, { headers: this.headers() });
      const body = (await res.json()) as {
        generations_by_pk?: {
          status?: string;
          generated_images?: Array<{ url?: string }>;
        };
        error?: string;
      };
      if (res.status === 401 || res.status === 403) throw new Error('auth');
      if (!res.ok) throw Object.assign(new Error(body.error ?? `leonardo_poll_failed:${res.status}`), { error_class: 'provider' });
      const row = body.generations_by_pk;
      if (row?.status === 'COMPLETE') {
        const url = row.generated_images?.[0]?.url;
        if (!url) throw Object.assign(new Error('leonardo_missing_image_url'), { error_class: 'provider' });
        return url;
      }
      if (row?.status === 'FAILED') {
        throw Object.assign(new Error('leonardo_generation_failed'), { error_class: 'provider' });
      }
      await sleep(1500);
    }
    throw Object.assign(new Error('leonardo_timeout'), { error_class: 'transient' });
  }
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`leonardo_download_failed:${res.status}`), { error_class: 'provider' });
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
