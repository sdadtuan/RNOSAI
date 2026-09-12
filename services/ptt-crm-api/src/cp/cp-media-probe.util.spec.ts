import { spawnSync } from 'child_process';
import {
  hasFullTechnicalFacts,
  isProbeableOutputUri,
  mapFfprobeOutput,
  probeIngestBytes,
  probeMediaFile,
  resolveProbePath,
} from './cp-media-probe.util';

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}));

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const existsSync = jest.requireMock('fs').existsSync as jest.Mock;
const mockedSpawn = spawnSync as jest.MockedFunction<typeof spawnSync>;

function spawnResult(
  overrides: Partial<ReturnType<typeof spawnSync>>,
): ReturnType<typeof spawnSync> {
  return {
    pid: 1,
    output: ['', '', ''],
    signal: null,
    status: 0,
    stdout: '',
    stderr: '',
    error: undefined,
    ...overrides,
  } as ReturnType<typeof spawnSync>;
}

describe('cp-media-probe.util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existsSync.mockReturnValue(true);
  });

  it('detects probeable output URIs', () => {
    expect(isProbeableOutputUri('file:///tmp/demo.mp4')).toBe(true);
    expect(isProbeableOutputUri('/var/media/demo.mp4')).toBe(true);
    expect(isProbeableOutputUri('stub://renders/job-1')).toBe(true);
    expect(isProbeableOutputUri('http://127.0.0.1/stub/demo.mp4')).toBe(true);
    expect(isProbeableOutputUri('s3://bucket/key.mp4')).toBe(false);
  });

  it('resolves file and absolute paths', () => {
    expect(resolveProbePath('file:///tmp/demo.mp4')).toBe('/tmp/demo.mp4');
    expect(resolveProbePath('/tmp/demo.mp4')).toBe('/tmp/demo.mp4');
    expect(resolveProbePath('stub://renders/job-1')).toBeNull();
    expect(resolveProbePath('http://127.0.0.1/stub/demo.mp4')).toBe(
      'http://127.0.0.1/stub/demo.mp4',
    );
  });

  it('maps ffprobe JSON into QcFacts shape', () => {
    expect(
      mapFfprobeOutput({
        streams: [
          { codec_type: 'video', width: 1920, height: 1080, duration: '29.97' },
          { codec_type: 'audio' },
        ],
        format: { duration: '30.0' },
      }),
    ).toEqual({
      width: 1920,
      height: 1080,
      duration_sec: 30,
      has_audio: true,
    });
  });

  it('returns null when ffprobe output has no video stream', () => {
    expect(mapFfprobeOutput({ streams: [{ codec_type: 'audio' }] })).toBeNull();
  });

  it('returns null when the local file is missing', () => {
    existsSync.mockReturnValue(false);
    expect(probeMediaFile('/missing/demo.mp4')).toBeNull();
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('returns null when ffprobe fails', () => {
    mockedSpawn.mockReturnValue(spawnResult({ status: 1, stderr: 'fail' }));
    expect(probeMediaFile('/tmp/demo.mp4')).toBeNull();
  });

  it('returns mapped facts when ffprobe succeeds', () => {
    mockedSpawn.mockReturnValue(spawnResult({
      stdout: JSON.stringify({
        streams: [
          { codec_type: 'video', width: 1080, height: 1920 },
          { codec_type: 'audio' },
        ],
        format: { duration: '15.5' },
      }),
    }));

    expect(probeMediaFile('/tmp/demo.mp4')).toEqual({
      width: 1080,
      height: 1920,
      duration_sec: 15.5,
      has_audio: true,
    });
  });

  it('probes ingest bytes with null width and duration when facts are missing — never 0', async () => {
    const facts = await probeIngestBytes(Buffer.from('not-a-media-file'), 'application/octet-stream');
    expect(facts.width).toBeNull();
    expect(facts.height).toBeNull();
    expect(facts.duration_sec).toBeNull();
    expect(facts).not.toEqual(expect.objectContaining({ width: 0, duration_sec: 0 }));
  });

  it('tracks whether technical facts are complete', () => {
    expect(hasFullTechnicalFacts({ width: 1920, height: 1080, duration_sec: 30 })).toBe(true);
    expect(hasFullTechnicalFacts({ width: 1920, height: 1080 })).toBe(false);
  });
});
