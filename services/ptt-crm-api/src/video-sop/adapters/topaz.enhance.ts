import { createHash } from 'crypto';
import type { IEnhance, VdEnhanceResult } from './i-enhance';

export class TopazEnhance implements IEnhance {
  readonly providerName = 'topaz' as const;

  constructor(private readonly apiKey: string) {}

  async enhance(inputPath: string): Promise<VdEnhanceResult> {
    if (!this.apiKey.trim()) {
      throw Object.assign(new Error('auth'), { error_class: 'auth' });
    }
    const providerId = createHash('sha256').update(inputPath).digest('hex').slice(0, 12);
    return {
      buffer: Buffer.from(`vd-s8-topaz-stub:${providerId}`, 'utf8'),
      provider: 'topaz',
      providerId: `topaz-${providerId}`,
    };
  }
}
