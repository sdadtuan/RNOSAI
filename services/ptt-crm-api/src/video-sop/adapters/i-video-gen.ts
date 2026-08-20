import { KlingVideoGen } from './kling.video';
import { RunwayVideoGen } from './runway.video';

export type VdVideoProvider = 'kling' | 'runway';

export type VdVideoGenInput = {
  imageUrl: string;
  prompt: string;
  durationSec: number;
  providerHint?: VdVideoProvider;
};

export type VdVideoGenResult = {
  buffer: Buffer;
  provider: VdVideoProvider;
  providerId: string;
};

export type VdVideoGenEnv = {
  PTT_VD_KLING_API_KEY: string;
  PTT_VD_RUNWAY_API_KEY: string;
};

export interface IVideoGen {
  readonly providerName: VdVideoProvider;
  enqueue(input: VdVideoGenInput): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<'running' | VdVideoGenResult>;
}

export function selectVideoGen(env: VdVideoGenEnv, hint?: VdVideoProvider): IVideoGen {
  const klingKey = (env.PTT_VD_KLING_API_KEY ?? '').trim();
  const runwayKey = (env.PTT_VD_RUNWAY_API_KEY ?? '').trim();

  if (hint === 'runway' && runwayKey) {
    return new RunwayVideoGen(runwayKey);
  }
  if (hint === 'kling' && klingKey) {
    return new KlingVideoGen(klingKey);
  }
  if (klingKey) return new KlingVideoGen(klingKey);
  if (runwayKey) return new RunwayVideoGen(runwayKey);
  return new KlingVideoGen('');
}

export function videoQueueForProvider(provider: VdVideoProvider): 'q.video.kling' | 'q.video.runway' {
  return provider === 'runway' ? 'q.video.runway' : 'q.video.kling';
}
