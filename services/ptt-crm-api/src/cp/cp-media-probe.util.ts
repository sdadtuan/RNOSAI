import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import type { QcFacts } from './cp-qc.service';

export type ProbedMediaFacts = Pick<
  QcFacts,
  'width' | 'height' | 'duration_sec' | 'has_audio'
>;

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

export function isProbeableOutputUri(uri: string | null | undefined): boolean {
  const text = String(uri ?? '').trim();
  if (!text) return false;
  if (text.startsWith('file://')) return true;
  if (text.startsWith('/')) return true;
  if (text.startsWith('stub://') || text.startsWith('stub:')) return true;
  if (/^https?:\/\//i.test(text)) return true;
  return false;
}

export function resolveProbePath(uri: string): string | null {
  const text = String(uri ?? '').trim();
  if (!text) return null;
  if (text.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(text).pathname);
    } catch {
      return text.slice('file://'.length) || null;
    }
  }
  if (text.startsWith('/')) return text;
  if (text.startsWith('stub://') || text.startsWith('stub:')) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return null;
}

export function mapFfprobeOutput(parsed: FfprobeOutput): ProbedMediaFacts | null {
  const streams = parsed.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  if (!videoStream) return null;
  const audioStream = streams.find((stream) => stream.codec_type === 'audio');
  const durationRaw = parsed.format?.duration ?? videoStream.duration ?? '0';
  const duration = Number.parseFloat(String(durationRaw));
  const width = Number(videoStream.width ?? 0);
  const height = Number(videoStream.height ?? 0);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return {
    width,
    height,
    duration_sec: Number.isFinite(duration) && duration > 0 ? duration : null,
    has_audio: audioStream != null,
  };
}

export function probeMediaFile(
  path: string,
  ffprobeBin = 'ffprobe',
): ProbedMediaFacts | null {
  const target = String(path ?? '').trim();
  if (!target) return null;
  if (!target.startsWith('http://') && !target.startsWith('https://') && !existsSync(target)) {
    return null;
  }

  const result = spawnSync(
    ffprobeBin,
    [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      target,
    ],
    { encoding: 'utf8' },
  );

  if (result.error || result.status !== 0) return null;

  try {
    const parsed = JSON.parse(String(result.stdout ?? '')) as FfprobeOutput;
    return mapFfprobeOutput(parsed);
  } catch {
    return null;
  }
}

export function probeOutputUri(uri: string | null | undefined): ProbedMediaFacts | null {
  if (!isProbeableOutputUri(uri)) return null;
  const path = resolveProbePath(String(uri ?? ''));
  if (!path) return null;
  return probeMediaFile(path);
}

export function hasFullTechnicalFacts(facts: QcFacts): boolean {
  return facts.width != null && facts.height != null && facts.duration_sec != null;
}
