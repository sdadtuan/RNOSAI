/**
 * Shared XHR upload helper. Native fetch cannot report upload progress;
 * XMLHttpRequest can, for both JSON bodies and FormData.
 */

export type UploadProgressHandler = (percent: number) => void;

export class UploadHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'UploadHttpError';
  }
}

export type XhrWithProgressOptions = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData | Blob | null;
  onUploadProgress?: UploadProgressHandler;
  signal?: AbortSignal;
  /** When false, skip JSON.parse and return raw text as unknown. Default true. */
  json?: boolean;
};

export function xhrWithProgress<T = unknown>(opts: XhrWithProgressOptions): Promise<T> {
  const method = opts.method || 'POST';
  return new Promise<T>((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new UploadHttpError('XMLHttpRequest is not available', 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, opts.url);
    const headers = opts.headers ?? {};
    for (const [key, value] of Object.entries(headers)) {
      if (value != null && value !== '') xhr.setRequestHeader(key, value);
    }
    if (opts.onUploadProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          opts.onUploadProgress!(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      };
      xhr.upload.onload = () => opts.onUploadProgress?.(100);
    }
    const finish = () => {
      const raw = xhr.responseText ?? '';
      let parsed: unknown = raw;
      if (opts.json !== false) {
        if (!raw) parsed = {};
        else {
          try {
            parsed = JSON.parse(raw);
          } catch {
            reject(new UploadHttpError('Invalid JSON response', xhr.status, raw));
            return;
          }
        }
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const body = parsed as { error?: unknown; message?: unknown };
        const msg =
          pickErrorMessage(body?.error) ||
          pickErrorMessage(body?.message) ||
          (xhr.status === 500 ? 'Lỗi server — thử lại hoặc kiểm tra log' : 'Tải file thất bại');
        reject(new UploadHttpError(String(msg), xhr.status, parsed));
        return;
      }
      resolve(parsed as T);
    };
    xhr.onload = finish;
    xhr.onerror = () => reject(new UploadHttpError('Không kết nối được máy chủ', xhr.status || 0));
    xhr.onabort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      const onAbort = () => xhr.abort();
      opts.signal.addEventListener('abort', onAbort);
      xhr.addEventListener('loadend', () => opts.signal!.removeEventListener('abort', onAbort));
    }
    xhr.send(opts.body ?? null);
  });
}

function pickErrorMessage(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  if (typeof value === 'object' && value && typeof (value as { message?: unknown }).message === 'string') {
    return String((value as { message: string }).message);
  }
  return undefined;
}

/** Label used on upload buttons and progress text — keep identical across CRM. */
export function uploadProgressLabel(
  phase: 'idle' | 'reading' | 'uploading',
  progress: number | null,
  idleLabel?: string,
): string {
  if (phase === 'reading') return 'Đang đọc file…';
  if (phase === 'uploading') return `Đang tải file… ${progress ?? 0}%`;
  return idleLabel ?? 'Chọn file';
}
