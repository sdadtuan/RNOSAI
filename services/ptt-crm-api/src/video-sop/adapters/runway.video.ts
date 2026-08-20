import { createHash } from 'crypto';
import type { IVideoGen, VdVideoGenInput, VdVideoGenResult } from './i-video-gen';

function stubMp4Buffer(seed: string): Buffer {
  return Buffer.from(`vd-s6-runway-stub:${seed}`, 'utf8');
}

export class RunwayVideoGen implements IVideoGen {
  readonly providerName = 'runway' as const;

  constructor(private readonly apiKey: string) {}

  async enqueue(input: VdVideoGenInput): Promise<{ providerJobId: string }> {
    if (!this.apiKey.trim()) {
      throw Object.assign(new Error('auth'), { error_class: 'auth' });
    }
    const id = createHash('sha256')
      .update(`${input.imageUrl}:${input.prompt}:${input.durationSec}:runway`)
      .digest('hex')
      .slice(0, 16);
    return { providerJobId: `runway-${id}` };
  }

  async poll(providerJobId: string): Promise<'running' | VdVideoGenResult> {
    if (!this.apiKey.trim()) {
      throw Object.assign(new Error('auth'), { error_class: 'auth' });
    }
    return {
      buffer: stubMp4Buffer(providerJobId),
      provider: 'runway',
      providerId: providerJobId,
    };
  }
}
