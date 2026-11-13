'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastTone, number> = {
  error: 2000,
  success: 2000,
  info: 2000,
};

let nextId = 1;
let dispatcher: ToastContextValue['push'] | null = null;

/** Push a toast from anywhere (API helpers, event handlers) once ToastProvider is mounted. */
export function pushToast(message: string, tone: ToastTone = 'info', durationMs?: number): void {
  const text = String(message ?? '').trim();
  if (!text) return;
  if (dispatcher) {
    dispatcher(text, tone, durationMs);
    return;
  }
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      if (dispatcher) dispatcher(text, tone, durationMs);
    }, 50);
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info', durationMs?: number) => {
    const text = String(message ?? '').trim();
    if (!text) return;
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message: text, tone }]);
    const ms = durationMs ?? DEFAULT_DURATION[tone];
    if (ms > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ms);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    dispatcher = push;
    return () => {
      if (dispatcher === push) dispatcher = null;
    };
  }, [push]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="email-toast-stack ops-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`email-toast email-toast--${t.tone} ops-toast ops-toast--${t.tone}`}
            role={t.tone === 'error' ? 'alert' : 'status'}
            data-testid={t.tone === 'error' ? 'ops-toast-error' : `ops-toast-${t.tone}`}
          >
            <span className="ops-toast__icon" aria-hidden="true">
              {t.tone === 'error' ? '!' : t.tone === 'success' ? '✓' : 'i'}
            </span>
            <p className="ops-toast__msg">{t.message}</p>
            <button
              type="button"
              className="ops-toast__close"
              aria-label="Đóng thông báo"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: (message: string, tone: ToastTone = 'info', durationMs?: number) => {
        pushToast(message, tone, durationMs);
      },
    };
  }
  return ctx;
}
