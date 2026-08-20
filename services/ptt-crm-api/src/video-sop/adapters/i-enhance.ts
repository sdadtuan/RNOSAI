import { TopazEnhance } from './topaz.enhance';

export type VdEnhanceResult = {
  buffer: Buffer;
  provider: 'topaz';
  providerId: string;
  skipped?: boolean;
};

export interface IEnhance {
  readonly providerName: 'topaz';
  enhance(inputPath: string): Promise<VdEnhanceResult>;
}

export function selectEnhance(): IEnhance {
  const key = (process.env.PTT_VD_TOPAZ_API_KEY ?? '').trim();
  return new TopazEnhance(key);
}
