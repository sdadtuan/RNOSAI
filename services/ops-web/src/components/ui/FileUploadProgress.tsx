'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { uploadProgressLabel, type UploadProgressHandler } from '@/lib/http-upload';

export type UploadPhase = 'idle' | 'reading' | 'uploading';

export function FileUploadProgress({
  phase,
  progress,
  className,
  label: labelOverride,
  testId,
}: {
  phase: UploadPhase;
  progress: number | null;
  className?: string;
  label?: string;
  testId?: string;
}) {
  if (phase === 'idle' || progress == null) return null;
  const label = labelOverride ?? uploadProgressLabel(phase, progress);
  const width = phase === 'reading' ? Math.max(progress, 8) : progress;
  return (
    <div
      className={`file-upload-progress ${className ?? ''}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label={label}
      data-testid={testId ?? 'file-upload-progress'}
    >
      <p>{label}</p>
      <div className="file-upload-progress__bar">
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export type UseUploadProgress = {
  phase: UploadPhase;
  progress: number | null;
  uploading: boolean;
  label: (idleLabel?: string) => string;
  reason: string | null;
  startReading: () => void;
  onUploadProgress: UploadProgressHandler;
  run: <T>(task: (onUploadProgress: UploadProgressHandler) => Promise<T>) => Promise<T>;
  finish: () => void;
  view: ReactNode;
};

export function useUploadProgress(): UseUploadProgress {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = phase !== 'idle';

  const startReading = useCallback(() => {
    setPhase('reading');
    setProgress(0);
  }, []);

  const onUploadProgress = useCallback<UploadProgressHandler>((percent) => {
    setPhase('uploading');
    setProgress(percent);
  }, []);

  const finish = useCallback(() => {
    setPhase('idle');
    setProgress(null);
  }, []);

  const run = useCallback(
    async <T,>(task: (onUploadProgress: UploadProgressHandler) => Promise<T>): Promise<T> => {
      startReading();
      try {
        return await task(onUploadProgress);
      } finally {
        finish();
      }
    },
    [startReading, onUploadProgress, finish],
  );

  return {
    phase,
    progress,
    uploading,
    label: (idle) => uploadProgressLabel(phase, progress, idle),
    reason: uploading ? uploadProgressLabel(phase, progress) : null,
    startReading,
    onUploadProgress,
    run,
    finish,
    view: <FileUploadProgress phase={phase} progress={progress} />,
  };
}
