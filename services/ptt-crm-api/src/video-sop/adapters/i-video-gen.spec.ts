import {
  selectVideoGen,
  videoQueueForProvider,
  type VdVideoGenEnv,
} from './i-video-gen';

describe('selectVideoGen', () => {
  const env: VdVideoGenEnv = {
    PTT_VD_KLING_API_KEY: 'kling-key',
    PTT_VD_RUNWAY_API_KEY: 'runway-key',
  };

  it('selects runway queue when hint is runway', () => {
    const gen = selectVideoGen(env, 'runway');
    expect(gen.providerName).toBe('runway');
    expect(videoQueueForProvider(gen.providerName)).toBe('q.video.runway');
  });

  it('selects kling when hint is kling', () => {
    const gen = selectVideoGen(env, 'kling');
    expect(gen.providerName).toBe('kling');
    expect(videoQueueForProvider(gen.providerName)).toBe('q.video.kling');
  });

  it('prefers kling when no hint and both keys set', () => {
    expect(selectVideoGen(env).providerName).toBe('kling');
  });

  it('falls back to runway when only runway key set', () => {
    const onlyRunway: VdVideoGenEnv = {
      PTT_VD_KLING_API_KEY: '',
      PTT_VD_RUNWAY_API_KEY: 'runway-key',
    };
    expect(selectVideoGen(onlyRunway).providerName).toBe('runway');
  });
});
